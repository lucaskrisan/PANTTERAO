import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Calculator, Target, Flame, ShieldAlert, TrendingUp, DollarSign,
} from "lucide-react";

interface Props {
  currentCPA?: number;
  currentROAS?: number;
}

function fmt(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

export function MetaBudgetCalculator({ currentCPA }: Props) {
  const [cpaMeta, setCpaMeta] = useState(currentCPA ? Math.round(currentCPA) : 30);
  const [numCreatives, setNumCreatives] = useState(3);
  const [testDays, setTestDays] = useState(3);
  const [productPrice, setProductPrice] = useState(197);

  const calc = useMemo(() => {
    // Kill rule: gasto máximo por criativo antes de pausar = 2x CPA meta
    const killRulePerCreative = cpaMeta * 2;

    // Orçamento diário por criativo = kill rule / dias de teste
    const dailyPerCreative = killRulePerCreative / testDays;

    // Orçamento diário total
    const dailyTotal = dailyPerCreative * numCreatives;

    // Orçamento total do teste
    const totalBudget = dailyTotal * testDays;

    // Breakeven ROAS
    const breakevenROAS = cpaMeta / productPrice;
    const idealROAS = breakevenROAS * 2;

    // Escala: após winner, orçamento sugerido
    const scaleBudget = dailyPerCreative * 3; // 3x o orçamento do teste para o winner

    // Regra dos 20%
    const maxDailyIncrease = dailyTotal * 0.2;

    return {
      killRulePerCreative,
      dailyPerCreative,
      dailyTotal,
      totalBudget,
      breakevenROAS,
      idealROAS,
      scaleBudget,
      maxDailyIncrease,
    };
  }, [cpaMeta, numCreatives, testDays, productPrice]);

  return (
    <Card className="bg-[hsl(222,30%,14%)] border-slate-700/50">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-bold text-slate-200">AntonyAD — Calculador de Orçamento de Teste</h3>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div>
            <Label className="text-[11px] text-slate-500 mb-1 block">💰 CPA Meta (R$)</Label>
            <Input
              type="number"
              value={cpaMeta}
              onChange={(e) => setCpaMeta(Math.max(1, Number(e.target.value)))}
              className="bg-slate-800/50 border-slate-700 text-slate-200 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-[11px] text-slate-500 mb-1 block">🎨 Criativos p/ testar</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[numCreatives]}
                onValueChange={([v]) => setNumCreatives(v)}
                min={1}
                max={10}
                step={1}
                className="flex-1"
              />
              <span className="text-sm font-bold text-slate-200 w-6 text-center">{numCreatives}</span>
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-slate-500 mb-1 block">📅 Dias de teste</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[testDays]}
                onValueChange={([v]) => setTestDays(v)}
                min={1}
                max={7}
                step={1}
                className="flex-1"
              />
              <span className="text-sm font-bold text-slate-200 w-6 text-center">{testDays}</span>
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-slate-500 mb-1 block">🏷️ Preço do produto (R$)</Label>
            <Input
              type="number"
              value={productPrice}
              onChange={(e) => setProductPrice(Math.max(1, Number(e.target.value)))}
              className="bg-slate-800/50 border-slate-700 text-slate-200 h-9 text-sm"
            />
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <ResultCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Orçamento diário"
            value={fmt(calc.dailyTotal)}
            sub={`${fmt(calc.dailyPerCreative)}/criativo`}
            color="blue"
          />
          <ResultCard
            icon={<Target className="w-4 h-4" />}
            label="Orçamento total"
            value={fmt(calc.totalBudget)}
            sub={`${testDays} dias de teste`}
            color="emerald"
          />
          <ResultCard
            icon={<ShieldAlert className="w-4 h-4" />}
            label="Kill rule"
            value={fmt(calc.killRulePerCreative)}
            sub="Máx. gasto/criativo"
            color="red"
          />
          <ResultCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Escala (winner)"
            value={fmt(calc.scaleBudget)}
            sub="Orç. diário p/ escalar"
            color="amber"
          />
        </div>

        {/* Strategy summary */}
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30 space-y-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-300">Estratégia AntonyAD</span>
          </div>
          <div className="grid gap-1.5 text-[11px] text-slate-400">
            <p>
              📌 <span className="text-slate-300">Fase 1 (Teste):</span> Invista {fmt(calc.dailyTotal)}/dia dividido em {numCreatives} criativos por {testDays} dias. Total: {fmt(calc.totalBudget)}.
            </p>
            <p>
              🛑 <span className="text-slate-300">Kill rule:</span> Se um criativo gastar {fmt(calc.killRulePerCreative)} sem venda, pause imediatamente.
            </p>
            <p>
              🏆 <span className="text-slate-300">Fase 2 (Winner):</span> Criativo com ROAS {">"} {calc.idealROAS.toFixed(2)}x após {testDays} dias → escale para {fmt(calc.scaleBudget)}/dia.
            </p>
            <p>
              📈 <span className="text-slate-300">Regra dos 20%:</span> Nunca aumente mais que {fmt(calc.maxDailyIncrease)}/dia de uma vez. Escale em degraus a cada 48h.
            </p>
            <p>
              ⚖️ <span className="text-slate-300">Breakeven:</span> ROAS mínimo de {calc.breakevenROAS.toFixed(2)}x para não perder dinheiro (CPA {fmt(cpaMeta)} ÷ Preço {fmt(productPrice)}).
            </p>
          </div>
        </div>

        <p className="text-[10px] text-slate-600 mt-3">🤖 AntonyAD — Calculado com base no seu CPA meta e regras de gestão profissional</p>
      </CardContent>
    </Card>
  );
}

function ResultCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`${c.bg} border ${c.border} rounded-lg p-3`}>
      <div className={`flex items-center gap-1.5 mb-1 ${c.text}`}>
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <p className="text-base font-bold text-slate-200">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}
