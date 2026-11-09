CREATE OR REPLACE FUNCTION public.reject_negative_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.current_stock < 0 AND NEW.current_stock < OLD.current_stock THEN
    RAISE EXCEPTION 'Insufficient server stock; cached stock is only an estimate.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_negative_stock ON public.items;
CREATE TRIGGER reject_negative_stock
  BEFORE UPDATE OF current_stock ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.reject_negative_stock();
