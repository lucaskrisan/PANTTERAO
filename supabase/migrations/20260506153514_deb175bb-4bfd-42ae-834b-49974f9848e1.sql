-- Table to track claimed opportunities
CREATE TABLE public.recovery_opportunities (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL CHECK (type IN ('pix', 'abandoned_cart')),
    reference_id uuid NOT NULL,
    collaborator_id uuid REFERENCES auth.users(id),
    claimed_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'claimed' CHECK (status IN ('claimed', 'recovered', 'expired', 'lost')),
    created_at timestamp with time zone DEFAULT now()
);

-- Index for performance
CREATE INDEX idx_recovery_opportunities_ref ON public.recovery_opportunities(reference_id, type);
CREATE INDEX idx_recovery_opportunities_collab ON public.recovery_opportunities(collaborator_id);

-- Payout requests
CREATE TABLE public.collaborator_payout_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    collaborator_id uuid REFERENCES auth.users(id) NOT NULL,
    amount numeric NOT NULL,
    pix_key text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
    processed_at timestamp with time zone,
    processed_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

-- Add pix_key to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key text;

-- Attribution table for sales
CREATE TABLE public.sales_recovery_attribution (
    order_id uuid REFERENCES public.orders(id) PRIMARY KEY,
    collaborator_id uuid REFERENCES auth.users(id) NOT NULL,
    commission_amount numeric NOT NULL,
    product_price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recovery_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_recovery_attribution ENABLE ROW LEVEL SECURITY;

-- Policies for recovery_opportunities
CREATE POLICY "Collaborators can view all unclaimed opportunities"
ON public.recovery_opportunities FOR SELECT
USING (true);

CREATE POLICY "Collaborators can claim opportunities"
ON public.recovery_opportunities FOR INSERT
WITH CHECK (auth.uid() = collaborator_id);

CREATE POLICY "Collaborators can update their own claims"
ON public.recovery_opportunities FOR UPDATE
USING (auth.uid() = collaborator_id);

-- Policies for payout requests
CREATE POLICY "Collaborators can view their own requests"
ON public.collaborator_payout_requests FOR SELECT
USING (auth.uid() = collaborator_id);

CREATE POLICY "Collaborators can create their own requests"
ON public.collaborator_payout_requests FOR INSERT
WITH CHECK (auth.uid() = collaborator_id);

CREATE POLICY "Admins can view all requests"
ON public.collaborator_payout_requests FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
));

CREATE POLICY "Admins can update requests"
ON public.collaborator_payout_requests FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
));

-- Policies for attribution
CREATE POLICY "Collaborators can view their own attribution"
ON public.sales_recovery_attribution FOR SELECT
USING (auth.uid() = collaborator_id);

CREATE POLICY "Admins can view all attribution"
ON public.sales_recovery_attribution FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
));
