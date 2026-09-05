-- ============================================================
-- Bill App — Seed Data
-- Eatera Foods sample data
-- ============================================================

-- Items (Snack/Food products)
INSERT INTO items (name, unit, sale_price, purchase_price, opening_stock, current_stock, low_stock_threshold) VALUES
  ('ABCD',             'Pcs', 10.00,  8.00,  100, 100, 10),
  ('Aloo Sev',         'Kg',  180.00, 150.00, 50,  50,  10),
  ('Bhavnagri Gathi',  'Kg',  220.00, 180.00, 30,  30,  5),
  ('Chana Dal',        'Kg',  160.00, 130.00, 75,  75,  15),
  ('Gathiya',          'Kg',  200.00, 165.00, 40,  40,  10),
  ('Khakhra Plain',    'Pcs', 25.00,  18.00,  200, 200, 20),
  ('Masala Peanuts',   'Kg',  240.00, 195.00, 35,  35,  8),
  ('Moong Dal',        'Kg',  190.00, 155.00, 60,  60,  12),
  ('Sev Mamra',        'Kg',  170.00, 140.00, 45,  45,  10),
  ('Tikha Chevdo',     'Kg',  210.00, 175.00, 55,  55,  10);

-- Create opening stock adjustments for each item
INSERT INTO stock_adjustments (item_id, type, quantity, unit_cost, notes)
SELECT id, 'opening', opening_stock, purchase_price, 'Opening stock'
FROM items;

-- Parties (Customers)
INSERT INTO parties (name, phone, address, type, balance) VALUES
  ('Rajesh Traders',     '9876543210', 'Shop No 12, Station Road, Bhavnagar',    'customer', 15000.00),
  ('Krishna Store',      '9876543211', 'Main Market, Rajkot',                     'customer', 8500.00),
  ('Patel Provision',    '9876543213', 'Ring Road, Ahmedabad',                    'customer', 0.00),
  ('Sharma General',     '9876543214', 'MG Road, Surat',                          'customer', 5200.00),
  ('Gupta Kirana',       '9876543215', 'Civil Lines, Vadodara',                   'customer', 0.00);

-- Parties (Suppliers)
INSERT INTO parties (name, phone, address, type, balance) VALUES
  ('Amit Wholesalers',   '9876543212', 'APMC Market, Rajkot',                     'supplier', -12000.00),
  ('Balaji Industries',  '9876543216', 'GIDC, Bhavnagar',                         'supplier', -8000.00),
  ('Mahesh Traders',     '9876543217', 'Grain Market, Ahmedabad',                 'supplier', 0.00);
