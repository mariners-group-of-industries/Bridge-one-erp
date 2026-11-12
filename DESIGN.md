# BridgeOne ERP Design System & UI Specification

Grounding design tokens and engineering rules inspired by Linear, Stripe, and modern ERPNext desk interfaces.

## 1. Color Palette & Semantic Tokens
- **Canvas / Background**: `bg-canvas` (`#f8fafc` / dark `#090d16`)
- **Card Surface**: `bg-surface` (`#ffffff` / dark `#111726`)
- **Control / Input**: `bg-control` (`#f1f5f9` / dark `#1e293b`)
- **Borders & Dividers**: `border-line` (`#e2e8f0` / dark `#1e293b`)
- **Ink / Typography**:
  - Primary text: `text-ink` (`#0f172a` / dark `#f8fafc`)
  - Muted text: `text-ink-muted` (`#64748b` / dark `#94a3b8`)
  - Faint text: `text-ink-faint` (`#94a3b8` / dark `#475569`)
- **Brand Accent**: `blue-600` (`#2563eb`) / `blue-700` (`#1d4ed8`)
- **Semantic Accents**:
  - Success / Verified: `emerald-600` (`#059669`) / tint `emerald-500/10`
  - Warning / In Review: `amber-600` (`#d97706`) / tint `amber-500/10`
  - Danger / Overdue: `rose-600` (`#e11d48`) / tint `rose-500/10`
  - Neutral / Scheduled: `slate-600` (`#475569`) / tint `slate-500/10`

## 2. Typography Scale
- **Display / Page Title**: `text-xl sm:text-2xl font-bold tracking-tight text-ink`
- **Section Heading**: `text-sm sm:text-base font-semibold text-ink`
- **Card Title / Record Name**: `text-sm font-semibold text-ink`
- **Body / Content**: `text-[13px] leading-relaxed text-ink`
- **Labels & Captions**: `text-xs font-medium text-ink-muted`
- **Micro Badges & Metas**: `text-[11px] font-semibold tracking-wide`
- **Code & Identifiers**: `font-mono text-xs font-semibold`

## 3. Anti-Slop & Craft Governance
- **No generic purple-to-blue gradient text**: Keep typography crisp and readable using solid semantic tokens.
- **No emoji icon tiles above feature headings**: Use crisp SVG Lucide icons inside refined 24x24px or 32x32px icon tiles.
- **Consistent Elevation & Shadows**: Rely on crisp 1px borders (`border border-line`) paired with ultra-subtle shadows (`shadow-2xs` / `shadow-xs`).
- **Interactive Polish**: Every button and link must have clear hover, active, and keyboard focus-visible states (`focus-visible:ring-2 focus-visible:ring-blue-500/20`).
- **Visible Async Loading**: Async action buttons must display an explicit `<Loader2 className="animate-spin" />` state while processing.

