-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  currency TEXT DEFAULT '₹',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create business_members table linking users to businesses
CREATE TABLE IF NOT EXISTS business_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'staff')) DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, business_id)
);

-- ==========================================
-- Add business_id to all existing tables
-- ==========================================

-- 1. Create a System Default business for existing records
DO $$ 
DECLARE
  default_business_id UUID;
BEGIN
  -- Check if businesses table is empty, if so, create a default
  IF NOT EXISTS (SELECT 1 FROM businesses) THEN
    INSERT INTO businesses (id, name) VALUES (uuid_generate_v4(), 'System Default Business') RETURNING id INTO default_business_id;
  ELSE
    SELECT id INTO default_business_id FROM businesses LIMIT 1;
  END IF;

  -- Add columns if they don't exist, and set default for existing data
  
  -- items
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='business_id') THEN
    ALTER TABLE items ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
    UPDATE items SET business_id = default_business_id WHERE business_id IS NULL;
    ALTER TABLE items ALTER COLUMN business_id SET NOT NULL;
  END IF;

  -- parties
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parties' AND column_name='business_id') THEN
    ALTER TABLE parties ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
    UPDATE parties SET business_id = default_business_id WHERE business_id IS NULL;
    ALTER TABLE parties ALTER COLUMN business_id SET NOT NULL;
  END IF;

  -- invoices
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='business_id') THEN
    ALTER TABLE invoices ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
    UPDATE invoices SET business_id = default_business_id WHERE business_id IS NULL;
    ALTER TABLE invoices ALTER COLUMN business_id SET NOT NULL;
  END IF;

  -- invoice_items
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='business_id') THEN
    ALTER TABLE invoice_items ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
    UPDATE invoice_items SET business_id = default_business_id WHERE business_id IS NULL;
    ALTER TABLE invoice_items ALTER COLUMN business_id SET NOT NULL;
  END IF;

  -- stock_adjustments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_adjustments' AND column_name='business_id') THEN
    ALTER TABLE stock_adjustments ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
    UPDATE stock_adjustments SET business_id = default_business_id WHERE business_id IS NULL;
    ALTER TABLE stock_adjustments ALTER COLUMN business_id SET NOT NULL;
  END IF;

  -- expenses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='business_id') THEN
    ALTER TABLE expenses ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
    UPDATE expenses SET business_id = default_business_id WHERE business_id IS NULL;
    ALTER TABLE expenses ALTER COLUMN business_id SET NOT NULL;
  END IF;

END $$;

-- ==========================================
-- Triggers for auto-injecting business_id on insert
-- ==========================================

CREATE OR REPLACE FUNCTION set_default_business_id() RETURNS TRIGGER AS $$
DECLARE
  user_business_id UUID;
BEGIN
  IF NEW.business_id IS NULL THEN
    -- Get the first business the user belongs to
    SELECT business_id INTO user_business_id 
    FROM business_members 
    WHERE user_id = auth.uid() 
    LIMIT 1;

    -- Fallback to the system default if somehow running as service role or not mapped
    IF user_business_id IS NULL THEN
      SELECT id INTO user_business_id FROM businesses LIMIT 1;
    END IF;

    NEW.business_id := user_business_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to all tables
CREATE TRIGGER set_items_business_id BEFORE INSERT ON items FOR EACH ROW EXECUTE FUNCTION set_default_business_id();
CREATE TRIGGER set_parties_business_id BEFORE INSERT ON parties FOR EACH ROW EXECUTE FUNCTION set_default_business_id();
CREATE TRIGGER set_invoices_business_id BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION set_default_business_id();
CREATE TRIGGER set_invoice_items_business_id BEFORE INSERT ON invoice_items FOR EACH ROW EXECUTE FUNCTION set_default_business_id();
CREATE TRIGGER set_stock_adjustments_business_id BEFORE INSERT ON stock_adjustments FOR EACH ROW EXECUTE FUNCTION set_default_business_id();
CREATE TRIGGER set_expenses_business_id BEFORE INSERT ON expenses FOR EACH ROW EXECUTE FUNCTION set_default_business_id();

-- ==========================================
-- Row Level Security (RLS)
-- ==========================================

-- Helper function to get businesses a user belongs to
CREATE OR REPLACE FUNCTION user_business_ids()
RETURNS SETOF UUID AS $$
  SELECT business_id FROM business_members WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policies for businesses
CREATE POLICY "Users can view their own businesses" ON businesses FOR SELECT USING (id IN (SELECT user_business_ids()));
CREATE POLICY "Users can update their own businesses" ON businesses FOR UPDATE USING (id IN (SELECT user_business_ids()));

-- Policies for business_members
CREATE POLICY "Users can view their own memberships" ON business_members FOR SELECT USING (user_id = auth.uid());

-- Helper macro to generate policies
DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['items', 'parties', 'invoices', 'invoice_items', 'stock_adjustments', 'expenses'])
  LOOP
    EXECUTE format('CREATE POLICY "Users can view business %I" ON %I FOR SELECT USING (business_id IN (SELECT user_business_ids()))', t, t);
    EXECUTE format('CREATE POLICY "Users can insert business %I" ON %I FOR INSERT WITH CHECK (business_id IN (SELECT user_business_ids()))', t, t);
    EXECUTE format('CREATE POLICY "Users can update business %I" ON %I FOR UPDATE USING (business_id IN (SELECT user_business_ids()))', t, t);
    EXECUTE format('CREATE POLICY "Users can delete business %I" ON %I FOR DELETE USING (business_id IN (SELECT user_business_ids()))', t, t);
  END LOOP;
END $$;

-- ==========================================
-- Auth Trigger: Provision Business on Signup
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_business_id UUID;
BEGIN
  -- Insert a new business for the user
  INSERT INTO public.businesses (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Business')
  RETURNING id INTO new_business_id;

  -- Add user as owner
  INSERT INTO public.business_members (user_id, business_id, role)
  VALUES (NEW.id, new_business_id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

