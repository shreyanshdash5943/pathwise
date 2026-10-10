import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Let crawlers index the public pages; keep the signed-in app and API out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/roadmap", "/habits", "/jobs", "/pods", "/profile", "/settings", "/pro", "/news", "/onboarding"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
