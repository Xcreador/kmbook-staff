import { renderBrandIcon } from "@/lib/brand-icon";

// Icono del manifest PWA (192x192); antes el manifest apuntaba a un fichero que no existía (404).
export function GET() {
  return renderBrandIcon(192);
}
