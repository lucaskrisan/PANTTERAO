import { Clock, ThumbsUp, Star, Award, Image, Video, Facebook, LayoutGrid, ListOrdered } from "lucide-react";
import type { BuilderComponent } from "./types";

const ComponentPreview = ({ component }: { component: BuilderComponent }) => {
  switch (component.type) {
    case "text":
      return (
        <div className="py-2">
          <p className="text-sm text-[#0F1111]">{component.props.content || "Texto personalizado aqui..."}</p>
        </div>
      );

    case "image":
      return (
        <div className="py-1">
          {component.props.url ? (
            <img src={component.props.url} alt="" className="w-full h-32 object-contain bg-[#F7FAFA] border border-[#D5D9D9] rounded-lg p-1" />
          ) : (
            <div className="w-full h-28 bg-[#F7FAFA] border border-[#D5D9D9] rounded-lg flex flex-col items-center justify-center gap-1">
              <Image className="w-10 h-10 text-[#D5D9D9]" />
            </div>
          )}
        </div>
      );

    case "advantages":
      return (
        <div className="py-2 space-y-1.5">
          {(component.props.items || ["Acesso imediato", "Suporte 24h", "Garantia de 7 dias"]).slice(0, 3).map((item: string, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs text-[#0F1111]">
              <ThumbsUp className="w-3.5 h-3.5 text-[#007185]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      );

    case "seal":
      return (
        <div className="py-2 flex items-center justify-center gap-2">
          <Award className="w-8 h-8 text-[#007185]" />
          <div>
            <p className="text-xs font-bold text-[#0F1111]">{component.props.title || "Compra Segura"}</p>
            <p className="text-[10px] text-[#565959]">{component.props.subtitle || "Ambiente protegido"}</p>
          </div>
        </div>
      );

    case "header":
      return (
        <div className="py-2 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#F7FAFA] rounded border border-[#D5D9D9] flex items-center justify-center">
            <LayoutGrid className="w-4 h-4 text-[#565959]" />
          </div>
          <p className="text-sm font-bold text-[#0F1111]">{component.props.title || "TÍTULO DO PRODUTO"}</p>
        </div>
      );

    case "list":
      return (
        <div className="py-2 space-y-1">
          {(component.props.items || ["Item 1", "Item 2", "Item 3"]).map((item: string, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs text-[#0F1111]">
              <ListOrdered className="w-3 h-3 text-[#007185]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      );

    case "countdown":
      return (
        <div className="py-2 text-center">
          <Clock className="w-5 h-5 text-[#B12704] mx-auto mb-1" />
          <p className="text-xs font-semibold text-[#0F1111]">{component.props.text || "Oferta termina em:"}</p>
          <p className="text-lg font-bold text-[#B12704]">15:00</p>
        </div>
      );

    case "testimonial":
      return (
        <div className="py-2 border border-[#D5D9D9] rounded-lg p-3 bg-white">
          <div className="flex gap-0.5 mb-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-[#FFA41C] text-[#FFA41C]" />
            ))}
          </div>
          <p className="text-xs text-[#0F1111] italic">"{component.props.text || "Produto incrível! Recomendo."}"</p>
          <p className="text-[10px] text-[#565959] mt-1">— {component.props.author || "Cliente"}</p>
        </div>
      );

    case "video":
      return (
        <div className="py-2">
          <div className="w-full h-28 bg-[#F7FAFA] border border-[#D5D9D9] rounded-lg flex items-center justify-center">
            <Video className="w-8 h-8 text-[#565959]" />
          </div>
        </div>
      );

    case "facebook":
      return (
        <div className="py-2 flex items-center gap-2 justify-center">
          <Facebook className="w-5 h-5 text-blue-600" />
          <span className="text-xs text-[#565959]">Facebook Comments</span>
        </div>
      );

    case "form":
      return (
        <div className="group/form relative -mx-3 -my-3 p-4 bg-[#F7FAFA] hover:bg-[#EEF1F4] transition-colors cursor-default">
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/form:opacity-100 transition-opacity z-10 pointer-events-none">
            <div className="bg-[#232F3E] text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-lg">
              <p className="text-center">Checkout</p>
              <p className="text-center text-[10px] font-normal opacity-80">Será exibido aqui</p>
            </div>
          </div>
          <div className="space-y-2.5 group-hover/form:opacity-60 transition-opacity">
            <div className="h-9 w-full bg-white border border-[#D5D9D9] rounded-lg" />
            <div className="h-9 w-full bg-white border border-[#D5D9D9] rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-9 bg-white border border-[#D5D9D9] rounded-lg" />
              <div className="h-9 bg-white border border-[#D5D9D9] rounded-lg" />
            </div>
            <div className="flex gap-2 pt-1">
              <div className="h-8 flex-1 bg-white border border-[#D5D9D9] rounded-lg" />
              <div className="h-8 flex-1 bg-white border-2 border-[#007185] rounded-lg" />
            </div>
            <div className="border border-[#D5D9D9] rounded-lg p-3 space-y-2">
              <div className="h-8 w-full bg-[#F7FAFA] border border-[#D5D9D9] rounded" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-8 bg-[#F7FAFA] border border-[#D5D9D9] rounded" />
                <div className="h-8 bg-[#F7FAFA] border border-[#D5D9D9] rounded" />
                <div className="h-8 bg-[#F7FAFA] border border-[#D5D9D9] rounded" />
              </div>
            </div>
            <div className="h-12 w-full rounded-lg" style={{ backgroundColor: "#FFD814", border: "1px solid #FCD200" }} />
            <div className="flex justify-center gap-4 pt-1">
              <div className="h-3 w-20 bg-[#D5D9D9]/40 rounded" />
              <div className="h-3 w-20 bg-[#D5D9D9]/40 rounded" />
            </div>
          </div>
        </div>
      );

    case "button":
      return (
        <div className="py-2">
          <div
            className="h-12 w-full rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#FFD814", border: "1px solid #FCD200" }}
          >
            <span className="text-[#0F1111] text-sm font-medium">
              {component.props.text || "Finalizar compra"}
            </span>
          </div>
        </div>
      );

    default:
      return <div className="py-2 text-xs text-[#565959]">Componente desconhecido</div>;
  }
};

export default ComponentPreview;
