export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  type: "imagen" | "gemini";
  badge?: string;
  price: string;
}

export const MODELS: ModelInfo[] = [
  {
    id: "imagen-4.0-generate-001",
    name: "Imagen 4",
    description: "High quality, balanced",
    type: "imagen",
    price: "$0.04/img",
  },
  {
    id: "imagen-4.0-ultra-generate-001",
    name: "Imagen 4 Ultra",
    description: "Highest quality, slower",
    type: "imagen",
    badge: "PRO",
    price: "$0.06/img",
  },
  {
    id: "imagen-4.0-fast-generate-001",
    name: "Imagen 4 Fast",
    description: "Fastest generation",
    type: "imagen",
    badge: "FAST",
    price: "$0.02/img",
  },
  {
    id: "gemini-2.5-flash-image",
    name: "Nano Banana",
    description: "Speed & efficiency, high-volume",
    type: "gemini",
    badge: "FREE",
    price: "$0.039/img",
  },
  {
    id: "gemini-3.1-flash-image-preview",
    name: "Nano Banana 2",
    description: "High-efficiency, speed optimized",
    type: "gemini",
    badge: "FAST",
    price: "$0.045/img",
  },
  {
    id: "gemini-3-pro-image-preview",
    name: "Nano Banana Pro",
    description: "Pro asset production, advanced reasoning",
    type: "gemini",
    badge: "PRO",
    price: "$0.134/img",
  },
];
