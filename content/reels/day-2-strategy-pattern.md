# Day 2 Reel — Factory vs Strategy Pattern (LLD)

Production-ready package built from the 7-Day plan. Everything you need to film / screen-record.
Target length: **~30 seconds**. Format: screen-record the code + captions, your voiceover on top.

---

## The hook (first 3 seconds — make or break)
- **On-screen text:** `Stop writing nested if-else ladders 🛑`
- **Spoken:** "Senior engineers reject code that looks like this in a review round."
- **Shot:** open ON the messy red if-else code already filling the screen (start at the payoff,
  no intro). Quick shake/zoom on it.

---

## Timed script (beats)

| Time | Spoken (voiceover) | On-screen text | Visual |
|---|---|---|---|
| 0:00–0:03 | "Senior engineers reject code that looks like this." | Stop writing nested if-else ladders 🛑 | Messy if-else ladder, highlighted red |
| 0:03–0:09 | "Ten if-else checks just to pick a payment method? In a real review, that gets sent back." | "10 if-else = rejected" | Red lines, a ❌ stamp |
| 0:09–0:22 | "Use the Strategy Pattern. One interface — PaymentStrategy. One small class each for Stripe, PayPal, Crypto. Then inject the right one at runtime." | "Strategy Pattern" → interface → classes → inject | Wipe to clean green code, revealed piece by piece |
| 0:22–0:28 | "Your checkout logic never changes again. Closed for modification, open for extension. That's senior-level code." | "Open/Closed ✅" | Highlight the `Checkout` class staying untouched |
| 0:28–0:30 | "Save this before your next interview." | Comment "LLD" for the repo | Loop back to the clean code (seamless loop) |

**Word count ≈ 72 words** — fits a punchy 30s. Read it fast, with energy.

---

## The code to show on screen

**BEFORE — the mess (highlight red):**
```ts
function checkout(cart, method) {
  if (method === "stripe") {
    // ...stripe logic
  } else if (method === "paypal") {
    // ...paypal logic
  } else if (method === "crypto") {
    // ...crypto logic
  } else if (method === "upi") {
    // ...and on, and on
  }
}
```

**AFTER — Strategy Pattern (highlight green):**
```ts
interface PaymentStrategy {
  pay(amount: number): void;
}

class Stripe implements PaymentStrategy {
  pay(amount: number) { /* charge via Stripe */ }
}
class PayPal implements PaymentStrategy {
  pay(amount: number) { /* charge via PayPal */ }
}
class Crypto implements PaymentStrategy {
  pay(amount: number) { /* charge via wallet */ }
}

class Checkout {
  constructor(private strategy: PaymentStrategy) {}
  process(amount: number) {
    this.strategy.pay(amount);   // business logic never changes
  }
}

// inject the right one at runtime
new Checkout(new Stripe()).process(999);
```

> Tip: type it in VS Code dark theme, big font (18–20pt), and screen-record the reveal, or
> paste into [carbon.now.sh](https://carbon.now.sh) / [ray.so] and animate the before→after cut.

---

## Visual direction (for an AI video tool, refined from the sheet)
> Split-screen code editor, dark mode. LEFT: a messy 25-line nested if-else ladder, lines glowing
> red, a ❌ stamp drops on it. RIGHT: a clean `PaymentStrategy` interface with three small
> decoupled classes, glowing green, revealed line-by-line with a kinetic typing effect. A
> smooth diff-wipe transitions left→right. End on the `Checkout` class with an "Open/Closed ✅"
> label. Crisp, fast cuts, mechanical-keyboard SFX on each reveal.

**Audio vibe:** lo-fi focus beat with crisp mechanical keyboard clicks (low, non-distracting).

---

## Caption (paste into Instagram)
```
Senior devs don't write 10 if-else checks to pick a payment method. They use the Strategy Pattern 👇

One interface. One class per gateway (Stripe, PayPal, Crypto). Inject the right one at runtime — and your checkout logic never changes again. Open for extension, closed for modification.

This is the kind of Low-Level Design question that separates juniors from seniors in interviews.

Save it 🔖 for your next technical round.
Comment "LLD" and I'll send the full GitHub implementation.

(Building Pathwise — a free daily plan that tells you exactly what to learn for a software job. Link in bio.)

#softwareengineering #lld #designpatterns #systemdesign #cleancode #coding #programming #leetcode #techinterview #webdevelopment #computerscience #developer #codinglife #strategypattern #softwaredeveloper
```

---

## Checklist before posting
- [ ] Hook is legible in the **first frame**, even on mute.
- [ ] Captions/subtitles burned in (most watch muted).
- [ ] It **loops** (last frame flows into the first).
- [ ] Original footage (no watermark) — IG suppresses reposts.
- [ ] Reply to every comment in the first 60 min; pin a comment with the repo link.
- [ ] Add to a "LLD" Highlight after 24h.

## Why this one should perform
- **Save + send bait:** a reusable interview pattern → people save it and DM it to a friend
  grinding interviews. Saves and sends are the signals IG weights highest in 2026.
- **One idea, clear before/after** — the format with the best completion rate.
- **Comment trigger ("LLD")** manufactures comments *and* opens a DM thread (lead gen).
