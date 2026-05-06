import type { MetaInsights } from "@/hooks/useMetaAds";

export function getResults(insights: MetaInsights | null): number {
  if (!insights?.actions) return 0;
  const purchase = insights.actions.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
  );
  if (purchase) return parseInt(purchase.value, 10);
  // Fallback: any lead/complete_registration
  const lead = insights.actions.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_lead" || a.action_type === "lead"
  );
  if (lead) return parseInt(lead.value, 10);
  // Fallback: link clicks
  const clicks = insights.actions.find((a) => a.action_type === "link_click");
  return clicks ? parseInt(clicks.value, 10) : 0;
}

export function getCPA(insights: MetaInsights | null): number {
  if (!insights?.cost_per_action_type) return 0;
  const cpa = insights.cost_per_action_type.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
  );
  return cpa ? parseFloat(cpa.value) : 0;
}

export function getROAS(insights: MetaInsights | null): number {
  if (!insights?.purchase_roas) return 0;
  const roas = insights.purchase_roas[0];
  return roas ? parseFloat(roas.value) : 0;
}

export function getConversionValue(insights: MetaInsights | null): number {
  if (!insights?.action_values) return 0;
  const purchase = insights.action_values.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
  );
  return purchase ? parseFloat(purchase.value) : 0;
}

export function getROI(insights: MetaInsights | null): number {
  const revenue = getConversionValue(insights);
  const spend = parseFloat(insights?.spend || "0");
  if (spend <= 0 || revenue <= 0) return 0;
  return ((revenue - spend) / spend) * 100;
}

export function formatCurrency(value: string | number, decimals = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  return `R$ ${num.toFixed(decimals).replace(".", ",")}`;
}

export function formatNumber(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString("pt-BR");
}

export function formatPercent(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0%";
  return `${num.toFixed(2).replace(".", ",")}%`;
}

export function formatBudget(daily?: string, lifetime?: string): string {
  if (daily && daily !== "0") return `${formatCurrency(parseInt(daily, 10) / 100)}/dia`;
  if (lifetime && lifetime !== "0") return `${formatCurrency(parseInt(lifetime, 10) / 100)} total`;
  return "—";
}
