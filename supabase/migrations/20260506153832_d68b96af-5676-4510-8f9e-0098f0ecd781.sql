-- Trigger to attribute sale when paid
CREATE OR REPLACE FUNCTION public.handle_order_attribution()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status IN ('paid', 'approved', 'completed') AND OLD.status NOT IN ('paid', 'approved', 'completed') AND NEW.collaborator_id IS NOT NULL) THEN
        INSERT INTO public.sales_recovery_attribution (order_id, collaborator_id, commission_amount, product_price)
        VALUES (NEW.id, NEW.collaborator_id, 0, NEW.amount) -- Amount will be calculated by the view/function
        ON CONFLICT (order_id) DO NOTHING;
        
        -- Mark recovery opportunity as recovered if exists
        UPDATE public.recovery_opportunities 
        SET status = 'recovered'
        WHERE reference_id = NEW.id AND type = 'pix' AND collaborator_id = NEW.collaborator_id;
        
        -- Also check if it was an abandoned cart recovery
        -- This is trickier since the order_id doesn't match the abandoned_cart.id
        -- But we have collaborator_id in the order, which is enough.
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_order_attribution
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_attribution();

-- Function to get monthly stats
CREATE OR REPLACE FUNCTION public.get_collaborator_monthly_stats(p_collaborator_id uuid, p_month timestamp with time zone)
RETURNS TABLE (
    sales_count bigint,
    base_commission numeric,
    bonus_meta numeric,
    total_earned numeric
) AS $$
DECLARE
    v_count bigint;
    v_total_base numeric := 0;
    v_bonus numeric := 0;
    v_record RECORD;
    v_rate_47 numeric;
    v_rate_67 numeric;
BEGIN
    -- Count sales
    SELECT count(*) INTO v_count
    FROM public.sales_recovery_attribution
    WHERE collaborator_id = p_collaborator_id
      AND date_trunc('month', created_at) = date_trunc('month', p_month);
      
    -- Determine rates and bonus
    IF v_count >= 150 THEN
        v_rate_47 := 15; v_rate_67 := 22; v_bonus := 3000;
    ELSIF v_count >= 100 THEN
        v_rate_47 := 12; v_rate_67 := 18; v_bonus := 1500;
    ELSIF v_count >= 50 THEN
        v_rate_47 := 10; v_rate_67 := 15; v_bonus := 500;
    ELSE
        v_rate_47 := 8; v_rate_67 := 12; v_bonus := 0;
    END IF;
    
    -- Calculate base commission (loop through sales to check prices)
    FOR v_record IN 
        SELECT product_price FROM public.sales_recovery_attribution
        WHERE collaborator_id = p_collaborator_id
          AND date_trunc('month', created_at) = date_trunc('month', p_month)
    LOOP
        IF v_record.product_price >= 60 THEN
            v_total_base := v_total_base + v_rate_67;
        ELSE
            v_total_base := v_total_base + v_rate_47;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_count, v_total_base, v_bonus, (v_total_base + v_bonus);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
