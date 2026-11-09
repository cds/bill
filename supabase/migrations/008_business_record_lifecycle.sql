-- Preserve business history, expose discarded records, and make sale changes atomic.

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS deleted_reason TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS change_reason TEXT;
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS deleted_reason TEXT;
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS change_reason TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_reason TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS change_reason TEXT;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS deleted_reason TEXT;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS change_reason TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_reason TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS change_reason TEXT;
ALTER TABLE public.stock_adjustments ADD COLUMN IF NOT EXISTS deleted_reason TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;

-- Tenant members can see discarded records in history. Active selectors and
-- financial reports explicitly filter deleted_at IS NULL.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'items', 'parties', 'invoices', 'invoice_items', 'stock_adjustments', 'expenses'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Tenant User SELECT ' || table_name,
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (
        NOT is_super_admin() AND tenant_id IN (SELECT get_user_tenant_ids())
      )',
      'Tenant User SELECT ' || table_name,
      table_name
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Tenant User UPDATE ' || table_name,
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE
        USING (
          NOT is_super_admin() AND
          tenant_id IN (SELECT get_user_tenant_ids()) AND
          deleted_at IS NULL
        )
        WITH CHECK (
          NOT is_super_admin() AND
          tenant_id IN (SELECT get_user_tenant_ids()) AND
          (deleted_at IS NULL OR is_tenant_admin(tenant_id))
        )',
      'Tenant User UPDATE ' || table_name,
      table_name
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.restrict_soft_delete() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF NOT is_super_admin() AND NOT is_tenant_admin(OLD.tenant_id) THEN
      RAISE EXCEPTION 'Permission denied: Only tenant administrators can discard or restore records.'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      IF NULLIF(BTRIM(NEW.deleted_reason), '') IS NULL THEN
        RAISE EXCEPTION 'A reason is required to discard this record.'
          USING ERRCODE = '22023';
      END IF;
      NEW.deleted_by := auth.uid();
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      NEW.deleted_by := NULL;
      NEW.deleted_reason := NULL;
    END IF;
  ELSIF NEW.deleted_reason IS DISTINCT FROM OLD.deleted_reason THEN
    RAISE EXCEPTION 'Discard reason can only change when a record is discarded or restored.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.log_audit_event() RETURNS TRIGGER AS $$
