-- Create customers table for searchable dropdown
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster search
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers USING gin (customer_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_code ON public.customers (customer_code);

-- Enable RLS (but allow public read for this demo)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read customers (for search functionality)
CREATE POLICY "Allow public read access on customers" ON public.customers
  FOR SELECT
  USING (true);

-- Insert sample customer data
INSERT INTO public.customers (customer_code, customer_name) VALUES
  ('C001', '株式会社山田製作所'),
  ('C002', '東京電機工業株式会社'),
  ('C003', '大阪商事株式会社'),
  ('C004', '名古屋物流センター'),
  ('C005', '福岡テクノロジーズ'),
  ('C006', '札幌ソリューションズ'),
  ('C007', '仙台エンジニアリング'),
  ('C008', '広島マニュファクチャリング'),
  ('C009', '神戸トレーディング'),
  ('C010', '横浜システムズ'),
  ('C011', '京都インダストリーズ'),
  ('C012', '千葉ロジスティクス'),
  ('C013', '埼玉メカトロニクス'),
  ('C014', '静岡プロダクツ'),
  ('C015', '新潟ファクトリー')
ON CONFLICT (customer_code) DO NOTHING;
