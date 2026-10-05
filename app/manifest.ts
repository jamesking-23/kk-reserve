import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "kkingg reserves", short_name: "kkingg", description: "Personal budget tracker", start_url: "/", display: "standalone", background_color: "#ece8ff", theme_color: "#ece8ff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }, { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }] };
}
