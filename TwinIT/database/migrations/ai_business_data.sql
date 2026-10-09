-- TwinIT AI analyst: historical business data tables.
-- Run this in Supabase SQL Editor after the existing TwinIT schema.
-- These tables deliberately avoid storing customer PII by default.

CREATE TABLE IF NOT EXISTS public.business_monthly_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  revenue numeric(14,2) NOT NULL DEFAULT 0 CHECK (revenue >= 0),
  expenses numeric(14,2) NOT NULL DEFAULT 0 CHECK (expenses >= 0),
  customers_count integer CHECK (customers_count IS NULL OR customers_count >= 0),
  orders_count integer CHECK (orders_count IS NULL OR orders_count >= 0),
  marketing_spend numeric(14,2) CHECK (marketing_spend IS NULL OR marketing_spend >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, month_start)
);

CREATE TABLE IF NOT EXISTS public.business_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  transaction_type text NOT NULL CHECK (transaction_type IN ('sale','refund','purchase','other')),
  category text NOT NULL DEFAULT 'uncategorized',
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  quantity numeric(12,3) CHECK (quantity IS NULL OR quantity >= 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  sku text,
  selling_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  unit_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  stock_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reorder_level numeric(12,3) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, sku)
);

CREATE TABLE IF NOT EXISTS public.business_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  occurred_on date NOT NULL DEFAULT current_date,
  category text NOT NULL DEFAULT 'uncategorized',
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  vendor text,
  is_recurring boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_monthly_metrics_user_business_month_idx
  ON public.business_monthly_metrics (user_id, business_id, month_start DESC);
CREATE INDEX IF NOT EXISTS business_transactions_user_business_date_idx
  ON public.business_transactions (user_id, business_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS business_products_user_business_idx
  ON public.business_products (user_id, business_id, name);
CREATE INDEX IF NOT EXISTS business_expenses_user_business_date_idx
  ON public.business_expenses (user_id, business_id, occurred_on DESC);

ALTER TABLE public.business_monthly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own monthly metrics" ON public.business_monthly_metrics;
CREATE POLICY "Users manage own monthly metrics" ON public.business_monthly_metrics
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users manage own transactions" ON public.business_transactions;
CREATE POLICY "Users manage own transactions" ON public.business_transactions
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users manage own products" ON public.business_products;
CREATE POLICY "Users manage own products" ON public.business_products
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users manage own expenses" ON public.business_expenses;
CREATE POLICY "Users manage own expenses" ON public.business_expenses
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = (SELECT auth.uid())
  ));
