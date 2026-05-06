export type ComponentType =
  | "text"
  | "image"
  | "advantages"
  | "seal"
  | "header"
  | "list"
  | "countdown"
  | "testimonial"
  | "video"
  | "facebook"
  | "form"
  | "button";

export interface BuilderComponent {
  id: string;
  type: ComponentType;
  zone: "top" | "left" | "right";
  order: number;
  props: Record<string, any>;
}

export interface BuilderSettings {
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
}

export const COMPONENT_CATALOG: {
  type: ComponentType;
  label: string;
  icon: string;
}[] = [
  { type: "text", label: "Texto", icon: "AlignLeft" },
  { type: "image", label: "Imagem", icon: "Image" },
  { type: "form", label: "Formulário", icon: "FileText" },
  { type: "button", label: "Botão", icon: "MousePointerClick" },
  { type: "advantages", label: "Vantagens", icon: "ThumbsUp" },
  { type: "seal", label: "Selo", icon: "Award" },
  { type: "header", label: "Header", icon: "LayoutGrid" },
  { type: "list", label: "Lista", icon: "ListOrdered" },
  { type: "countdown", label: "Cronômetro", icon: "Clock" },
  { type: "testimonial", label: "Depoimento", icon: "Star" },
  { type: "video", label: "Vídeo", icon: "Video" },
  { type: "facebook", label: "Facebook", icon: "Facebook" },
];
