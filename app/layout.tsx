import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "@fontsource-variable/instrument-sans";
import "./globals.css";
import { MotionProvider } from "@/components/motion-provider";

export const metadata: Metadata = {
  title: { default: "Pathwise: your career plan, one day at a time", template: "%s | Pathwise" },
  description:
    "Answer ten quick questions and get a personal career roadmap, a daily checklist and a news feed for your field.",
  icons: { icon: "/favicon.svg" },
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
        </body>
      </html>
    </ClerkProvider>
  );
}