DECLARE
  v_action audit_action_enum;
  v_row JSONB;
  v_tenant_id UUID;
  v_record_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
  v_reason TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_new_data := to_jsonb(NEW);
    v_row := v_new_data;
  ELSE
    v_new_data := to_jsonb(NEW);
    v_old_data := to_jsonb(OLD);
    v_row := v_new_data;

    IF (v_old_data ? 'deleted_at') AND (v_new_data ? 'deleted_at')
      AND (v_old_data->>'deleted_at') IS NULL
      AND (v_new_data->>'deleted_at') IS NOT NULL THEN
      v_action := 'SOFT_DELETE';
    ELSE
      v_action := 'UPDATE';
    END IF;
  END IF;

  v_record_id := (v_row->>'id')::UUID;
  v_tenant_id := (v_row->>'tenant_id')::UUID;
  v_reason := COALESCE(v_row->>'deleted_reason', v_row->>'change_reason', v_row->>'notes');

  INSERT INTO public.audit_logs (
    tenant_id, user_id, table_name, record_id, action, old_data, new_data, reason
  ) VALUES (
    v_tenant_id, auth.uid(), TG_TABLE_NAME::TEXT, v_record_id,
    v_action, v_old_data, v_new_data, v_reason
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS restrict_soft_delete_expenses ON public.expenses;
CREATE TRIGGER restrict_soft_delete_expenses
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.restrict_soft_delete();

DROP TRIGGER IF EXISTS tr_audit_expenses ON public.expenses;
CREATE TRIGGER tr_audit_expenses
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS tr_audit_invoice_items ON public.invoice_items;
CREATE TRIGGER tr_audit_invoice_items
  AFTER INSERT OR UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS tr_audit_stock_adjustments ON public.stock_adjustments;
CREATE TRIGGER tr_audit_stock_adjustments
  AFTER INSERT OR UPDATE ON public.stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE OR REPLACE FUNCTION public.void_invoice(p_invoice_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_item RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to void a sale.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT is_super_admin() AND NOT is_tenant_admin(v_invoice.tenant_id) THEN
    RAISE EXCEPTION 'Only tenant administrators can void sales.' USING ERRCODE = '42501';
  END IF;
  IF v_invoice.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This sale has already been voided.' USING ERRCODE = '55000';
  END IF;

  FOR v_item IN
    SELECT item_id, SUM(quantity) AS quantity
    FROM public.invoice_items
    WHERE invoice_id = p_invoice_id
      AND tenant_id = v_invoice.tenant_id
      AND deleted_at IS NULL
      AND item_id IS NOT NULL
    GROUP BY item_id
  LOOP
    UPDATE public.items
    SET current_stock = current_stock + v_item.quantity,
        change_reason = 'Sale voided: ' || BTRIM(p_reason)
    WHERE id = v_item.item_id
      AND tenant_id = v_invoice.tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot reverse stock: an item from this sale no longer exists.'
        USING ERRCODE = '23503';
    END IF;

    INSERT INTO public.stock_adjustments (
      tenant_id, item_id, type, quantity, reference_id, notes
    ) VALUES (
      v_invoice.tenant_id, v_item.item_id, 'add', v_item.quantity,
      p_invoice_id, 'Void Sale #' || v_invoice.invoice_number || ': ' || BTRIM(p_reason)
    );
  END LOOP;

  UPDATE public.invoice_items
  SET deleted_at = NOW(),
      deleted_reason = 'Sale voided: ' || BTRIM(p_reason)
  WHERE invoice_id = p_invoice_id
    AND tenant_id = v_invoice.tenant_id
    AND deleted_at IS NULL;

  IF v_invoice.payment_type = 'credit'
    AND v_invoice.balance_due > 0
    AND v_invoice.party_id IS NOT NULL THEN
    UPDATE public.parties
    SET balance = balance - v_invoice.balance_due,
        change_reason = 'Sale #' || v_invoice.invoice_number || ' voided'
    WHERE id = v_invoice.party_id
      AND tenant_id = v_invoice.tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot reverse the party balance: party not found.'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  UPDATE public.invoices
  SET deleted_at = NOW(),
      deleted_reason = BTRIM(p_reason),
      deleted_by = auth.uid()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_invoice(
  p_invoice_id UUID,
  p_invoice_date DATE,
  p_party_id UUID,
  p_party_name TEXT,
  p_payment_type TEXT,
  p_payment_method TEXT,
  p_amount_paid NUMERIC,
  p_notes TEXT,
  p_items JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_party RECORD;
  v_line JSONB;
  v_old_item RECORD;
  v_stock RECORD;
  v_subtotal NUMERIC := 0;
  v_tax NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_total NUMERIC;
  v_paid NUMERIC;
  v_balance NUMERIC;
  v_new_party_id UUID;
  v_line_amount NUMERIC;
  v_line_discount NUMERIC;
  v_line_tax NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to edit a sale.' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sale item is required.' USING ERRCODE = '22023';
  END IF;
  IF p_payment_type NOT IN ('cash', 'credit') THEN
    RAISE EXCEPTION 'Invalid payment type.' USING ERRCODE = '22023';
  END IF;
  IF p_payment_method NOT IN ('cash', 'upi', 'bank') THEN
    RAISE EXCEPTION 'Invalid payment method.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT is_super_admin() AND NOT is_tenant_admin(v_invoice.tenant_id) THEN
    RAISE EXCEPTION 'Only tenant administrators can edit sales.' USING ERRCODE = '42501';
  END IF;
  IF v_invoice.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Voided sales cannot be edited.' USING ERRCODE = '55000';
  END IF;

  IF p_party_id IS NOT NULL THEN
    SELECT id INTO v_party
    FROM public.parties
    WHERE id = p_party_id
      AND tenant_id = v_invoice.tenant_id
      AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Party not found or discarded.' USING ERRCODE = '23503';
    END IF;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF COALESCE((v_line->>'quantity')::NUMERIC, 0) <= 0
      OR COALESCE((v_line->>'rate')::NUMERIC, -1) < 0
      OR COALESCE((v_line->>'tax_percent')::NUMERIC, 0) < 0
      OR COALESCE((v_line->>'discount_percent')::NUMERIC, 0) < 0
      OR COALESCE((v_line->>'discount_percent')::NUMERIC, 0) > 100 THEN
      RAISE EXCEPTION 'Sale item quantity, rate, tax, or discount is invalid.'
        USING ERRCODE = '22023';
    END IF;

    IF NULLIF(v_line->>'item_id', '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.items
      WHERE id = (v_line->>'item_id')::UUID
        AND tenant_id = v_invoice.tenant_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'A sale item is unavailable or discarded.' USING ERRCODE = '23503';
    END IF;

    v_line_amount := (v_line->>'quantity')::NUMERIC * (v_line->>'rate')::NUMERIC;
    v_line_discount := v_line_amount * COALESCE((v_line->>'discount_percent')::NUMERIC, 0) / 100;
    v_line_tax := (v_line_amount - v_line_discount) * COALESCE((v_line->>'tax_percent')::NUMERIC, 0) / 100;
    v_subtotal := v_subtotal + v_line_amount;
    v_discount := v_discount + v_line_discount;
    v_tax := v_tax + v_line_tax;
  END LOOP;

  v_total := v_subtotal - v_discount + v_tax;
  v_paid := CASE WHEN p_payment_type = 'cash' THEN v_total ELSE COALESCE(p_amount_paid, 0) END;
  IF v_paid < 0 OR v_paid > v_total THEN
    RAISE EXCEPTION 'Amount received must be between zero and the sale total.'
      USING ERRCODE = '22023';
  END IF;
  v_balance := v_total - v_paid;

  FOR v_stock IN
    SELECT item_id, SUM(quantity_delta) AS quantity_delta
    FROM (
      SELECT item_id, quantity AS quantity_delta
      FROM public.invoice_items
      WHERE invoice_id = p_invoice_id
        AND tenant_id = v_invoice.tenant_id
        AND deleted_at IS NULL
        AND item_id IS NOT NULL
      UNION ALL
      SELECT NULLIF(value->>'item_id', '')::UUID,
             -(value->>'quantity')::NUMERIC
      FROM jsonb_array_elements(p_items)
      WHERE NULLIF(value->>'item_id', '') IS NOT NULL
    ) movements
    GROUP BY item_id
    HAVING SUM(quantity_delta) <> 0
  LOOP
    UPDATE public.items
    SET current_stock = current_stock + v_stock.quantity_delta,
        change_reason = 'Sale #' || v_invoice.invoice_number || ' edited: ' || BTRIM(p_reason)
    WHERE id = v_stock.item_id
      AND tenant_id = v_invoice.tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot adjust stock: an item from this sale no longer exists.'
        USING ERRCODE = '23503';
    END IF;

    INSERT INTO public.stock_adjustments (
      tenant_id, item_id, type, quantity, reference_id, notes
    ) VALUES (
      v_invoice.tenant_id,
      v_stock.item_id,
      CASE WHEN v_stock.quantity_delta > 0 THEN 'add' ELSE 'reduce' END,
      ABS(v_stock.quantity_delta),
      p_invoice_id,
      'Sale #' || v_invoice.invoice_number || ' edit: ' || BTRIM(p_reason)
    );
  END LOOP;

  IF v_invoice.payment_type = 'credit' AND v_invoice.party_id IS NOT NULL THEN
    UPDATE public.parties
    SET balance = balance - v_invoice.balance_due,
        change_reason = 'Sale #' || v_invoice.invoice_number || ' edited'
    WHERE id = v_invoice.party_id
      AND tenant_id = v_invoice.tenant_id;
  END IF;

  IF p_payment_type = 'credit' AND p_party_id IS NOT NULL AND v_balance > 0 THEN
    UPDATE public.parties
    SET balance = balance + v_balance,
        change_reason = 'Sale #' || v_invoice.invoice_number || ' edited'
    WHERE id = p_party_id
      AND tenant_id = v_invoice.tenant_id;
  END IF;

  UPDATE public.invoice_items
  SET deleted_at = NOW(),
      deleted_reason = 'Replaced during sale edit: ' || BTRIM(p_reason)
  WHERE invoice_id = p_invoice_id
    AND tenant_id = v_invoice.tenant_id
    AND deleted_at IS NULL;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_line_amount := (v_line->>'quantity')::NUMERIC * (v_line->>'rate')::NUMERIC;
    v_line_discount := v_line_amount * COALESCE((v_line->>'discount_percent')::NUMERIC, 0) / 100;
    v_line_tax := (v_line_amount - v_line_discount) * COALESCE((v_line->>'tax_percent')::NUMERIC, 0) / 100;

    INSERT INTO public.invoice_items (
      tenant_id, invoice_id, item_id, item_name, quantity, unit, rate,
      tax_percent, tax_amount, discount_percent, discount_amount, amount
    ) VALUES (
      v_invoice.tenant_id, p_invoice_id, NULLIF(v_line->>'item_id', '')::UUID,
      v_line->>'item_name', (v_line->>'quantity')::NUMERIC, v_line->>'unit',
      (v_line->>'rate')::NUMERIC,
      COALESCE((v_line->>'tax_percent')::NUMERIC, 0), v_line_tax,
      COALESCE((v_line->>'discount_percent')::NUMERIC, 0), v_line_discount,
      v_line_amount - v_line_discount + v_line_tax
    );
  END LOOP;

  UPDATE public.invoices
  SET invoice_date = p_invoice_date,
      party_id = p_party_id,
      party_name = p_party_name,
      payment_type = p_payment_type,
      payment_method = p_payment_method,
      subtotal = v_subtotal,
      tax_amount = v_tax,
      discount_amount = v_discount,
      total_amount = v_total,
      amount_paid = v_paid,
      balance_due = v_balance,
      notes = p_notes,
      change_reason = BTRIM(p_reason)
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id);
END;
$$;

REVOKE ALL ON FUNCTION public.void_invoice(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_invoice(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.edit_invoice(UUID, DATE, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_invoice(UUID, DATE, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, JSONB, TEXT) TO authenticated;
