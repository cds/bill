// ============================================================
// Bill App — Database Types
// Hand-written types matching the Supabase schema
// ============================================================

export type Item = {
  id: string;
  name: string;
  unit: string;
  sale_price: number;
  purchase_price: number;
  opening_stock: number;
  current_stock: number;
  low_stock_threshold: number;
  hsn_code: string | null;
  created_at: string;
  updated_at: string;
};

export type InsertItem = Omit<Item, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type UpdateItem = Partial<InsertItem>;

export type Party = {
  id: string;
  name: string;
  billing_name: string | null;
  phone: string | null;
  address: string | null;
  type: 'customer' | 'supplier';
  balance: number;
  created_at: string;
  updated_at: string;
};

export type InsertParty = Omit<Party, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type UpdateParty = Partial<InsertParty>;

export type Invoice = {
  id: string;
  invoice_number: number;
  invoice_date: string;
  party_id: string | null;
  party_name: string;
  payment_type: 'cash' | 'credit';
  payment_method: 'cash' | 'upi' | 'bank';
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InsertInvoice = Omit<Invoice, 'id' | 'invoice_number' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  tax_percent: number;
  tax_amount: number;
  discount_percent: number;
  discount_amount: number;
  amount: number;
  created_at: string;
};

export type InsertInvoiceItem = Omit<InvoiceItem, 'id' | 'created_at'> & {
  id?: string;
};

export type StockAdjustment = {
  id: string;
  item_id: string;
  type: 'add' | 'reduce' | 'sale' | 'purchase' | 'opening';
  quantity: number;
  date: string;
  unit_cost: number | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
};

export type InsertStockAdjustment = Omit<StockAdjustment, 'id' | 'created_at'> & {
  id?: string;
};

export type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  payment_status: 'paid' | 'unpaid';
  payment_mode: 'cash' | 'bank' | 'upi';
  notes: string | null;
  created_at: string;
};

export type InsertExpense = Omit<Expense, 'id' | 'created_at'> & {
  id?: string;
};

// Invoice with line items joined
export type InvoiceWithItems = Invoice & {
  invoice_items: InvoiceItem[];
};

// Dashboard summary types
export type DashboardStats = {
  totalSalesToday: number;
  totalReceivables: number;
  totalPayables: number;
  totalItems: number;
  totalStockValue: number;
  lowStockItems: Item[];
};
