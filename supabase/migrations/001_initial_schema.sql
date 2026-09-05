-- ============================================================
-- Bill App — V1 Initial Schema
-- Eatera Foods SME Accounting & Billing
-- ============================================================

-- Items / Product Catalog
CREATE TABLE items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  unit                TEXT NOT NULL DEFAULT 'Pcs',
  sale_price          DECIMAL(12,2) NOT NULL DEFAULT 0,
  purchase_price      DECIMAL(12,2) NOT NULL DEFAULT 0,
  opening_stock       DECIMAL(12,3) NOT NULL DEFAULT 0,
  current_stock       DECIMAL(12,3) NOT NULL DEFAULT 0,
  low_stock_threshold DECIMAL(12,3) DEFAULT 10,
  hsn_code            TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Parties (Customers / Suppliers)
CREATE TABLE parties (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  billing_name TEXT,
  phone        TEXT,
  address      TEXT,
  type         TEXT NOT NULL DEFAULT 'customer' CHECK (type IN ('customer', 'supplier')),
  balance      DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Sale Invoices
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  SERIAL UNIQUE,
  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  party_id        UUID REFERENCES parties(id),
  party_name      TEXT NOT NULL,
  payment_type    TEXT NOT NULL DEFAULT 'cash' CHECK (payment_type IN ('cash', 'credit')),
  payment_method  TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'bank')),
  subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid     DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_due     DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice Line Items
CREATE TABLE invoice_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id          UUID REFERENCES items(id),
  item_name        TEXT NOT NULL,
  quantity         DECIMAL(12,3) NOT NULL,
  unit             TEXT NOT NULL DEFAULT 'Pcs',
  rate             DECIMAL(12,2) NOT NULL,
  tax_percent      DECIMAL(5,2) DEFAULT 0,
  tax_amount       DECIMAL(12,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount  DECIMAL(12,2) DEFAULT 0,
  amount           DECIMAL(12,2) NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Adjustments (tracks all stock movements)
CREATE TABLE stock_adjustments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES items(id),
  type         TEXT NOT NULL CHECK (type IN ('add', 'reduce', 'sale', 'purchase', 'opening')),
  quantity     DECIMAL(12,3) NOT NULL,
  unit_cost    DECIMAL(12,2),
  reference_id UUID,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses (schema created early for V2)
CREATE TABLE expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  category       TEXT NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'unpaid')),
  payment_mode   TEXT DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'bank', 'upi')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes for common queries
-- ============================================================
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_parties_type ON parties(type);
CREATE INDEX idx_parties_name ON parties(name);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_party ON invoices(party_id);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_stock_adjustments_item ON stock_adjustments(item_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);

-- ============================================================
-- Updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER parties_updated_at
  BEFORE UPDATE ON parties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
