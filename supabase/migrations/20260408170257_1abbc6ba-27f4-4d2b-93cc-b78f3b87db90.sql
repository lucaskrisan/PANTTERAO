ALTER TABLE public.products ADD COLUMN currency text NOT NULL DEFAULT 'BRL';

-- Add check constraint for valid currencies
ALTER TABLE public.products ADD CONSTRAINT products_currency_check CHECK (currency IN ('BRL', 'USD'));