import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  label: string;
  value: string;
  sub?: string;
  sub2?: string;
  onClick?: () => void;
  accent?: boolean;
  tooltip?: string;
  icon?: any;
  dimmed?: boolean;
}

const DashboardMetricCard = memo(function DashboardMetricCard({ label, value, sub, sub2, onClick, accent, tooltip, dimmed }: Props) {
  return (
    <Card
      className={`border border-white/[0.06] bg-card/70 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_2px_12px_-4px_rgba(0,0,0,0.4)] h-full transition-all duration-200 ${onClick ? "cursor-pointer hover:bg-accent/50 hover:border-white/[0.1]" : ""} ${dimmed ? "opacity-50" : ""}`}
      onClick={onClick}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent rounded-t-xl" />
      <CardContent className="p-4 flex flex-col justify-between h-full relative">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
          {tooltip && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-muted-foreground/40 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className={`text-xl font-bold tracking-tight tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground/60 mt-1">{sub}</p>}
        {sub2 && <p className="text-[10px] text-muted-foreground/50 mt-0.5 tabular-nums">{sub2}</p>}
      </CardContent>
    </Card>
  );
});

export default DashboardMetricCard;
