# UX Consistency — External References

Reference material for the `audit-ux-consistency` agent. This document provides mappings to industry standards, detection matrices, and confidence calibration tables.

## External References

| Source | URL | Scope |
| --- | --- | --- |
| Nielsen Norman Group — 10 Usability Heuristics | <https://www.nngroup.com/articles/ten-usability-heuristics/> | Foundation — Heuristic #4 |
| NNGroup — Consistency and Standards (H4) | <https://www.nngroup.com/articles/consistency-and-standards/> | Primary reference |
| W3C Design Tokens Community Group | <https://tr.designtokens.org/format/> | Token format specification |
| Design System Checklist | <https://www.designsystemchecklist.com/> | Foundations & component coverage |
| Material Design 3 | <https://m3.material.io/> | Reference design system |
| Carbon Design System (IBM) | <https://carbondesignsystem.com/> | Reference — tokens & typography |
| Tailwind CSS | <https://tailwindcss.com/docs> | Utility-first reference |
| Open Props | <https://open-props.style/> | CSS custom property reference |

## Nielsen Heuristic #4 — Consistency & Standards

### Layers of Consistency

From NNGroup's analysis, consistency operates at four layers:

| Layer | What it covers | Example violation |
| --- | --- | --- |
| **Visual** | Colors, typography, iconography, spacing, elevation | Different button colors for the same action across pages |
| **Page / Component layout** | Component structure, card layouts, form patterns | Cards with title-then-image on one page, image-then-title on another |
| **User-entered data** | Form field formats, validation messages, input patterns | Date field accepts `MM/DD` on one form, `DD/MM` on another |
| **Content** | Terminology, tone, labels, error messages | "Cancel" on one dialog, "Dismiss" on another for the same action |

### Internal vs External Consistency

| Type | Definition | Detection strategy |
| --- | --- | --- |
| **Internal** | Consistency within the product itself | Compare token usage across all files in the project |
| **External** | Consistency with platform/industry conventions | Compare against framework defaults (Material, Bootstrap, etc.) |

## W3C Design Tokens Format — Type Coverage

Based on the W3C Design Tokens Community Group specification (2025.10):

### Primitive Token Types

| DTCG Type | CSS equivalent | Detection rule | Tag |
| --- | --- | --- | --- |
| `color` | hex, rgb, hsl, oklch | Hardcoded color values outside token definitions | `dtcg:color` |
| `dimension` | px, rem, em, vw | Hardcoded spacing/sizing values | `dtcg:dimension` |
| `fontFamily` | font-family | Font family declarations not referencing tokens | `dtcg:fontFamily` |
| `fontWeight` | font-weight | Numeric weights not from a defined scale | `dtcg:fontWeight` |
| `duration` | ms, s | Transition/animation durations not from tokens | `dtcg:duration` |
| `cubicBezier` | cubic-bezier() | Easing functions not from motion tokens | `dtcg:cubicBezier` |
| `number` | unitless number | z-index, opacity, line-height magic numbers | `dtcg:number` |

### Composite Token Types

| DTCG Type | Components | Detection rule | Tag |
| --- | --- | --- | --- |
| `shadow` | color, offsetX, offsetY, blur, spread | Inline `box-shadow` not referencing elevation tokens | `dtcg:shadow` |
| `typography` | fontFamily, fontSize, fontWeight, lineHeight, letterSpacing | Inline font shorthand not referencing type tokens | `dtcg:typography` |
| `border` | color, width, style | Inline border values not referencing tokens | `dtcg:border` |
| `gradient` | type, stops[] | Inline gradient definitions not shared | `dtcg:gradient` |
| `transition` | duration, delay, timingFunction | Inline transitions with ad-hoc timing | `dtcg:transition` |

## Design System Checklist — Foundations Mapping

Aligned with designsystemchecklist.com:

### Foundations

