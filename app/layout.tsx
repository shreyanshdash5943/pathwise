import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource-variable/instrument-sans";
import "./globals.css";
import { MotionProvider } from "@/components/motion-provider";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Pathwise: your career plan, one day at a time", template: "%s | Pathwise" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: "Pathwise: your career plan, one day at a time",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Pathwise: your career plan, one day at a time",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#1F5EEA",
          colorText: "#101216",
          colorTextSecondary: "#6A707C",
          colorBackground: "#FFFFFF",
          colorInputBackground: "#FFFFFF",
          fontFamily: '"Instrument Sans Variable", system-ui, sans-serif',
          borderRadius: "0.75rem",
        },
        elements: {
          card: { boxShadow: "0 1px 2px rgba(16,18,22,0.04), 0 12px 32px -16px rgba(16,18,22,0.18)", border: "1px solid #E6E8EC" },
          formButtonPrimary: { fontSize: "14px", textTransform: "none", boxShadow: "none" },
        },
      }}
    >
      <html lang="en">
        <body>
          <MotionProvider>{children}</MotionProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
