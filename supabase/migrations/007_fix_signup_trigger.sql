-- ============================================================
-- Phase 5.4: Fix Auth Signup Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id UUID;
  is_first_user BOOLEAN;
  safe_name TEXT;
BEGIN
  -- 1. Check if this is the very first user in the system
  SELECT NOT EXISTS (SELECT 1 FROM public.users) INTO is_first_user;

  -- 2. Safely determine a business name
  safe_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name', 
    split_part(NEW.email, '@', 1), 
    'New User'
  );

  -- 3. Insert into public.users safely (handle potential conflict if retried)
  INSERT INTO public.users (id, system_role)
  VALUES (NEW.id, CASE WHEN is_first_user THEN 'super_admin'::system_role_enum ELSE 'user'::system_role_enum END)
  ON CONFLICT (id) DO NOTHING;

  -- 4. Insert a new tenant for the user safely
  INSERT INTO public.tenants (name, status)
  VALUES (safe_name || '''s Business', 'active')
  RETURNING id INTO new_tenant_id;

  -- 5. Add user as tenant_admin safely
  INSERT INTO public.tenant_members (user_id, tenant_id, role)
  VALUES (NEW.id, new_tenant_id, 'tenant_admin')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, log it to Postgres logs but DO NOT block auth.users creation.
    -- Supabase will still create the user, but they won't have a tenant. 
    -- We can handle this gracefully in middleware by redirecting to /setup.
    RAISE WARNING 'handle_new_user trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

