import type { MetadataRoute } from "next";

/** Lets people add Pathwise to their home screen, which iPhones require for notifications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pathwise",
    short_name: "Pathwise",
    description: "Your career plan, one day at a time.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
