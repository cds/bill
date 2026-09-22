-- Run this in Supabase SQL Editor to fully grant Super Admin powers and a default business to c.sangale@gmail.com

DO $$
DECLARE
  target_user_id UUID;
  new_tenant_id UUID;
BEGIN
  -- 1. Get the user ID for c.sangale@gmail.com
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'c.sangale@gmail.com';

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User c.sangale@gmail.com not found in auth.users!';
  END IF;

  -- 2. Ensure they are a super_admin in public.users
  INSERT INTO public.users (id, system_role)
  VALUES (target_user_id, 'super_admin')
  ON CONFLICT (id) DO UPDATE SET system_role = 'super_admin';

  -- 3. Check if they already have a tenant
  IF NOT EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = target_user_id) THEN
    -- Create a default tenant for them so they aren't stuck in /setup
    INSERT INTO public.tenants (name, status)
    VALUES ('Sangale Admin Business', 'active')
    RETURNING id INTO new_tenant_id;

    -- Add them to this tenant
    INSERT INTO public.tenant_members (user_id, tenant_id, role)
    VALUES (target_user_id, new_tenant_id, 'tenant_admin');
  END IF;

END $$;
