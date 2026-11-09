BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) VALUES (
  'b1000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'invoice-stock-pgtap@example.invalid', '',
  NOW(), NOW(), NOW(), '{}'::JSONB, '{}'::JSONB
);

INSERT INTO public.tenants (id, name)
VALUES ('b2000000-0000-4000-8000-000000000001', 'Invoice stock test tenant');

INSERT INTO public.tenant_members (tenant_id, user_id, role)
VALUES (
  'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'tenant_admin'
);

INSERT INTO public.parties (id, tenant_id, name, balance)
VALUES (
  'b3000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'Invoice stock test party',
  0
);

INSERT INTO public.items (id, tenant_id, name, current_stock)
VALUES (
  'b4000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'Invoice stock test item',
  0
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', TRUE);

SELECT throws_ok(
  $$
    UPDATE public.items
    SET current_stock = -1
    WHERE id = 'b4000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'Insufficient server stock; cached stock is only an estimate.',
  'negative stock decrement is rejected'
);

SELECT is(
  (SELECT current_stock FROM public.items WHERE id = 'b4000000-0000-4000-8000-000000000001'),
  0::NUMERIC,
  'rejected stock decrement leaves stock unchanged'
);

SELECT throws_ok(
  $$
    SELECT public.create_invoice(
      'b2000000-0000-4000-8000-000000000001',
      'b5000000-0000-4000-8000-000000000001',
      '2026-11-09',
      'b3000000-0000-4000-8000-000000000001',
      'Invoice stock test party',
      'cash',
      'cash',
      0,
      NULL,
      '[{"item_id":"b4000000-0000-4000-8000-000000000001","item_name":"Invoice stock test item","quantity":1,"unit":"pcs","rate":10,"tax_percent":0,"discount_percent":0}]'::JSONB
    )
  $$,
  '23514',
  'Insufficient server stock; cached stock is only an estimate.',
  'atomic invoice creation rejects an oversell'
);

RESET ROLE;

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.invoices WHERE tenant_id = 'b2000000-0000-4000-8000-000000000001'),
  0,
  'oversold invoice and its lines roll back'
);
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.invoice_creation_operations
   WHERE tenant_id = 'b2000000-0000-4000-8000-000000000001'),
  0,
  'rejected oversell does not consume the idempotency key'
);

SELECT * FROM finish();
ROLLBACK;
SELECT 'oversell assertions passed; test fixtures rolled back' AS result;
