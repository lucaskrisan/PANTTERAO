// @ts-nocheck
import { useMemo, useState, useCallback } from "react";
import { GlobePulse } from "@/components/ui/cobe-globe-pulse";

const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá",
  BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco",
  PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina",
  SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

const STATE_COORDS: Record<string, [number, number]> = {
  AC: [-9.9747, -67.8100], AL: [-9.6658, -35.7353], AM: [-3.1190, -60.0217],
  AP: [0.0349, -51.0694], BA: [-12.9714, -38.5124], CE: [-3.7172, -38.5433],
  DF: [-15.7975, -47.8919], ES: [-20.3155, -40.3128], GO: [-16.6869, -49.2648],
  MA: [-2.5297, -44.2825], MG: [-19.9167, -43.9345], MS: [-20.4697, -54.6201],
  MT: [-15.5960, -56.0969], PA: [-1.4558, -48.5024], PB: [-7.1195, -34.8450],
  PE: [-8.0476, -34.8770], PI: [-5.0892, -42.8019], PR: [-25.4284, -49.2733],
  RJ: [-22.9068, -43.1729], RN: [-5.7945, -35.2110], RO: [-8.7612, -63.9004],
  RR: [2.8195, -60.6714], RS: [-30.0346, -51.2177], SC: [-27.5954, -48.5480],
  SE: [-10.9091, -37.0677], SP: [-23.5505, -46.6333], TO: [-10.1689, -48.3317],
};

interface BrazilMapProps {
  salesByState: Record<string, { count: number; revenue: number }>;
}

const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

const BrazilMap = ({ salesByState }: BrazilMapProps) => {
  const [selected, setSelected] = useState<string | null>(null);

  const markers = useMemo(() => {
    return Object.entries(salesByState)
      .filter(([uf]) => STATE_COORDS[uf])
      .map(([uf, data], i) => ({
        id: uf.toLowerCase(),
        location: STATE_COORDS[uf],
        label: `${uf}: ${data.count} vendas`,
        delay: (i * 0.3) % 2,
      }));
  }, [salesByState]);

  const handleMarkerClick = useCallback((markerId: string) => {
    setSelected((prev) => (prev === markerId ? null : markerId));
  }, []);

  const selectedData = selected ? salesByState[selected.toUpperCase()] : null;
  const selectedUF = selected?.toUpperCase() || "";

  const sortedStates = useMemo(() => {
    return Object.entries(salesByState)
      .filter(([uf]) => STATE_COORDS[uf])
      .sort((a, b) => b[1].count - a[1].count);
  }, [salesByState]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[360px]">
        <GlobePulse
          markers={markers}
          className="w-full"
          baseColor={[0.12, 0.14, 0.18]}
          markerColor={[0.2, 0.85, 0.45]}
          glowColor={[0.05, 0.15, 0.08]}
          dark={1}
          mapBrightness={6}
          theta={0.3}
          speed={0.002}
          pulseColor="#22c55e"
          onMarkerClick={handleMarkerClick}
        />
      </div>

      {selectedData && (
        <div className="bg-card border border-primary/30 rounded-lg px-4 py-3 text-center shadow-lg shadow-primary/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p className="text-xs text-muted-foreground">{STATE_NAMES[selectedUF] || selectedUF}</p>
          <p className="text-lg font-bold text-foreground">{selectedData.count} vendas</p>
          <p className="text-sm text-primary font-medium">{fmt(selectedData.revenue)}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 justify-center max-w-[360px]">
        {sortedStates.map(([uf, data]) => (
          <button
            key={uf}
            onClick={() => setSelected((prev) => (prev === uf.toLowerCase() ? null : uf.toLowerCase()))}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer border ${
              selected === uf.toLowerCase()
                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
            }`}
          >
            {uf} · {data.count}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Arraste para girar • Clique no estado para detalhes
      </p>
    </div>
  );
};

export default BrazilMap;
