# VAR Electrochem Labor Tracker — Design Spec
**v1.0 · April 2025**

---

## 1. Brand Extraction (from asb-group.com/var)

The VAR Electrochem site is industrial, precise, defence-grade. Key signals:
- Dark backgrounds, clean white typography
- No decorative flourishes — purely functional layout
- Strong use of negative space
- Confident, minimal navigation

The app should feel like **Asana meets a defence operations dashboard** — modern project management UX, but with the gravitas of a precision manufacturing company.

---

## 2. Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#1B3A5C` | Navy. Primary brand. Sidebar bg, primary buttons, active states |
| `--color-primary-light` | `#2A5480` | Hover states on primary |
| `--color-accent` | `#E8A020` | Amber. VAR's badge/highlight colour. CTAs, warnings, active nav indicators |
| `--color-accent-light` | `#FDF3E0` | Amber tint. Warning backgrounds |
| `--color-success` | `#1A6B45` | Green. Confirmation, R&D stage badge |
| `--color-success-light` | `#E8F5EE` | Green tint. Success backgrounds |
| `--color-danger` | `#C0392B` | Red. Hard block, over-limit states |
| `--color-danger-light` | `#FDECEA` | Red tint. Error backgrounds |
| `--color-surface` | `#FFFFFF` | Card and panel backgrounds |
| `--color-bg` | `#F4F6F9` | Page background (light grey, not white) |
| `--color-sidebar-text` | `#C8D8EA` | Muted text on dark sidebar |
| `--color-text-primary` | `#1A1A2E` | Near-black for headings |
| `--color-text-secondary` | `#5A6478` | Muted text, labels |
| `--color-border` | `#E2E8F0` | Subtle borders |

