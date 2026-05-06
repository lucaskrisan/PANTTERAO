// @ts-nocheck
import { Variable } from "lucide-react";
import { Button } from "@/components/ui/button";

const VARIABLES = [
  { key: "{nome}", label: "Nome", description: "Nome do cliente" },
  { key: "{produto}", label: "Produto", description: "Nome do produto" },
  { key: "{valor}", label: "Valor", description: "Valor formatado" },
  { key: "{link}", label: "Link", description: "Link de acesso" },
  { key: "{telefone}", label: "Telefone", description: "Telefone do cliente" },
];

interface Props {
  onInsert: (variable: string) => void;
}

const VariableButtons = ({ onInsert }: Props) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Variable className="h-3.5 w-3.5 text-gold" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Inserir variável
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {VARIABLES.map((v) => (
          <Button
            key={v.key}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px] font-mono border-gold/20 hover:bg-gold/10 hover:text-gold hover:border-gold/40"
            onClick={() => onInsert(v.key)}
            title={v.description}
          >
            {v.key}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default VariableButtons;
