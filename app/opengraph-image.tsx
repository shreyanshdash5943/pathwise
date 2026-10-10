import { ImageResponse } from "next/og";
import { SITE_TAGLINE } from "@/lib/site";

export const alt = "Pathwise — a career plan that tells you what to do today";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The social preview card shown when a Pathwise link is shared (WhatsApp, LinkedIn, X, DM). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        {/* Accent bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 12, background: "#1F5EEA" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", width: 64, height: 64, borderRadius: 18, background: "#101216", alignItems: "center", justifyContent: "center" }}>
            <svg width="40" height="40" viewBox="0 0 28 28">
              <path d="M7 19.5c3.2 0 4.2-2.4 5.6-5.3C14 11.3 15.3 8.5 21 8.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
              <circle cx="21" cy="8.5" r="2.6" fill="#1F5EEA" stroke="#fff" strokeWidth="1.5" />
              <circle cx="7" cy="19.5" r="1.8" fill="#fff" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#101216" }}>Pathwise</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, color: "#101216", lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>{SITE_TAGLINE}</div>
          <div style={{ fontSize: 34, color: "#6A707C", maxWidth: 940 }}>Free daily career plans, habit tracking and proof of work. Built for students.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", background: "#1F5EEA", color: "#fff", fontSize: 28, fontWeight: 600, padding: "14px 28px", borderRadius: 999 }}>Get started free</div>
          <div style={{ fontSize: 28, color: "#9AA0AA" }}>pathwise</div>
        </div>
      </div>
    ),
    size
  );
}
