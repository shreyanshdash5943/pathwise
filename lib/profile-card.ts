import "server-only";
import { PDFDocument, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PublicProfile } from "./public-profile";

/**
 * One-page PDF card for a public profile. Every contact and project line is a real
 * clickable link. Uses the built-in Helvetica, so it's fast and needs no font files;
 * characters Helvetica can't show are replaced.
 */

const INK = rgb(0.063, 0.071, 0.086);
const MUTED = rgb(0.416, 0.439, 0.486);
const FAINT = rgb(0.604, 0.627, 0.667);
const ACCENT = rgb(0.122, 0.369, 0.918);
const LINE = rgb(0.902, 0.91, 0.925);
const SOFT = rgb(0.918, 0.941, 0.992);

const W = 595.28; // A4
const H = 841.89;
const M = 52;

/** Keeps only characters the standard PDF fonts can draw. */
function safe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—‐‑]/g, "-")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .trim();
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else {
      if (line) lines.push(line);
      line = word;
      while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
        // A single word wider than the line (a long URL): hard-break it.
        let cut = line.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function addLink(doc: PDFDocument, page: PDFPage, x: number, y: number, w: number, h: number, url: string) {
  const annot = doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x, y, x + w, y + h],
    Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  });
  page.node.addAnnot(doc.context.register(annot));
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export async function buildProfileCard(p: PublicProfile, origin: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const name = safe(p.displayName ?? `@${p.username}`) || p.username;
  doc.setTitle(`${name} - Pathwise profile`);
  doc.setAuthor(name);
  doc.setCreator("Pathwise");
  doc.setProducer("Pathwise");

  // Card designs: classic (free), midnight and minimal (Pro).
  const theme = p.cardTheme;
  const serif = theme === "minimal";
  const regular = await doc.embedFont(serif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const bold = await doc.embedFont(serif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const accent = theme === "minimal" ? INK : ACCENT;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const width = W - M * 2;

  const ensure = (needed: number) => {
    if (y - needed >= M + 30) return;
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const text = (s: string, x: number, size: number, font: PDFFont, color = INK) => page.drawText(safe(s), { x, y, size, font, color });

  // Header
  const headline = p.headline ? wrap(p.headline, regular, 13, width).slice(0, 2) : [];
  if (theme === "midnight") {
    const height = 18 + 26 + 22 + headline.length * 17 + (p.roleTitle ? 15 : 0) + 24;
    page.drawRectangle({ x: 0, y: H - height, width: W, height, color: INK });
    page.drawRectangle({ x: 0, y: H - height - 4, width: W, height: 4, color: ACCENT });
  } else if (theme === "classic") {
    page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: ACCENT });
  }
  const onDark = theme === "midnight";
  y -= 18;
  text(name, M, 26, bold, onDark ? rgb(1, 1, 1) : INK);
  y -= 22;
  for (const line of headline) {
    text(line, M, 13, regular, onDark ? rgb(0.86, 0.88, 0.92) : INK);
    y -= 17;
  }
  if (p.roleTitle) {
    text(`Working towards ${p.roleTitle}`, M, 11, regular, onDark ? rgb(0.62, 0.66, 0.73) : MUTED);
    y -= 15;
  }
  if (onDark) y -= 24;

  // Contact
  const contacts: { label: string; value: string; url: string }[] = [];
  if (p.email) contacts.push({ label: "Email", value: p.email, url: `mailto:${p.email}` });
  if (p.phone) contacts.push({ label: "Phone", value: p.phone, url: `tel:${p.phone.replace(/[^\d+]/g, "")}` });
  // Links go through /go so the owner's analytics count clicks from the PDF too.
  const go = (to: string) => `${origin}/u/${p.username}/go?to=${to}`;
  if (p.links.linkedin) contacts.push({ label: "LinkedIn", value: shortUrl(p.links.linkedin), url: go("linkedin") });
  if (p.links.github) contacts.push({ label: "GitHub", value: shortUrl(p.links.github), url: go("github") });
  if (p.links.portfolio) contacts.push({ label: "Portfolio", value: shortUrl(p.links.portfolio), url: go("portfolio") });
  if (p.hasResume) contacts.push({ label: "Resume", value: "Download PDF", url: `${origin}/u/${p.username}/resume` });
  contacts.push({ label: "Profile", value: shortUrl(`${origin}/u/${p.username}`), url: `${origin}/u/${p.username}` });

  y -= 14;
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.75, color: LINE });
  y -= 14;
  for (const c of contacts) {
    ensure(18);
    text(c.label, M, 10, bold, MUTED);
    const value = wrap(c.value, regular, 11, width - 90)[0] ?? "";
    page.drawText(value, { x: M + 90, y, size: 11, font: regular, color: accent });
    if (serif) page.drawLine({ start: { x: M + 90, y: y - 1.5 }, end: { x: M + 90 + regular.widthOfTextAtSize(value, 11), y: y - 1.5 }, thickness: 0.5, color: MUTED });
    addLink(doc, page, M + 90, y - 3, regular.widthOfTextAtSize(value, 11), 14, c.url);
    y -= 18;
  }

  const heading = (label: string) => {
    ensure(48);
    y -= 16;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.75, color: LINE });
    y -= 16;
    text(label.toUpperCase(), M, 9.5, bold, MUTED);
    y -= 18;
  };

  // Progress
  if (p.progress && p.progress.total > 0) {
    heading("Progress");
    const pct = Math.round((p.progress.done / p.progress.total) * 100);
    text(`${p.progress.done} of ${p.progress.total} tasks done (${pct}%)`, M, 11, regular);
    y -= 14;
    page.drawRectangle({ x: M, y, width, height: 6, color: serif ? LINE : SOFT });
    page.drawRectangle({ x: M, y, width: Math.max(2, (width * pct) / 100), height: 6, color: accent });
    y -= 18;
    for (const ph of p.progress.phases) {
      ensure(16);
      const mark = ph.total > 0 && ph.done === ph.total ? "Done" : `${ph.done}/${ph.total}`;
      text(ph.title, M, 10.5, regular);
      text(mark, W - M - regular.widthOfTextAtSize(mark, 10.5), 10.5, regular, MUTED);
      y -= 15;
    }
  }

  // Skills
  const skills = Array.from(new Set([...p.knownSkills, ...p.skills]));
  if (skills.length) {
    heading("Skills");
    for (const line of wrap(skills.join("  ·  "), regular, 10.5, width)) {
      ensure(15);
      text(line, M, 10.5, regular);
      y -= 15;
    }
  }

  // Proof of work
  if (p.proofs.length) {
    heading("Proof of work");
    for (const pr of p.proofs.slice(0, 8)) {
      ensure(48);
      const title = wrap(pr.title, bold, 11, width)[0] ?? "";
      page.drawText(title, { x: M, y, size: 11, font: bold, color: accent });
      addLink(doc, page, M, y - 3, bold.widthOfTextAtSize(title, 11), 14, go(`proof-${pr.id}`));
      y -= 14;
      for (const line of wrap(pr.note, regular, 10, width).slice(0, 2)) {
        text(line, M, 10, regular, MUTED);
        y -= 13;
      }
      text(host(pr.url), M, 9, regular, FAINT);
      y -= 18;
    }
  }

  // Footer on every page. Pro can drop the Pathwise name; the profile link stays.
  for (const pg of doc.getPages()) {
    const link = `${shortUrl(origin)}/u/${p.username}`;
    const label = p.hideBranding ? link : `Made with Pathwise  ·  ${link}`;
    pg.drawText(safe(label), { x: M, y: 30, size: 8.5, font: regular, color: FAINT });
    addLink(doc, pg, M, 27, regular.widthOfTextAtSize(safe(label), 8.5), 12, `${origin}/u/${p.username}`);
  }

  return doc.save();
}

