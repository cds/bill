-- Add date column to stock_adjustments to support backdating
ALTER TABLE stock_adjustments
ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Create an index on the new date column for faster querying
CREATE INDEX idx_stock_adjustments_date ON stock_adjustments(date);

