BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'invoice-pgtap-member@example.invalid', '',
    NOW(), NOW(), NOW(), '{}'::JSONB, '{}'::JSONB
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'invoice-pgtap-outsider@example.invalid', '',
    NOW(), NOW(), NOW(), '{}'::JSONB, '{}'::JSONB
  );

INSERT INTO public.tenants (id, name)
VALUES ('a2000000-0000-4000-8000-000000000001', 'Invoice RPC test tenant');

INSERT INTO public.tenant_members (tenant_id, user_id, role)
VALUES (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'tenant_admin'
);

INSERT INTO public.parties (id, tenant_id, name, balance)
VALUES (
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'Invoice RPC test party',
  0
);

INSERT INTO public.items (id, tenant_id, name, current_stock)
VALUES (
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'Invoice RPC test item',
  1
);

CREATE FUNCTION pg_temp.fail_invoice_stock_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'forced stock failure' USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER test_fail_invoice_stock_update
BEFORE UPDATE OF current_stock ON public.items
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_invoice_stock_update();

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', TRUE);

SELECT throws_ok(
  $$
    SELECT public.create_invoice(
      'a2000000-0000-4000-8000-000000000001',
      'a5000000-0000-4000-8000-000000000001',
      '2026-03-02',
      'a3000000-0000-4000-8000-000000000001',
      'Invoice RPC test party',
      'credit',
      'cash',
      0,
      'rollback test',
      '[{"item_id":"a4000000-0000-4000-8000-000000000001","item_name":"Invoice RPC test item","quantity":1,"unit":"pcs","rate":50,"tax_percent":0,"discount_percent":0}]'::JSONB
    )
  $$,
  'P0001',
  'forced stock failure',
  'a failure after invoice and line inserts is returned'
);

RESET ROLE;
DROP TRIGGER test_fail_invoice_stock_update ON public.items;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', TRUE);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.invoices WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'),
  0,
  'invoice insert rolled back'
);
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.invoice_items WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'),
  0,
  'invoice line insert rolled back'
);
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.stock_adjustments WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'),
  0,
  'stock adjustments rolled back'
);
SELECT is(
  (SELECT current_stock FROM public.items WHERE id = 'a4000000-0000-4000-8000-000000000001'),
  1::NUMERIC,
  'stock is unchanged after rollback'
);
SELECT is(
  (SELECT balance FROM public.parties WHERE id = 'a3000000-0000-4000-8000-000000000001'),
  0::NUMERIC,
  'party balance is unchanged after rollback'
);

SELECT is(
  (
    SELECT public.create_invoice(
      'a2000000-0000-4000-8000-000000000001',
      'a5000000-0000-4000-8000-000000000002',
      '2026-03-02',
      'a3000000-0000-4000-8000-000000000001',
      'Invoice RPC test party',
      'credit',
      'cash',
      0,
      'duplicate test',
      '[{"item_id":"a4000000-0000-4000-8000-000000000001","item_name":"Invoice RPC test item","quantity":1,"unit":"pcs","rate":50,"tax_percent":0,"discount_percent":0}]'::JSONB
    ) ->> 'id'
  ),
  (
    SELECT public.create_invoice(
      'a2000000-0000-4000-8000-000000000001',
      'a5000000-0000-4000-8000-000000000002',
      '2026-03-02',
      'a3000000-0000-4000-8000-000000000001',
      'Invoice RPC test party',
      'credit',
      'cash',
      0,
      'duplicate test',
      '[{"item_id":"a4000000-0000-4000-8000-000000000001","item_name":"Invoice RPC test item","quantity":1,"unit":"pcs","rate":50,"tax_percent":0,"discount_percent":0}]'::JSONB
    ) ->> 'id'
  ),
  'retry returns the original invoice ID'
);
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.invoices WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'),
  1,
  'retry does not create another invoice'
);
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.invoice_items WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'),
  1,
  'retry does not duplicate invoice lines'
);
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.stock_adjustments WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'),
  1,
  'retry does not duplicate stock adjustments'
);
SELECT is(
  (SELECT current_stock FROM public.items WHERE id = 'a4000000-0000-4000-8000-000000000001'),
  0::NUMERIC,
  'stock is decremented once'
);
SELECT is(
  (SELECT balance FROM public.parties WHERE id = 'a3000000-0000-4000-8000-000000000001'),
  50::NUMERIC,
  'credit balance is incremented once'
);

RESET ROLE;
SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.invoice_creation_operations
    WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'
      AND operation_id = 'a5000000-0000-4000-8000-000000000002'
  ),
  1,
  'one idempotency record exists for the operation'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', TRUE);
SELECT throws_ok(
  $$
    SELECT public.create_invoice(
      'a2000000-0000-4000-8000-000000000001',
      'a5000000-0000-4000-8000-000000000003',
      '2026-03-02',
      NULL,
      'Invoice RPC test party',
      'cash',
      'cash',
      0,
      NULL,
      '[{"item_name":"Untracked item","quantity":1,"unit":"pcs","rate":10}]'::JSONB
    )
  $$,
  '42501',
  'User is not a member of the selected tenant.',
  'a user outside the tenant cannot create an invoice'
);

RESET ROLE;
DO $$
DECLARE
  v_rejected BOOLEAN := FALSE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'
      AND id IN (
        SELECT invoice_id
        FROM public.invoice_creation_operations
        WHERE operation_id = 'a5000000-0000-4000-8000-000000000001'
      )
  ) OR EXISTS (
    SELECT 1 FROM public.invoice_creation_operations
    WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'
      AND operation_id = 'a5000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'failed invoice operation left a partial invoice or idempotency record';
  END IF;

  IF (SELECT COUNT(*) FROM public.invoices
      WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001') <> 1
    OR (SELECT COUNT(*) FROM public.invoice_items
      WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001') <> 1
    OR (SELECT COUNT(*) FROM public.stock_adjustments
      WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001') <> 1
    OR (SELECT current_stock FROM public.items
      WHERE id = 'a4000000-0000-4000-8000-000000000001') <> 0
    OR (SELECT balance FROM public.parties
      WHERE id = 'a3000000-0000-4000-8000-000000000001') <> 50
    OR (SELECT COUNT(*) FROM public.invoice_creation_operations
      WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'
        AND operation_id = 'a5000000-0000-4000-8000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'matching retry duplicated or failed to apply invoice side effects exactly once';
  END IF;

  PERFORM set_config(
    'request.jwt.claim.sub',
    'a1000000-0000-4000-8000-000000000002',
    TRUE
  );
  BEGIN
    PERFORM public.create_invoice(
      'a2000000-0000-4000-8000-000000000001',
      'a5000000-0000-4000-8000-000000000004',
      '2026-03-02',
      NULL,
      'Invoice RPC test party',
      'cash',
      'cash',
      0,
      NULL,
      '[{"item_name":"Untracked item","quantity":1,"unit":"pcs","rate":10}]'::JSONB
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_rejected := SQLERRM = 'User is not a member of the selected tenant.';
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'non-member invoice operation was not rejected by tenant validation';
  END IF;
END;
$$;

SELECT * FROM finish();
ROLLBACK;
SELECT 'atomic invoice assertions passed; test fixtures rolled back' AS result;