**Stage colours (always-on visual language):**
- R&D → `--color-primary` (#1B3A5C navy)
- Production → `--color-accent` (#E8A020 amber)

---

## 3. Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| App wordmark | `Inter` | 700 | 16px |
| Page heading (H1) | `Inter` | 600 | 22px |
| Section heading (H2) | `Inter` | 600 | 16px |
| Card label / overline | `Inter` | 500 | 11px uppercase, 0.08em tracking |
| Body / form labels | `Inter` | 400 | 14px |
| Metric numbers | `Inter` | 700 | 28px |
| Table data | `Inter` | 400 | 13px |
| Monospace (IDs, times) | `JetBrains Mono` | 400 | 13px |

Use `Inter` via Google Fonts. No fallback to system-ui for headings — load the font.

---

## 4. Layout

### Shell
```
┌────────────────────────────────────────────┐
│ TOPBAR (52px) — Logo + Nav tabs + Date     │
├──────────┬─────────────────────────────────┤
│ SIDEBAR  │  MAIN CONTENT AREA              │
│ (220px)  │  (fluid)                        │
│          │                                 │
└──────────┴─────────────────────────────────┘
```

- Sidebar: `--color-primary` background, white/muted text
- Topbar: `--color-surface` with 1px bottom border
- Content area: `--color-bg` with 24px padding

### Responsive breakpoints
| Breakpoint | Behaviour |
|---|---|
| ≥ 1024px (desktop) | Full sidebar + content layout |
| 768px–1023px (tablet) | Sidebar collapses to icon-only (48px) or hamburger |
| < 768px | Not a target — deprioritise |

---

## 5. Component Specs

### Cards
```
background: --color-surface
border: 1px solid --color-border
border-radius: 10px
padding: 20px 24px
box-shadow: 0 1px 3px rgba(0,0,0,0.06)
```

### Metric Cards
```
background: --color-surface
border-left: 3px solid --color-primary  (or accent/success depending on type)
border-radius: 8px
padding: 16px 20px
```
- Overline label: 11px, uppercase, `--color-text-secondary`
- Number: 28px, 700, `--color-text-primary`
- Sub-label: 12px, `--color-text-secondary`

### Buttons

**Primary** (Submit, Save)
```
background: --color-primary
color: white
border-radius: 8px
padding: 9px 20px
font-weight: 500
font-size: 14px
transition: background 150ms ease, transform 100ms ease
:hover → --color-primary-light
:active → scale(0.97)  ← haptic substitute
```

**Secondary** (Add Entry, Cancel)
```
background: transparent
border: 1px solid --color-border
color: --color-text-primary
Same sizing as primary
:hover → background: --color-bg
:active → scale(0.97)
```

**Destructive / Blocked**
```
background: --color-danger-light
color: --color-danger
border: 1px solid --color-danger
cursor: not-allowed
```

### Form Inputs
```
background: --color-surface
border: 1px solid --color-border
border-radius: 8px
padding: 9px 12px
font-size: 14px
:focus → border-color: --color-primary, box-shadow: 0 0 0 3px rgba(27,58,92,0.12)
:hover → border-color: #9aaec1
```

### Toggles (Shift selector, Stage selector)
```
Segmented control — 3 options side by side
Container: background: --color-bg, border-radius: 8px, padding: 3px
Active pill: background: --color-primary, color: white, border-radius: 6px
Inactive: color: --color-text-secondary
:active on pill → scale(0.95) for 100ms
```

### Badges / Pills
| Type | Background | Text |
|---|---|---|
| R&D | `#E8EFF7` | `#1B3A5C` |
| Production | `#FDF3E0` | `#9A6200` |
| Active | `#E8F5EE` | `#1A6B45` |
| Closed | `#F0F0F0` | `#5A6478` |
| Shift 1/2/3 | `#EEF2FF` | `#3730A3` |

---

## 6. Haptics / Interaction Feedback

No native haptic APIs in a web app — simulate through micro-animations:

| Interaction | Feedback |
|---|---|
| Button click | `transform: scale(0.97)` for 100ms on `:active` |
| Form submit (success) | Green toast slides in from top-right, auto-dismisses in 3s |
| Hard block (shift cap exceeded) | Submit button shakes: `animation: shake 300ms ease` + border turns `--color-danger` |
| Entry row added | Row fades in: `opacity: 0 → 1` over 200ms, slight translateY(8px → 0) |
| Entry row removed | Row fades out: `opacity: 1 → 0` over 150ms |
| Tab / page switch | Content fades in: `opacity: 0 → 1` over 150ms |
| Progress bar update | Smooth width transition: `transition: width 300ms ease` |
| Dropdown open | No animation — keep snappy for tablet use |

```css
/* Shake animation for hard block */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-4px); }
  40%       { transform: translateX(4px); }
  60%       { transform: translateX(-3px); }
  80%       { transform: translateX(3px); }
}

/* Entry row enter */
@keyframes rowEnter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 7. Sidebar Navigation

```
┌──────────────────────┐
│  ⚡ VAR Tracker      │  ← Logo + wordmark (white on navy)
├──────────────────────┤
│  ● Dashboard         │  ← Active: white text + amber left border (3px)
│    Log Time          │  ← Inactive: --color-sidebar-text
│    All Entries       │
├──────────────────────┤
│  Today: Mon 14 Apr   │  ← Bottom of sidebar, muted
└──────────────────────┘
```

- Active item: `border-left: 3px solid --color-accent`, `color: white`, `background: rgba(255,255,255,0.08)`
- Inactive item: `color: --color-sidebar-text`, `:hover → background: rgba(255,255,255,0.05)`
- Icon + label: 14px, 500 weight, 40px row height, 16px horizontal padding

---

## 8. Progress Bar (Shift Cap Indicator)

```
Label:  "Shift time used"          "360 / 480 min"
Track:  height 8px, border-radius 4px, background: --color-border
Fill:   transition: width 300ms ease, border-radius 4px
        0–75%   → --color-primary  (navy)
        75–99%  → --color-accent   (amber warning)
        100%+   → --color-danger   (red, button blocked)
```

Show remaining time below: `"120 min remaining"` → `"0 min remaining — limit reached"`

---

## 9. Dashboard Charts (Chart.js)

**Primary chart — horizontal stacked bar**
- X axis: Hours (0 to max)
- Y axis: Project names
- Segments: Battery models, two shades per battery (darker = Production, lighter = R&D)
- Gridlines: 1px, `rgba(0,0,0,0.06)`
- No chart border
- Tooltip: white card, 13px, shows Project / Battery / Stage / Hours

**Secondary chart — vertical bar**
- X axis: Departments or Employees
- Y axis: Hours
- Two bars per group: R&D (navy) and Production (amber)
- Consistent with primary colour language

**Legend:** Custom HTML above chart. Coloured 10x10px squares, 12px labels.

---

## 10. Tailwind Config Overrides

Map the above tokens into `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      primary: { DEFAULT: '#1B3A5C', light: '#2A5480' },
      accent:  { DEFAULT: '#E8A020', light: '#FDF3E0' },
      success: { DEFAULT: '#1A6B45', light: '#E8F5EE' },
      danger:  { DEFAULT: '#C0392B', light: '#FDECEA' },
      surface: '#FFFFFF',
      appbg:   '#F4F6F9',
    },
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
    borderRadius: { card: '10px', input: '8px' },
    boxShadow: { card: '0 1px 3px rgba(0,0,0,0.06)' },
  }
}
```

---

## 11. What NOT to do

- No purple gradients or generic SaaS blues
- No rounded pill buttons — keep `border-radius: 8px` (Asana-style, not bubbly)
- No skeleton loaders — data loads fast on LAN
- No dark mode — on-prem LAN app, keep light mode only
- No floating action buttons — desktop-first, use explicit button placement
- No toast stacking — one toast at a time

---

---

## 12. Accessibility — Keyboard & Tab Navigation

Target users are accustomed to keyboard-only data entry. The app must be fully operable without a mouse.

### Tab order (Time Entry form)
Follow DOM order strictly — no `tabindex` gymnastics:
```
Department → Employee → Date → Shift toggle →
[Add Entry] → Activity → Project → Battery →
Stage toggle → Lot → Duration → [Submit]
```
Each "Add Entry" row must be reachable and its fields must tab through in order before moving to the next row.

### Keyboard requirements

| Element | Keyboard behaviour |
|---|---|
| All dropdowns (`<select>`) | Native — arrow keys work out of the box. Don't replace with custom dropdowns. |
| Shift toggle (1st/2nd/3rd) | Arrow keys move between options. `Enter` or `Space` selects. |
| Stage toggle (R&D/Production) | Same as shift toggle. |
| [Add Entry] button | `Enter` or `Space` adds a new row and focuses first field in that row. |
| [Remove] on a row | `Delete` or `Backspace` when row is focused, or Tab to the remove button and hit `Enter`. |
| [Submit] button | `Enter` submits. If blocked, focus stays on Submit and shake animation fires. |
| Dashboard filters | All dropdowns and toggles reachable via Tab. `Enter` applies filter. |

### Focus styles
Never suppress the browser focus ring. Override it to match the brand:
```css
:focus-visible {
  outline: 2px solid #1B3A5C;
  outline-offset: 2px;
  border-radius: 6px;
}
```
This replaces the default browser blue with the VAR navy — visible and on-brand.

### What NOT to do
- Don't use `<div>` or `<span>` for interactive elements — use `<button>`, `<select>`, `<input>`. Native elements get keyboard support for free.
- Don't auto-advance focus after a dropdown selection — let the user Tab when ready.
- Don't trap focus inside any component unless it's a modal (none planned for v1).

---

*Design Spec · VAR Electrochem Labor Tracker · v1.0 · April 2025*