| Foundation | Checklist items | Rules mapped |
| --- | --- | --- |
| **Color** | Accessible palette, semantic naming, dark mode mapping, guidelines | `hardcoded-color`, `off-palette-color`, `inconsistent-semantic-color` |
| **Layout** | Units, grid definition, breakpoints, spacing scale | `off-scale-spacing`, `inconsistent-container-width`, `breakpoint-inconsistency` |
| **Typography** | Type scale, responsive sizes, grid relation, readability | `typography-scale-violation`, `font-family-proliferation`, `line-height-inconsistency` |
| **Elevation** | Shadow scale, background separation, z-index management | `shadow-sprawl`, `z-index-magic-number`, `inconsistent-elevation` |
| **Motion** | Easing tokens, duration scale, reduced-motion | `inconsistent-transition`, `missing-reduced-motion` |
| **Iconography** | Single style, naming convention, size scale, grid alignment | `mixed-icon-libraries`, `inconsistent-icon-sizing` |

### Components (detected via duplication analysis)

| Area | Detection | Rule |
| --- | --- | --- |
| Component reuse | 3+ structurally similar HTML blocks not abstracted | `duplicated-ui-pattern` |
| Inline styles | `style=` attributes replicating class-based styles | `inline-style-proliferation` |

## Rule-to-Standard Mapping

| Rule ID | Rule | Nielsen H4 | DTCG Type | DSC Section | Severity range |
| --- | --- | --- | --- | --- | --- |
| `hardcoded-color` | Raw hex/rgb instead of token | Internal | `color` | Color | low–high |
| `hardcoded-spacing` | Raw px instead of spacing token | Internal | `dimension` | Layout | low–medium |
| `hardcoded-typography` | Raw font-size/weight not from scale | Internal | `typography` | Typography | low–medium |
| `hardcoded-shadow` | Raw box-shadow instead of token | Internal | `shadow` | Elevation | low–medium |
| `z-index-magic-number` | Arbitrary z-index values | Internal | `number` | Elevation | low–medium |
| `typography-scale-violation` | Font sizes outside defined scale | Internal | `dimension` | Typography | medium–high |
| `font-family-proliferation` | Too many distinct font families | Internal | `fontFamily` | Typography | medium |
| `line-height-inconsistency` | Inconsistent line-height ratios | Internal | `number` | Typography | low–medium |
| `off-scale-spacing` | Spacing values not on the scale | Internal | `dimension` | Layout | low–medium |
| `off-palette-color` | Colors outside defined palette | Internal | `color` | Color | low–high |
| `inconsistent-semantic-color` | Same semantic concept, different colors | Internal | `color` | Color | medium–high |
| `duplicated-ui-pattern` | Repeated HTML structures not componentized | Internal | — | Components | medium |
| `inline-style-proliferation` | Excessive inline styles | Internal | — | Components | low–medium |
| `mixed-icon-libraries` | Multiple icon packages in same project | Visual | — | Iconography | low–medium |
| `inconsistent-icon-sizing` | Icons with non-standard sizes | Visual | `dimension` | Iconography | low |
| `inconsistent-transition` | Ad-hoc transition durations/easings | Visual | `duration`/`cubicBezier` | Motion | low–medium |
| `missing-reduced-motion` | Animations without prefers-reduced-motion | Visual | `duration` | Motion | medium |
| `shadow-sprawl` | Too many distinct shadow definitions | Visual | `shadow` | Elevation | low–medium |
| `breakpoint-inconsistency` | Non-standard media query breakpoints | External | `dimension` | Layout | medium |
| `inconsistent-container-width` | Different max-widths on containers | External | `dimension` | Layout | low–medium |
| `inconsistent-focus-style` | Mixed focus indicator approaches | Internal | — | — | medium |
| `inconsistent-hover-state` | Different hover patterns on similar elements | Internal | — | — | low–medium |
| `inconsistent-disabled-state` | Different disabled treatments | Internal | — | — | low–medium |
| `border-radius-sprawl` | Too many distinct border-radius values | Visual | `dimension` | — | low–medium |
| `border-style-inconsistency` | Mixed border treatments on similar elements | Visual | `border` | — | low |
| `token-naming-violation` | Tokens with non-semantic names | Internal | — | Color/Layout | low |

