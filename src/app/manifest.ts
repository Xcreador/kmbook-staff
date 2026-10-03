import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KMBOOK Staff",
    short_name: "Staff",
    description: "Aplicación móvil de trabajo para profesionales KMBOOK",
    start_url: "/today",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F5F8",
    theme_color: "#070023",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
