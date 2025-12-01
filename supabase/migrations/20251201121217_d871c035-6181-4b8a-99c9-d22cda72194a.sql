-- Create customers table
CREATE TABLE public.customers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  address JSONB NOT NULL,
  date_of_birth DATE NOT NULL,
  licence_number TEXT NOT NULL UNIQUE,
  licence_issuer TEXT NOT NULL,
  customer_since DATE NOT NULL DEFAULT CURRENT_DATE,
  policy_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (matching existing pattern)
CREATE POLICY "Allow public read access to customers"
  ON public.customers
  FOR SELECT
  USING (true);

-- Create policy for public insert
CREATE POLICY "Allow public insert on customers"
  ON public.customers
  FOR INSERT
  WITH CHECK (true);

-- Create policy for public update
CREATE POLICY "Allow public update on customers"
  ON public.customers
  FOR UPDATE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for common queries
CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_customers_licence ON public.customers(licence_number);
CREATE INDEX idx_customers_policy_ids ON public.customers USING GIN(policy_ids);