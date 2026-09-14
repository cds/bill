-- ============================================================
-- Phase 5.2: Postgres Audit Log Trigger System
-- ============================================================

-- 1. Create Enums and Table
CREATE TYPE audit_action_enum AS ENUM ('INSERT', 'UPDATE', 'SOFT_DELETE');

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action audit_action_enum NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Protect Audit Logs with RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all logs
CREATE POLICY "Super admin view all audit logs" ON public.audit_logs
    FOR SELECT USING (is_super_admin());

-- Tenant admins can view their tenant's logs
CREATE POLICY "Tenant admin view tenant audit logs" ON public.audit_logs
    FOR SELECT USING (
        tenant_id IN (SELECT get_user_tenant_ids()) 
        AND is_tenant_admin(tenant_id)
    );

-- System function inserts logs, so we don't need a public INSERT policy
-- No UPDATE or DELETE policies allowed for anyone (immutable ledger)

-- 2. Create the Generic Audit Event Function
CREATE OR REPLACE FUNCTION log_audit_event() RETURNS TRIGGER AS $$
DECLARE
    v_action audit_action_enum;
    v_tenant_id UUID;
    v_record_id UUID;
    v_old_data JSONB;
    v_new_data JSONB;
BEGIN
    -- Determine Action & Serialize Row Data
    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
        v_new_data := to_jsonb(NEW);
        v_old_data := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        v_new_data := to_jsonb(NEW);
        v_old_data := to_jsonb(OLD);
        
        -- Safely check for soft delete (if the table has a deleted_at column)
        IF (v_old_data ? 'deleted_at') AND (v_new_data ? 'deleted_at') THEN
            IF (v_old_data->>'deleted_at' IS NULL) AND (v_new_data->>'deleted_at' IS NOT NULL) THEN
                v_action := 'SOFT_DELETE';
            ELSE
                v_action := 'UPDATE';
            END IF;
        ELSE
            v_action := 'UPDATE';
        END IF;
    END IF;

    -- Dynamically extract record_id and tenant_id
    v_record_id := (v_new_data->>'id')::UUID;
    v_tenant_id := (v_new_data->>'tenant_id')::UUID;

    -- Insert into the immutable audit_logs table
    INSERT INTO public.audit_logs (
        tenant_id,
        user_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data
    ) VALUES (
        v_tenant_id,
        auth.uid(),
        TG_TABLE_NAME::TEXT,
        v_record_id,
        v_action,
        v_old_data,
        v_new_data
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Apply Trigger to Core Tables
-- Note: 'invoices' is used here to match the actual schema for 'sales'

DROP TRIGGER IF EXISTS tr_audit_items ON items;
CREATE TRIGGER tr_audit_items
    AFTER INSERT OR UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

DROP TRIGGER IF EXISTS tr_audit_invoices ON invoices;
CREATE TRIGGER tr_audit_invoices
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

DROP TRIGGER IF EXISTS tr_audit_parties ON parties;
CREATE TRIGGER tr_audit_parties
    AFTER INSERT OR UPDATE ON parties
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

DROP TRIGGER IF EXISTS tr_audit_tenant_members ON tenant_members;
CREATE TRIGGER tr_audit_tenant_members
    AFTER INSERT OR UPDATE ON tenant_members
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

