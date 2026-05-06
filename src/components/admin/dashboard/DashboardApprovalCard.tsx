import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Info, CheckCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RateItem {
  label: string;
  rate: number;
}

interface Props {
  items: RateItem[];
  chargebackValue?: string;
  chargebackCount?: number;
}

const DashboardApprovalCard = memo(function DashboardApprovalCard({ items, chargebackValue, chargebackCount }: Props) {
  return (
    <Card className="border border-white/[0.06] bg-card/70 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_2px_12px_-4px_rgba(0,0,0,0.4)] h-full">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <CardContent className="p-4 relative">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-foreground">
            {chargebackValue !== undefined ? "Chargeback / Aprovação" : "Taxa de Aprovação"}
          </h3>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground/40 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-xs">
                Percentual de aprovação por método de pagamento
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Chargeback value */}
        {chargebackValue !== undefined && (
          <div className="mb-4">
            <p className="text-2xl font-bold text-foreground">{chargebackValue}</p>
            {chargebackCount !== undefined && (
              <p className="text-[11px] text-muted-foreground/60">{chargebackCount} pedidos</p>
            )}
          </div>
        )}

        {/* Approval rates */}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-5 h-5 ${item.rate >= 80 ? "text-primary" : item.rate >= 50 ? "text-yellow-500" : "text-destructive"}`} />
                <span className="text-sm font-bold text-foreground">{item.rate.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

export default DashboardApprovalCard;
