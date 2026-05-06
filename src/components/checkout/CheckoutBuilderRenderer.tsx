import { memo } from "react";
import { ListOrdered, Star, Award } from "lucide-react";
import type { BuilderComponent } from "@/components/checkout-builder/types";

interface Props {
  components: BuilderComponent[];
  zone: string;
  productName?: string;
  excludeTypes?: string[];
}

function renderComponent(component: BuilderComponent, productName?: string) {
  switch (component.type) {
    case "text":
      return <p className="text-[#0F1111] whitespace-pre-line text-sm">{component.props.content}</p>;
    case "image":
      return component.props.url ? (
        <img src={component.props.url} alt="" className="w-full rounded-lg object-contain bg-[#F7FAFA] p-1 border border-[#D5D9D9]" loading="lazy" decoding="async" />
      ) : null;
    case "header":
      return <h2 className="text-lg font-bold text-[#0F1111]">{component.props.title || productName}</h2>;
    case "advantages":
    case "list":
      return (
        <ul className="space-y-2">
          {(component.props.items || []).map((item: string, i: number) => (
            <li key={`${component.id}-${i}`} className="flex items-center gap-2 text-sm text-[#0F1111]">
              <ListOrdered className="w-4 h-4 text-[#007185]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "testimonial":
      return (
        <div className="rounded-lg border border-[#D5D9D9] bg-white p-3">
          <div className="mb-1 flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3 h-3 text-[#FFA41C] fill-[#FFA41C]" />
            ))}
          </div>
          <p className="text-sm text-[#0F1111] italic">"{component.props.text}"</p>
          <p className="mt-1 text-xs text-[#565959]">— {component.props.author}</p>
        </div>
      );
    case "seal":
      return (
        <div className="flex items-center gap-2 rounded-lg border border-[#D5D9D9] bg-white p-3">
          <Award className="w-5 h-5 text-[#007185]" />
          <div>
            <p className="text-sm font-semibold text-[#0F1111]">{component.props.title}</p>
            <p className="text-xs text-[#565959]">{component.props.subtitle}</p>
          </div>
        </div>
      );
    case "video":
      return component.props.url ? (
        <iframe
          src={component.props.url.replace("watch?v=", "embed/")}
          className="w-full h-56 rounded-lg border border-[#D5D9D9]"
          allowFullScreen
          title="Vídeo"
        />
      ) : null;
    default:
      return null;
  }
}

const CheckoutBuilderRenderer = memo(function CheckoutBuilderRenderer({
  components,
  zone,
  productName,
  excludeTypes = [],
}: Props) {
  const filtered = components.filter(
    (c) => c.zone === zone && !excludeTypes.includes(c.type)
  );

  if (filtered.length === 0) return null;

  return (
    <>
      {filtered.map((component) => (
        <div key={component.id}>{renderComponent(component, productName)}</div>
      ))}
    </>
  );
});

export default CheckoutBuilderRenderer;
