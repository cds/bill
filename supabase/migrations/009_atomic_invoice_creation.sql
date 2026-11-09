CREATE TABLE public.invoice_creation_operations (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  request_payload JSONB NOT NULL,
  invoice_id UUID NOT NULL UNIQUE REFERENCES public.invoices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, operation_id)
);

ALTER TABLE public.invoice_creation_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_creation_operations FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_invoice(
  p_tenant_id UUID,
  p_operation_id UUID,
  p_invoice_date DATE,
  p_party_id UUID,
  p_party_name TEXT,
  p_payment_type TEXT,
  p_payment_method TEXT,
  p_amount_paid NUMERIC,
  p_notes TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_operation RECORD;
  v_party RECORD;
  v_item RECORD;
  v_line JSONB;
  v_item_id UUID;
  v_item_name TEXT;
  v_quantity NUMERIC;
  v_unit TEXT;
  v_rate NUMERIC;
  v_tax_percent NUMERIC;
  v_discount_percent NUMERIC;
  v_line_amount NUMERIC;
  v_line_discount NUMERIC;
  v_line_tax NUMERIC;
  v_subtotal NUMERIC := 0;
  v_tax NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_total NUMERIC;
  v_paid NUMERIC;
  v_balance NUMERIC;
  v_invoice_date DATE;
  v_party_name TEXT;
  v_payment_type TEXT;
  v_payment_method TEXT;
  v_normalized_items JSONB := '[]'::JSONB;
  v_request_payload JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenants WHERE id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant not found.' USING ERRCODE = '42501';
  END IF;
  IF NOT is_super_admin() AND NOT EXISTS (
    SELECT 1
    FROM public.tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'User is not a member of the selected tenant.'
      USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'An invoice operation ID is required.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_party_name), '') IS NULL THEN
    RAISE EXCEPTION 'Party name is required.' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one invoice item is required.' USING ERRCODE = '22023';
  END IF;

  v_invoice_date := COALESCE(p_invoice_date, CURRENT_DATE);
  v_party_name := p_party_name;
  v_payment_type := COALESCE(p_payment_type, 'cash');
  v_payment_method := COALESCE(p_payment_method, 'cash');
  IF v_payment_type NOT IN ('cash', 'credit') THEN
    RAISE EXCEPTION 'Invalid payment type.' USING ERRCODE = '22023';
  END IF;
  IF v_payment_method NOT IN ('cash', 'upi', 'bank') THEN
    RAISE EXCEPTION 'Invalid payment method.' USING ERRCODE = '22023';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_line) <> 'object' THEN
      RAISE EXCEPTION 'Invoice items must be objects.' USING ERRCODE = '22023';
    END IF;

    v_item_id := NULLIF(v_line->>'item_id', '')::UUID;
    v_item_name := v_line->>'item_name';
    v_quantity := NULLIF(v_line->>'quantity', '')::NUMERIC;
    v_unit := COALESCE(NULLIF(v_line->>'unit', ''), 'Pcs');
    v_rate := NULLIF(v_line->>'rate', '')::NUMERIC;
    v_tax_percent := COALESCE(NULLIF(v_line->>'tax_percent', '')::NUMERIC, 0);
    v_discount_percent := COALESCE(NULLIF(v_line->>'discount_percent', '')::NUMERIC, 0);

    IF NULLIF(BTRIM(v_item_name), '') IS NULL
      OR COALESCE(v_quantity, 0) <= 0
      OR COALESCE(v_rate, -1) < 0
      OR v_tax_percent < 0
      OR v_discount_percent < 0
      OR v_discount_percent > 100 THEN
      RAISE EXCEPTION 'Invoice item quantity, name, rate, tax, or discount is invalid.'
        USING ERRCODE = '22023';
    END IF;

    v_line_amount := v_quantity * v_rate;
    v_line_discount := v_line_amount * v_discount_percent / 100;
    v_line_tax := (v_line_amount - v_line_discount) * v_tax_percent / 100;
    v_subtotal := v_subtotal + v_line_amount;
    v_discount := v_discount + v_line_discount;
    v_tax := v_tax + v_line_tax;
    v_normalized_items := v_normalized_items || jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id,
      'item_name', v_item_name,
      'quantity', v_quantity,
      'unit', v_unit,
      'rate', v_rate,
      'tax_percent', v_tax_percent,
      'discount_percent', v_discount_percent
    ));
  END LOOP;

  v_total := v_subtotal - v_discount + v_tax;
  v_paid := CASE
    WHEN v_payment_type = 'cash' THEN v_total
    ELSE COALESCE(p_amount_paid, 0)
  END;
  v_balance := v_total - v_paid;
  v_request_payload := jsonb_build_object(
    'invoice_date', v_invoice_date,
    'party_id', p_party_id,
    'party_name', v_party_name,
    'payment_type', v_payment_type,
    'payment_method', v_payment_method,
    'amount_paid', v_paid,
    'notes', NULLIF(p_notes, ''),
    'items', v_normalized_items
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::TEXT || ':' || p_operation_id::TEXT, 0)
  );

  SELECT request_payload, invoice_id
  INTO v_operation
  FROM public.invoice_creation_operations
  WHERE tenant_id = p_tenant_id
    AND operation_id = p_operation_id;

  IF FOUND THEN
    IF v_operation.request_payload IS DISTINCT FROM v_request_payload THEN
      RAISE EXCEPTION 'Invoice operation ID was already used with different data.'
        USING ERRCODE = '55000';
    END IF;

    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = v_operation.invoice_id
      AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Previously created invoice could not be found.'
        USING ERRCODE = '23503';
    END IF;
    RETURN to_jsonb(v_invoice);
  END IF;

  IF p_party_id IS NOT NULL THEN
    SELECT id INTO v_party
    FROM public.parties
    WHERE id = p_party_id
      AND tenant_id = p_tenant_id
      AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Party not found in the selected tenant.'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  INSERT INTO public.invoices (
    tenant_id, invoice_date, party_id, party_name, payment_type, payment_method,
    subtotal, tax_amount, discount_amount, total_amount, amount_paid, balance_due, notes
  ) VALUES (
    p_tenant_id, v_invoice_date, p_party_id, v_party_name, v_payment_type, v_payment_method,
    v_subtotal, v_tax, v_discount, v_total, v_paid, v_balance, NULLIF(p_notes, '')
  )
  RETURNING * INTO v_invoice;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_normalized_items)
  LOOP
    v_item_id := NULLIF(v_line->>'item_id', '')::UUID;
    v_item_name := v_line->>'item_name';
    v_quantity := (v_line->>'quantity')::NUMERIC;
    v_unit := v_line->>'unit';
    v_rate := (v_line->>'rate')::NUMERIC;
    v_tax_percent := (v_line->>'tax_percent')::NUMERIC;
    v_discount_percent := (v_line->>'discount_percent')::NUMERIC;
    v_line_amount := v_quantity * v_rate;
    v_line_discount := v_line_amount * v_discount_percent / 100;
    v_line_tax := (v_line_amount - v_line_discount) * v_tax_percent / 100;

    INSERT INTO public.invoice_items (
      tenant_id, invoice_id, item_id, item_name, quantity, unit, rate,
      tax_percent, tax_amount, discount_percent, discount_amount, amount
    ) VALUES (
      p_tenant_id, v_invoice.id, v_item_id, v_item_name, v_quantity, v_unit, v_rate,
      v_tax_percent, v_line_tax, v_discount_percent, v_line_discount,
      v_line_amount - v_line_discount + v_line_tax
    );

    IF v_item_id IS NOT NULL THEN
      SELECT id INTO v_item
      FROM public.items
      WHERE id = v_item_id
        AND tenant_id = p_tenant_id
        AND deleted_at IS NULL
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'One or more items were not found in the selected tenant.'
          USING ERRCODE = '23503';
      END IF;

      UPDATE public.items
      SET current_stock = current_stock - v_quantity
      WHERE id = v_item_id
        AND tenant_id = p_tenant_id
        AND deleted_at IS NULL;

      INSERT INTO public.stock_adjustments (
        tenant_id, item_id, type, quantity, reference_id, notes
      ) VALUES (
        p_tenant_id, v_item_id, 'sale', v_quantity, v_invoice.id,
        'Sale #' || v_invoice.invoice_number
      );
    END IF;
  END LOOP;

  IF v_payment_type = 'credit' AND v_balance > 0 AND p_party_id IS NOT NULL THEN
    UPDATE public.parties
    SET balance = balance + v_balance
    WHERE id = p_party_id
      AND tenant_id = p_tenant_id
      AND deleted_at IS NULL;
  END IF;

  INSERT INTO public.invoice_creation_operations (
    tenant_id, operation_id, request_payload, invoice_id
  ) VALUES (
    p_tenant_id, p_operation_id, v_request_payload, v_invoice.id
  );

  RETURN to_jsonb(v_invoice);
END;
$$;

REVOKE ALL ON FUNCTION public.create_invoice(
  UUID, UUID, DATE, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invoice(
  UUID, UUID, DATE, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, JSONB
) TO authenticated;