## Stack-Aware Detection

### Angular + SCSS

| File pattern | What to scan | Common issues |
| --- | --- | --- |
| `*.component.scss` | Component-scoped styles | Hardcoded values not using `$variables` or `var(--tokens)` |
| `styles.scss` / `_variables.scss` | Global styles and token definitions | Token source — DO NOT flag definitions here |
| `*.component.html` | Template inline styles | `[ngStyle]` and `style` attributes with hardcoded values |
| `angular.json` → `styles` | Global style imports | Check for consistent ordering and theming |

### React + CSS-in-JS (styled-components / Emotion)

| File pattern | What to scan | Common issues |
| --- | --- | --- |
| `*.styled.ts` / `*.styles.ts` | Styled component definitions | Hardcoded values not using `theme.` references |
| `theme.ts` / `theme.js` | Theme definition | Token source — DO NOT flag definitions here |
| `*.tsx` with `sx=` or `css=` | Inline style props | Hardcoded values bypassing theme |

### Tailwind CSS

| File pattern | What to scan | Common issues |
| --- | --- | --- |
| `tailwind.config.*` | Config extends | Token source — DO NOT flag definitions here |
| `*.html` / `*.tsx` / `*.jsx` | Class usage | Arbitrary value syntax `[13px]` bypassing the scale |
| `*.css` with `@apply` | Utility extraction | Mixing `@apply` with raw CSS values |

### CSS Modules

| File pattern | What to scan | Common issues |
| --- | --- | --- |
| `*.module.css` / `*.module.scss` | Scoped styles | Hardcoded values not importing from shared variables |
| `variables.css` / `tokens.css` | Shared custom properties | Token source — DO NOT flag definitions here |

## Confidence Calibration

| Confidence | Criteria | Examples |
| --- | --- | --- |
| **0.65–0.70** | Clear violation confirmed by cross-referencing definitions. Token/variable file exists, value is NOT using it. Multiple instances of the same violation. | 5 components use `#e74c3c` while `$color-error` exists, font-size `13px` in a clear 4px-grid system |
| **0.50–0.64** | Pattern suggests inconsistency but could be intentional. Single occurrence. Component override context. | One component uses `padding: 13px` (could be optical adjustment), a vendor override uses a non-standard color |
| **0.35–0.49** | Statistical anomaly — the outlier is minor in context. Or the project doesn't have a clear token system yet, making "violations" ambiguous. | 1 off-scale value among 50 correct ones, project uses plain CSS without any variable system |
| **< 0.35** | Too speculative to report. Skip these. | — |

## Remediation Timeline Reference

| Effort | Description | Typical time |
| --- | --- | --- |
| **trivial** | Replace one hardcoded value with existing token/variable | < 15 min |
| **small** | Extract a few hardcoded values into tokens, update imports | 15 min – 1 hour |
| **medium** | Create a token scale (spacing, type, color), migrate a module | 1–4 hours |
| **large** | Refactor a feature area to use design tokens consistently | 4–16 hours |
| **epic** | Establish a design token system from scratch for the project | 1–2 weeks |

## Design System Maturity Model

Used to contextualize findings — a project with no design system will have different expectations than one with a mature token-based system:

| Level | Characteristics | Expected audit outcome |
| --- | --- | --- |
| **0 — Ad-hoc** | No variables, no tokens, all hardcoded | Many critical/high findings; recommend establishing tokens first |
| **1 — Variable-based** | CSS variables or SCSS variables for colors/spacing, but inconsistent usage | Medium findings; recommend consistent adoption |
| **2 — Token-based** | Design token file(s) with semantic naming, used across most components | Low findings; focus on outliers and edge cases |
| **3 — System-driven** | Full design system with tokens, documentation, component library | Mostly info findings; focus on drift detection |
