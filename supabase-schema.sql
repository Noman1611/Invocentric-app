-- Supabase SQL Schema for Billcraft (Snake Case)

-- Users table (profiles)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  photo_url TEXT,
  status TEXT DEFAULT 'active',
  is_admin BOOLEAN DEFAULT false,
  business_name TEXT,
  business_address TEXT,
  business_phone TEXT,
  business_email TEXT,
  gst_number TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT 'INR',
  bank_name TEXT,
  account_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  owner_name TEXT,
  social_qr_url TEXT,
  backup_enabled BOOLEAN DEFAULT false,
  last_backup_at TIMESTAMPTZ,
  reminders_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items table
CREATE TABLE IF NOT EXISTS public.items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  category TEXT,
  stock INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  gst_number TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers ON DELETE SET NULL,
  customer_name TEXT,
  invoice_number TEXT NOT NULL,
  bill_type TEXT,
  date TEXT NOT NULL,
  due_date TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL NOT NULL,
  tax DECIMAL DEFAULT 0,
  discount DECIMAL DEFAULT 0,
  total DECIMAL NOT NULL,
  amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'unpaid',
  notes TEXT,
  currency TEXT DEFAULT 'INR',
  upi_url TEXT,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.invoices ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers ON DELETE SET NULL,
  amount DECIMAL NOT NULL,
  date TEXT NOT NULL,
  method TEXT,
  reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount DECIMAL NOT NULL,
  date TEXT NOT NULL,
  category TEXT,
  description TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create Policies safely using a block
DO $$
BEGIN
    -- Users policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own profile' AND tablename = 'users') THEN
        CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile' AND tablename = 'users') THEN
        CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
    END IF;

    -- Items policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can CRUD their own items' AND tablename = 'items') THEN
        CREATE POLICY "Users can CRUD their own items" ON public.items FOR ALL USING (auth.uid() = user_id);
    END IF;

    -- Customers policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can CRUD their own customers' AND tablename = 'customers') THEN
        CREATE POLICY "Users can CRUD their own customers" ON public.customers FOR ALL USING (auth.uid() = user_id);
    END IF;

    -- Invoices policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can CRUD their own invoices' AND tablename = 'invoices') THEN
        CREATE POLICY "Users can CRUD their own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id);
    END IF;

    -- Payments policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can CRUD their own payments' AND tablename = 'payments') THEN
        CREATE POLICY "Users can CRUD their own payments" ON public.payments FOR ALL USING (auth.uid() = user_id);
    END IF;

    -- Expenses policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can CRUD their own expenses' AND tablename = 'expenses') THEN
        CREATE POLICY "Users can CRUD their own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
