import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Code2, ClipboardCopy, CheckCircle2, Megaphone, Globe, Loader2,
  Search, AlertTriangle, XCircle, Link2,
} from "lucide-react";
import { toast } from "sonner";

interface PixelInfo {
  product_id: string;
  product_name: string;
  pixel_id: string;
  domain: string | null;
  platform: string;
}

interface Props {
  pixels: PixelInfo[];
  products: { id: string; name: string }[];
  checkoutBaseUrl: string;
  selectedProductId?: string;
  onProductChange?: (id: string) => void;
}

interface HealthCheck {
  name: string;
  status: "pass" | "warning" | "error";
  detail: string;
}

const UTM_TEMPLATE = `utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}`;

export default function TrackingScriptGenerator({
  pixels, products, checkoutBaseUrl, selectedProductId, onProductChange,
}: Props) {
  const [internalSelected, setInternalSelected] = useState(products[0]?.id || "");
  const selectedProduct = selectedProductId ?? internalSelected;
  const setSelectedProduct = onProductChange ?? setInternalSelected;

  const [landingUrl, setLandingUrl] = useState("");
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<{
    summary: { total: number; passed: number; warnings: number; errors: number };
    checks: HealthCheck[];
  } | null>(null);

  const productPixels = useMemo(
    () => pixels.filter((p) => p.product_id === selectedProduct && p.platform === "facebook"),
    [pixels, selectedProduct]
  );

  const selectedProductName = products.find((p) => p.id === selectedProduct)?.name || "";

  const SUPABASE_URL = `https://vipltojtcrqatwvzobro.supabase.co`;
  const SUPABASE_ANON_KEY = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcGx0b2p0Y3JxYXR3dnpvYnJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTk4MTAsImV4cCI6MjA4ODY3NTgxMH0.rBq_Vw5aD_hPGpgDoatr2STFkxe_E4fLTX5Hot_MoMU`;

  const generatedScript = useMemo(() => {
    if (!selectedProduct || productPixels.length === 0) return "";
    const pixelInits = productPixels
      .map((p) => `    fbq('set','autoConfig',false,'${p.pixel_id}');\n    fbq('init','${p.pixel_id}');`)
      .join("\n");
    // Sempre usar CDN oficial da Meta. First-party pixel proxy exige infra dedicada
    // (Worker servindo /en_US/fbevents.js) que não existe na arquitetura atual.
    const fbSrc = "https://connect.facebook.net/en_US/fbevents.js";

    return `<!-- PanteraPay Tracking · ${selectedProductName} -->
<script>
(function(){
  // === Guard anti-loop: só bloqueia o fbq('init') (proibido duplicar por Meta) ===
  // Eventos individuais (PageView/ViewContent) podem ser re-disparados via window.pcTrack() em SPAs
  if(window.__pcTrackingFired) return;
  window.__pcTrackingFired = true;

  // === 1. Meta Pixel ===
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
  n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window,document,'script',
  '${fbSrc}');

${pixelInits}

  // === Captura fbclid/fbc/fbp ANTES dos disparos (Meta best practice) ===
  var ps=new URLSearchParams(location.search);
  function getRawParam(name){
    var m=location.search.substring(1).match(new RegExp('(?:^|&)'+name+'=([^&]*)'));
    return m?m[1]:null;
  }
  var fbclid=getRawParam('fbclid');

  // fbclid → _fbc cookie no formato oficial Meta: fb.1.{timestamp}.{fbclid}
  if(fbclid && !document.cookie.match(/(^|;\\s*)_fbc=/)){
    var fbc='fb.1.'+Date.now()+'.'+fbclid;
    document.cookie='_fbc='+fbc+';max-age=7776000;path=/;SameSite=Lax';
  }
  // Purga _fbc se >90 dias (Meta rejeita)
  var existFbc=(document.cookie.match(/(^|;\\s*)_fbc=([^;]*)/)||[])[2];
  if(existFbc){var fbcTs=parseInt((existFbc.split('.')||[])[2],10);if(fbcTs&&(Date.now()-fbcTs)>7776000000){document.cookie='_fbc=;max-age=0;path=/';existFbc=null;}}

  // _fbp cookie
  var fbpCk=(document.cookie.match(/(^|;\\s*)_fbp=([^;]*)/)||[])[2];
  if(!fbpCk){fbpCk='fb.1.'+Date.now()+'.'+Math.floor(1e9+Math.random()*9e9);document.cookie='_fbp='+fbpCk+';max-age=33696000;path=/;SameSite=Lax';}

  var fbcCk=(document.cookie.match(/(^|;\\s*)_fbc=([^;]*)/)||[])[2]||null;

  // Visitor ID (matching cross-evento)
  var vid=(document.cookie.match(/(^|;\\s*)_vid=([^;]*)/)||[])[2];
  if(!vid){
    // Also try to read from URL params (vid or _abv from A/B tests)
    vid = ps.get('vid') || ps.get('_abv');
    if(!vid || (!vid.startsWith('v_') && !vid.match(/^[0-9a-f-]{36}$/i))) {
      vid='v_'+Date.now()+'_'+Math.random().toString(36).slice(2,12);
    }
    document.cookie='_vid='+vid+';max-age=33696000;path=/;SameSite=Lax';
  }

  // === Captura UTMs (compartilhado entre Pixel + CAPI) ===
  var utms={};
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){
    var v=ps.get(k); if(v) utms[k]=v;
  });
  if(Object.keys(utms).length) sessionStorage.setItem('pc_utms',JSON.stringify(utms));
  // Também recupera UTMs salvas em PageViews anteriores
  try{var savedUtms=JSON.parse(sessionStorage.getItem('pc_utms')||'{}');for(var uk in savedUtms){if(!utms[uk])utms[uk]=savedUtms[uk];}}catch(e){}

  // === User-Agent travado (mesma string em Pixel browser e CAPI server p/ dedup) ===
  var UA=navigator.userAgent;

  // === window.pcTrack(): permite SPAs re-disparar em troca de rota ===
  // Não chama fbq('init') de novo (proibido por Meta) — só fbq('track', ...)
  window.pcTrack=function(eventName, customData){
    if(typeof eventName!=='string'||!window.fbq) return;
    var evtId=eventName.toLowerCase().slice(0,3)+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
    var data=customData||{};
    try{ fbq('track', eventName, data, {eventID:evtId}); }catch(e){}
    var fbcNow=(document.cookie.match(/(^|;\\s*)_fbc=([^;]*)/)||[])[2]||null;
    var fbpNow=(document.cookie.match(/(^|;\\s*)_fbp=([^;]*)/)||[])[2]||null;
    var payload={
      event_name:eventName, event_id:evtId,
      product_id:'${selectedProduct}',
      event_source_url:location.href,
      visitor_id:vid, user_agent:UA,
      action_source:'website',
      fbp:fbpNow||null,
      custom_data:Object.assign({}, utms, data)
    };
    if(fbcNow) payload.fbc=fbcNow;
    fetch('${SUPABASE_URL}/functions/v1/facebook-capi',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':'${SUPABASE_ANON_KEY}'},
      body:JSON.stringify(payload)
    }).catch(function(){});
  };

  // === IDs de evento para deduplicação Pixel ↔ CAPI ===
  var pvId='pv_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
  var vcId='vc_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);

  // === Disparos Pixel (Browser) com eventID ===
  fbq('track','PageView',{},{eventID:pvId});
  fbq('track','ViewContent',{content_type:'product',content_ids:['${selectedProduct}']},{eventID:vcId});

  // === Disparos CAPI (Server) com mesmo eventID + UTMs em custom_data ===
  var capiUrl='${SUPABASE_URL}/functions/v1/facebook-capi';
  var commonParams={
    product_id:'${selectedProduct}',
    event_source_url:location.href,
    visitor_id:vid,
    user_agent:UA,
    action_source:'website',
    fbp:fbpCk||null,
    log_browser:true
  };
  if(fbcCk) commonParams.fbc=fbcCk;

  fetch(capiUrl,{
    method:'POST',headers:{'Content-Type':'application/json','apikey':'${SUPABASE_ANON_KEY}'},
    body:JSON.stringify(Object.assign({},commonParams,{
      event_name:'PageView', event_id:pvId,
      custom_data:Object.assign({}, utms)
    }))
  }).catch(function(){});

  fetch(capiUrl,{
    method:'POST',headers:{'Content-Type':'application/json','apikey':'${SUPABASE_ANON_KEY}'},
    body:JSON.stringify(Object.assign({},commonParams,{
      event_name:'ViewContent', event_id:vcId,
      custom_data:Object.assign({content_type:'product',content_ids:['${selectedProduct}']}, utms)
    }))
  }).catch(function(){});

  // === goToCheckout — propaga UTMs + fbc + fbp + vid ===
  window.goToCheckout=function(configId){
    var base='${checkoutBaseUrl}/checkout/${selectedProduct}';
    var q=[];
    var saved=sessionStorage.getItem('pc_utms');
    if(saved){try{var u=JSON.parse(saved);for(var k in u)q.push(k+'='+encodeURIComponent(u[k]))}catch(e){}}
    var m=document.cookie.match(/(^|;\\s*)_fbc=([^;]*)/);
    if(m) q.push('fbc='+encodeURIComponent(m[2]));
    var m2=document.cookie.match(/(^|;\\s*)_fbp=([^;]*)/);
    if(m2) q.push('fbp='+encodeURIComponent(m2[2]));
    if(vid) q.push('vid='+encodeURIComponent(vid));
    if(configId) q.push('config='+encodeURIComponent(configId));
    location.href=base+(q.length?'?'+q.join('&'):'');
  };

  // === Auto-patch de links ===
  document.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('a[href*="/checkout/${selectedProduct}"]').forEach(function(a){
      a.addEventListener('click',function(e){
        e.preventDefault();
        var url=new URL(a.href);
        var cid=url.searchParams.get('config')||'';
        goToCheckout(cid);
      });
    });
  });
})();
</script>`;
  }, [selectedProduct, productPixels, selectedProductName, checkoutBaseUrl]);

  const copyScript = () => { navigator.clipboard.writeText(generatedScript); toast.success("Script copiado!"); };
  const copyUtm = () => { navigator.clipboard.writeText(UTM_TEMPLATE); toast.success("Parâmetros UTM copiados!"); };

  const runHealthCheck = async () => {
    const url = landingUrl.trim();
    if (!url) { toast.error("Cole a URL da landing"); return; }
    if (!url.startsWith("http")) { toast.error("URL deve começar com http(s)://"); return; }
    if (!selectedProduct) { toast.error("Selecione um produto primeiro"); return; }

    setHealthChecking(true);
    setHealthResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("landing-health-check", {
        body: {
          url,
          product_id: selectedProduct,
          pixel_id: productPixels[0]?.pixel_id || null,
        },
      });
      if (error) throw new Error(error.message || "Falha ao verificar landing");
      if (data?.error && !data.checks) throw new Error(data.error);
      setHealthResult({ summary: data.summary, checks: data.checks });
      const { errors, warnings, passed } = data.summary;
      if (errors > 0) toast.error(`${errors} erro(s), ${warnings} aviso(s), ${passed} OK`);
      else if (warnings > 0) toast.warning(`${warnings} aviso(s), ${passed} OK`);
      else toast.success(`Landing 100% conforme! ${passed} verificações OK 🎯`);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Tente novamente"));
    } finally {
      setHealthChecking(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "pass": return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "warning": return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case "error": return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-3">
      {/* UTM Template */}
      <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-2.5">
          <Megaphone className="w-4 h-4 text-amber-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Parâmetros UTM para Meta Ads</h2>
            <p className="text-[10px] text-slate-500">Cole no campo "Parâmetros de URL" do Gerenciador</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="relative">
            <pre className="bg-slate-900/60 border border-slate-700/30 rounded-md p-3 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
              {UTM_TEMPLATE}
            </pre>
            <Button size="sm" variant="outline" className="absolute top-1.5 right-1.5 gap-1 text-[10px] h-6 bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700" onClick={copyUtm}>
              <ClipboardCopy className="w-3 h-3" /> Copiar
            </Button>
          </div>
          <p className="text-[10px] text-slate-500">
            ✅ Captura: source, campaign (nome|id), medium (conjunto|id), content (anúncio|id) e placement.
          </p>
        </div>
      </div>

      {/* Script Generator */}
      <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-2.5">
          <Code2 className="w-4 h-4 text-cyan-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Script de Integração</h2>
            <p className="text-[10px] text-slate-500">Cole antes do &lt;/body&gt; na sua landing page</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {products.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhum pixel Facebook configurado.</p>
          ) : (
            <>
              {/* Só mostra o seletor interno se NÃO foi controlado por prop */}
              {!selectedProductId && (
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-slate-300 text-xs">
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {productPixels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {productPixels.map((px) => (
                    <Badge key={px.pixel_id} variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20 gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> {px.pixel_id}
                    </Badge>
                  ))}
                  {productPixels[0]?.domain && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      🌐 {productPixels[0].domain}
                    </Badge>
                  )}
                </div>
              )}

              {generatedScript ? (
                <div className="relative">
                  <pre className="bg-slate-900/60 border border-slate-700/30 rounded-md p-3 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[350px] overflow-y-auto whitespace-pre">
                    {generatedScript}
                  </pre>
                  <Button size="sm" variant="outline" className="absolute top-1.5 right-1.5 gap-1 text-[10px] h-6 bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700" onClick={copyScript}>
                    <ClipboardCopy className="w-3 h-3" /> Copiar
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">Nenhum pixel Facebook neste produto.</p>
              )}

              <div className="bg-slate-900/40 border border-slate-700/20 rounded-md p-3 space-y-1.5">
                <p className="text-[11px] font-medium text-slate-300">O que o script faz (100% conforme Meta v22.0):</p>
                <ul className="text-[10px] text-slate-500 space-y-0.5 list-disc list-inside">
                  <li>Carrega Meta Pixel + inicializa todos os IDs (sem duplicar init)</li>
                  <li>Dispara <span className="text-slate-400">PageView</span> + <span className="text-slate-400">ViewContent</span> com event_id (deduplicação)</li>
                  <li>Captura UTMs e envia em <span className="text-slate-400">custom_data</span> do CAPI (atribuição precisa)</li>
                  <li>Constrói <span className="text-slate-400">_fbc</span> a partir de fbclid no formato oficial Meta</li>
                  <li><span className="text-slate-400">User-Agent</span> consistente entre Pixel browser e CAPI server (dedup perfeito)</li>
                  <li>Expõe <span className="text-slate-400">window.pcTrack(eventName, data)</span> para SPAs (React/Next/Vue)</li>
                  <li>Propaga UTMs + fbc + fbp + vid ao checkout via goToCheckout()</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Health Check da Landing */}
      <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-emerald-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Testar instalação na Landing</h2>
            <p className="text-[10px] text-slate-500">Valida se o script PanteraPay está corretamente instalado na URL pública</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-slate-400">URL da landing page</label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <Input
                  value={landingUrl}
                  onChange={(e) => setLandingUrl(e.target.value)}
                  placeholder="https://sua-landing.com"
                  className="pl-9 bg-slate-800/60 border-slate-700/50 text-slate-300 text-xs placeholder:text-slate-600"
                />
              </div>
            </div>
            <Button onClick={runHealthCheck} disabled={healthChecking || !selectedProduct} size="sm" className="gap-1.5 text-xs">
              {healthChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {healthChecking ? "Testando..." : "Testar Landing"}
            </Button>
          </div>

          {healthResult && (
            <div className="rounded-md bg-slate-900/50 border border-slate-700/20 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-700/20 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-300 truncate">{landingUrl}</span>
                </div>
                <div className="flex gap-3 text-[10px] shrink-0 ml-2">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-2.5 h-2.5" /> {healthResult.summary.passed}
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <AlertTriangle className="w-2.5 h-2.5" /> {healthResult.summary.warnings}
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <XCircle className="w-2.5 h-2.5" /> {healthResult.summary.errors}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-slate-700/15">
                {healthResult.checks.map((check, i) => (
                  <div key={i} className="px-3 py-2.5 flex items-start gap-2.5">
                    {statusIcon(check.status)}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-300">{check.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
