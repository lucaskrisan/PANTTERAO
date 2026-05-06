import { memo } from "react";
import { RefreshCcw, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Period = "today" | "yesterday" | "7days" | "month" | "lastMonth" | "total";
export type Currency = "ALL" | "BRL" | "USD";

export const periodLabels: Record<Period, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7days": "Últimos 7 dias",
  month: "Mês atual",
  lastMonth: "Mês passado",
  total: "Total",
};

const currencyOptions: { value: Currency; label: string; symbol: string }[] = [
  { value: "ALL", label: "Todas as moedas", symbol: "∑" },
  { value: "BRL", label: "Real Brasileiro (BRL)", symbol: "R$" },
  { value: "USD", label: "US Dollar (USD)", symbol: "$" },
];

interface Props {
  period: Period;
  onPeriodChange: (p: Period) => void;
  selectedProductId: string;
  onProductChange: (id: string) => void;
  products: { id: string; name: string }[];
  liveVisitors: number;
  refreshing: boolean;
  onRefresh: () => void;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
}

const DashboardHeaderBar = memo(function DashboardHeaderBar({
  period,
  onPeriodChange,
  selectedProductId,
  onProductChange,
  products,
  liveVisitors,
  refreshing,
  onRefresh,
  currency,
  onCurrencyChange,
}: Props) {
  const activeCurrency = currencyOptions.find((c) => c.value === currency)!;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-white/[0.06] bg-card/70 backdrop-blur-sm text-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-foreground font-medium">{liveVisitors}</span>
          <span className="text-muted-foreground text-xs">visitantes ao vivo</span>
        </div>
        {/* Currency Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2.5 gap-1.5 border border-white/[0.06] bg-card/70 backdrop-blur-sm text-sm font-medium"
            >
              <DollarSign className="w-4 h-4" />
              <span className="font-mono text-xs">{activeCurrency.symbol}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
            {currencyOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => onCurrencyChange(opt.value)}
                className={`flex items-center gap-2 ${currency === opt.value ? "bg-muted font-medium" : ""}`}
              >
                <span className="text-sm font-mono w-5 text-center">{opt.symbol}</span>
                <span className="text-sm">{opt.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 border border-white/[0.06] bg-card/70 backdrop-blur-sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
        
        <Select value={period} onValueChange={(v) => onPeriodChange(v as Period)}>
          <SelectTrigger className="w-[150px] h-9 text-sm bg-card/70 backdrop-blur-sm border-white/[0.06]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(periodLabels) as Period[]).map((p) => (
              <SelectItem key={p} value={p}>
                {periodLabels[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedProductId} onValueChange={onProductChange}>
          <SelectTrigger className="w-[170px] h-9 text-sm bg-card/70 backdrop-blur-sm border-white/[0.06]">
            <SelectValue placeholder="Todos os produtos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
});

export default DashboardHeaderBar;
