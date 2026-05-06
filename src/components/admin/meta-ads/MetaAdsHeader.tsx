import { RefreshCw, Clock, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import type { MetaAccount } from "@/hooks/useMetaAds";

interface Props {
  accounts: MetaAccount[];
  selectedAccounts: string[];
  onToggleAccount: (id: string) => void;
  onSelectAll: () => void;
  datePreset: string;
  onDatePreset: (v: string) => void;
  customRange: { since: string; until: string } | null;
  onCustomRange: (r: { since: string; until: string }) => void;
  lastRefresh: Date | null;
  loading: boolean;
  onRefresh: () => void;
}

function timeAgo(date: Date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

export function MetaAdsHeader({
  accounts, selectedAccounts, onToggleAccount, onSelectAll,
  datePreset, onDatePreset, customRange, onCustomRange,
  lastRefresh, loading, onRefresh,
}: Props) {
  const allSelected = accounts.length > 0 && selectedAccounts.length === accounts.length;
  const label =
    selectedAccounts.length === 0
      ? "Selecione contas"
      : selectedAccounts.length === 1
        ? accounts.find((a) => a.id === selectedAccounts[0])?.name || "1 conta"
        : selectedAccounts.length === accounts.length
          ? "Todas as contas"
          : `${selectedAccounts.length} contas selecionadas`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Multi-account selector */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[280px] justify-between bg-[hsl(222,25%,16%)] border-slate-700/50 text-slate-200 hover:bg-slate-700/50 hover:text-slate-100"
          >
            <span className="truncate text-sm">{label}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-2 bg-[hsl(222,25%,16%)] border-slate-700/50" align="start">
          {/* Select all */}
          <div
            className="flex items-center gap-2 px-2 py-2 rounded hover:bg-slate-700/40 cursor-pointer border-b border-slate-700/30 mb-1"
            onClick={onSelectAll}
          >
            <Checkbox checked={allSelected} className="border-slate-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
            <span className="text-sm font-medium text-slate-200">Selecionar todas</span>
          </div>
          <div className="max-h-[240px] overflow-y-auto space-y-0.5">
            {accounts.map((acc) => {
              const checked = selectedAccounts.includes(acc.id);
              return (
                <div
                  key={acc.id}
                  className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition-colors ${
                    checked ? "bg-blue-500/10" : "hover:bg-slate-700/40"
                  }`}
                  onClick={() => onToggleAccount(acc.id)}
                >
                  <Checkbox
                    checked={checked}
                    className="border-slate-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{acc.name || acc.account_id}</p>
                    <p className="text-[10px] text-slate-500">{acc.currency}</p>
                  </div>
                  {checked && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Date preset */}
      <Select value={datePreset} onValueChange={onDatePreset}>
        <SelectTrigger className="w-[160px] bg-[hsl(222,25%,16%)] border-slate-700/50 text-slate-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[hsl(222,25%,16%)] border-slate-700/50">
          <SelectItem value="today" className="text-slate-200 focus:bg-slate-700/50 focus:text-slate-100">Hoje</SelectItem>
          <SelectItem value="yesterday" className="text-slate-200 focus:bg-slate-700/50 focus:text-slate-100">Ontem</SelectItem>
          <SelectItem value="last_7d" className="text-slate-200 focus:bg-slate-700/50 focus:text-slate-100">Últimos 7 dias</SelectItem>
          <SelectItem value="last_30d" className="text-slate-200 focus:bg-slate-700/50 focus:text-slate-100">Últimos 30 dias</SelectItem>
          <SelectItem value="custom" className="text-slate-200 focus:bg-slate-700/50 focus:text-slate-100">Personalizado</SelectItem>
        </SelectContent>
      </Select>

      {datePreset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-[140px] bg-[hsl(222,25%,16%)] border-slate-700/50 text-slate-200"
            value={customRange?.since || ""}
            onChange={(e) => onCustomRange({ since: e.target.value, until: customRange?.until || "" })}
          />
          <span className="text-slate-400 text-sm">até</span>
          <Input
            type="date"
            className="w-[140px] bg-[hsl(222,25%,16%)] border-slate-700/50 text-slate-200"
            value={customRange?.until || ""}
            onChange={(e) => onCustomRange({ since: customRange?.since || "", until: e.target.value })}
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {lastRefresh && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Atualizado {timeAgo(lastRefresh)}
          </span>
        )}
        <Button size="sm" onClick={onRefresh} disabled={loading} className="gap-1.5">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>
    </div>
  );
}
