CREATE OR REPLACE FUNCTION public.user_can_access_tenant(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        EXISTS (
            SELECT 1
            FROM public.tenant_members
            WHERE user_id = (SELECT auth.uid())
              AND tenant_id = check_tenant_id
        )
        OR EXISTS (
            SELECT 1
            FROM public.users
            WHERE id = (SELECT auth.uid())
              AND system_role::TEXT = 'super_admin'
        );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_tenant(UUID) TO authenticated;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN
        SELECT unnest(ARRAY[
            'items',
            'parties',
            'invoices',
            'invoice_items',
            'stock_adjustments',
            'expenses'
        ])
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.%I',
            'Tenant User INSERT ' || table_name,
            table_name
        );
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_can_access_tenant(tenant_id))',
            'Tenant User INSERT ' || table_name,
            table_name
        );

        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.%I',
            'Tenant User UPDATE ' || table_name,
            table_name
        );
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.user_can_access_tenant(tenant_id) AND deleted_at IS NULL) WITH CHECK (public.user_can_access_tenant(tenant_id))',
            'Tenant User UPDATE ' || table_name,
            table_name
        );
    END LOOP;
END
$$;
