import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KMBOOK Staff",
    short_name: "Staff",
    description: "Aplicación móvil de trabajo para profesionales KMBOOK",
    id: "/",
    // «/» decide el destino (login, elegir negocio u Hoy); /today sin sesión acabaría en login sin contexto.
    start_url: "/?source=pwa",
    scope: "/",
    lang: "es",
    dir: "ltr",
    categories: ["business", "productivity"],
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F5F8",
    theme_color: "#070023",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
