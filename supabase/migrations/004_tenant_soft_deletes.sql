-- ============================================================
-- Phase 5.1: Multi-Tenant Schema & Soft Delete Architecture
-- ============================================================

-- 1. Core Tables & Enums
CREATE TYPE system_role_enum AS ENUM ('super_admin', 'user');
CREATE TYPE tenant_role_enum AS ENUM ('tenant_admin', 'distributor', 'worker');

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    system_role system_role_enum DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role tenant_role_enum DEFAULT 'worker',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- Helper functions for RLS & Triggers
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND system_role = 'super_admin'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_tenant_ids() RETURNS SETOF UUID AS $$
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_tenant_admin(check_tenant_id UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_members 
        WHERE user_id = auth.uid() AND tenant_id = check_tenant_id AND role = 'tenant_admin'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- 2. Modify existing business tables & 3. Create RLS Policies
DO $$ 
DECLARE
  t TEXT;
BEGIN
  -- We apply this to the core business tables
  FOR t IN SELECT unnest(ARRAY['items', 'parties', 'invoices', 'invoice_items', 'stock_adjustments', 'expenses'])
  LOOP
    -- A. Add new columns
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL', t);

    -- B. Remove old RLS policies (from V4) to avoid conflicts if they exist
    EXECUTE format('DROP POLICY IF EXISTS "Users can view business %I" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert business %I" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update business %I" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete business %I" ON %I', t, t);

    -- C. Enable RLS (in case it wasn't)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- D. Super Admin Policy: Allow ALL operations and bypass deleted_at filters
    EXECUTE format('CREATE POLICY "Super Admin ALL %I" ON %I FOR ALL USING (is_super_admin())', t, t);

    -- E. Tenant User Policy: SELECT (only if deleted_at IS NULL)
    EXECUTE format('CREATE POLICY "Tenant User SELECT %I" ON %I FOR SELECT USING (
        NOT is_super_admin() AND 
        tenant_id IN (SELECT get_user_tenant_ids()) AND 
        deleted_at IS NULL
    )', t, t);

    -- F. Tenant User Policy: INSERT
    EXECUTE format('CREATE POLICY "Tenant User INSERT %I" ON %I FOR INSERT WITH CHECK (
        NOT is_super_admin() AND 
        tenant_id IN (SELECT get_user_tenant_ids())
    )', t, t);

    -- G. Tenant User Policy: UPDATE (only if deleted_at IS NULL)
    EXECUTE format('CREATE POLICY "Tenant User UPDATE %I" ON %I FOR UPDATE USING (
        NOT is_super_admin() AND 
        tenant_id IN (SELECT get_user_tenant_ids()) AND 
        deleted_at IS NULL
    )', t, t);

    -- Note: No DELETE policy for Tenant Users. They must use UPDATE to soft-delete (set deleted_at).

  END LOOP;
END $$;


-- 4. Restrict updates to `deleted_at` (soft deletion) to users with `role = 'tenant_admin'`
CREATE OR REPLACE FUNCTION restrict_soft_delete() RETURNS TRIGGER AS $$
BEGIN
    -- Check if deleted_at is being modified (soft delete or restore)
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
        -- Allow if super_admin
        IF is_super_admin() THEN
            RETURN NEW;
        END IF;

        -- Must be tenant_admin to perform this action
        IF NOT is_tenant_admin(OLD.tenant_id) THEN
            RAISE EXCEPTION 'Permission denied: Only tenant administrators can perform soft deletions.';
        END IF;

        -- Auto-fill deleted_by when soft deleting
        IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
            NEW.deleted_by := auth.uid();
        END IF;
        
        -- Clear deleted_by when restoring
        IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
            NEW.deleted_by := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to all tables
CREATE TRIGGER restrict_soft_delete_items BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION restrict_soft_delete();
CREATE TRIGGER restrict_soft_delete_parties BEFORE UPDATE ON parties FOR EACH ROW EXECUTE FUNCTION restrict_soft_delete();
CREATE TRIGGER restrict_soft_delete_invoices BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION restrict_soft_delete();
CREATE TRIGGER restrict_soft_delete_invoice_items BEFORE UPDATE ON invoice_items FOR EACH ROW EXECUTE FUNCTION restrict_soft_delete();
CREATE TRIGGER restrict_soft_delete_stock_adjustments BEFORE UPDATE ON stock_adjustments FOR EACH ROW EXECUTE FUNCTION restrict_soft_delete();
CREATE TRIGGER restrict_soft_delete_expenses BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION restrict_soft_delete();

