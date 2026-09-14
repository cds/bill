-- ============================================================
-- Phase 5.3: Fix Triggers and Backfill Users
-- ============================================================

-- 1. Update the handle_new_user trigger to populate Phase 5 tables
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id UUID;
  is_first_user BOOLEAN;
BEGIN
  -- Check if this is the very first user in the system
  SELECT NOT EXISTS (SELECT 1 FROM public.users) INTO is_first_user;

  -- 1. Insert into public.users
  INSERT INTO public.users (id, system_role)
  VALUES (NEW.id, CASE WHEN is_first_user THEN 'super_admin'::system_role_enum ELSE 'user'::system_role_enum END);

  -- 2. Insert a new tenant for the user
  INSERT INTO public.tenants (name, status)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Business', 'active')
  RETURNING id INTO new_tenant_id;

  -- 3. Add user as tenant_admin
  INSERT INTO public.tenant_members (user_id, tenant_id, role)
  VALUES (NEW.id, new_tenant_id, 'tenant_admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Backfill missing records for existing users
DO $$
DECLARE
  user_rec RECORD;
  new_tenant_id UUID;
BEGIN
  FOR user_rec IN SELECT id, email, raw_user_meta_data FROM auth.users
  LOOP
    -- A. Backfill public.users if missing
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = user_rec.id) THEN
      INSERT INTO public.users (id, system_role)
      VALUES (user_rec.id, 'super_admin'::system_role_enum); -- Make existing users super admins by default to fix access
    END IF;

    -- B. Backfill tenant and tenant_members if missing
    IF NOT EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = user_rec.id) THEN
      INSERT INTO public.tenants (name, status)
      VALUES (COALESCE(user_rec.raw_user_meta_data->>'full_name', split_part(user_rec.email, '@', 1)) || '''s Business', 'active')
      RETURNING id INTO new_tenant_id;

      INSERT INTO public.tenant_members (user_id, tenant_id, role)
      VALUES (user_rec.id, new_tenant_id, 'tenant_admin');
    END IF;
  END LOOP;
END $$;

