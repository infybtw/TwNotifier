---
name: TwNotifier Mini App
description: Existing dark violet Telegram Mini App with bounded collections and explicit navigation.
colors:
  tg-bg: "#0c0913"
  tg-text: "#ece8f8"
  tg-hint: "#8d84ab"
  tg-subtitle: "#b3aad1"
  tg-link: "#a78bfa"
  tg-button: "#7c3aed"
  tg-button-text: "#ffffff"
  tg-secondary-bg: "#1b1429"
  tg-header-bg: "rgba(12, 9, 19, 0.82)"
  tg-section-bg: "#141021"
  tg-destructive: "#f87171"
  tg-border: "rgba(167, 139, 250, 0.14)"
  button-active: "#6d28d9"
typography:
  headline:
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.025em"
  title:
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontSize: "12px"
    lineHeight: "16px"
  statistic:
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
rounded:
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
components:
  button-primary:
    backgroundColor: "{colors.tg-button}"
    textColor: "{colors.tg-button-text}"
    rounded: "{rounded.xl}"
    padding: "10px 12px"
  button-primary-active:
    backgroundColor: "{colors.button-active}"
  button-secondary:
    backgroundColor: "{colors.tg-secondary-bg}"
    textColor: "{colors.tg-text}"
    rounded: "{rounded.xl}"
    padding: "10px 12px"
  button-destructive:
    backgroundColor: "{colors.tg-secondary-bg}"
    textColor: "{colors.tg-destructive}"
    rounded: "{rounded.xl}"
    padding: "10px 12px"
  search-input:
    backgroundColor: "{colors.tg-section-bg}"
    textColor: "{colors.tg-text}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.tg-section-bg}"
    textColor: "{colors.tg-text}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  badge:
    backgroundColor: "{colors.tg-secondary-bg}"
    textColor: "{colors.tg-text}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  pagination-button:
    backgroundColor: "{colors.tg-secondary-bg}"
    textColor: "{colors.tg-text}"
    rounded: "{rounded.xl}"
    padding: "8px 12px"
  section-selected:
    backgroundColor: "{colors.tg-button}"
    textColor: "{colors.tg-button-text}"
    rounded: "{rounded.lg}"
---

# Design System: TwNotifier Mini App

## Overview

**Creative North Star: "Existing dark violet Mini App"**

Preserve the implemented theme, not a replacement identity. Compact typography, tonal cards and violet actions organize subscription management and administration. The app supplies its own palette rather than mirroring Telegram's client theme; Telegram supplies viewport safe areas.

**Key Characteristics:**
- Dark violet surfaces with light text and restrained borders.
- Persistent shell navigation around one scrolling content region.
- Bounded pages, independent collection controls and Russian/English labels.

Source of truth: `web/app/assets/css/main.css`, `app.vue`, shared navigation/pagination components and the implemented admin pages. Frontmatter values describe existing styles; component entries are representative variants, not universal dimensions for every button.

## Colors

### Primary
- `tg-button` / `tg-button-text`: primary actions and selected section buttons; `button-active` is the pressed action state.
- `tg-link`: links, active bottom navigation and keyboard focus.

### Neutral
- `tg-bg`: page canvas; `tg-section-bg`: cards; `tg-secondary-bg`: nested surfaces and secondary controls.
- `tg-text`: primary content; `tg-subtitle`: pager and section labels; `tg-hint`: supporting metadata and inactive navigation.
- `tg-border`: card edges, dividers and control outlines; `tg-header-bg`: translucent shell bars.

`tg-destructive` marks destructive actions/errors. Existing status badges also use green, amber and red utility colors with text labels; these are status semantics, not replacement brand accents.

## Typography

Use the body system-font stack throughout, including headings; no separate display face is shipped. Frontmatter records the observed hierarchy: page headings, profile titles, body copy, compact labels and dashboard statistics. Section headings commonly use body size with semibold weight; row names use medium or semibold weight. Bottom navigation labels are smaller (11px). Pagination uses tabular numerals.

## Layout

- Authenticated shell: column flex, viewport height (100dvh), overflow hidden; header and bottom navigation do not shrink. The main region alone scrolls (`flex: 1`, `min-height: 0`, vertical overflow auto, contained overscroll).
- Header, content and navigation share a centered maximum width (672px). Main content has horizontal and vertical padding (16px); the bottom navigation uses narrower horizontal padding (8px).
- Safe-area bars add runtime top/bottom insets to baseline padding (12px). Route changes scroll the main region to the top.
- Pages stack sections with gaps (16px); collection rows use gaps (8px). Cards commonly use padding (16px), rows (12px vertical, 16px horizontal). Admin statistics and destination links use two columns.
- Metadata and action groups wrap on narrow screens; flexible text containers shrink or truncate without displacing controls. Pagination metadata/actions wrap in normal flow, never forming another fixed bar.
- Section navigation uses equal-width columns; below 360px it becomes a two-column grid with wrapping labels. Confirmation panels are bottom-aligned on mobile and centered from 640px, with maximum width (448px).

## Elevation & Depth

Cards and controls use tonal layering and thin borders rather than decorative shadows. Header/navigation bars have backdrop blur (14px). Dialogs use a dark translucent backdrop with blur (4px), not a new surface palette.

Primary-action transitions last 120ms. Modal opacity/panel transitions last 140ms/160ms and are removed for reduced motion. The indeterminate progress animation runs for 1.2s, slowed to 2.4s for reduced motion. Exact extension values live in `.impeccable/design.json`.

## Shapes

Use the existing rounded hierarchy: large cards and dialogs use `2xl`; primary controls, search fields and pager buttons use `xl`; compact controls and section buttons use `lg`; badges use `full`. Cards and secondary controls have thin borders (1px). Keyboard focus is a link-colored outline (2px) offset from the element (2px).

## Components

### Actions, fields and cards

Primary actions use solid violet and white text; secondary actions use the raised secondary surface; destructive actions use destructive text on that surface. Primary buttons dim when disabled (opacity 0.45). Search fields use a card surface, hint-colored placeholders and the shared focus outline. Cards contain short headings, rows and supporting metadata; status chips retain readable labels.

### Navigation

Bottom navigation retains subscriptions, online, add, settings and about; administrators also receive control. Active destinations use link color and `aria-current="page"`; nested follow/admin routes retain their parent selection. Admin destinations remain explicit links with back links on detail screens. Preserve RU/EN labels and the header language switch.

Profiles separate overview/actions, settings, follows and notifications through labeled section buttons with `aria-pressed`; follows and notifications have independent pagers. Infrastructure separates services/actions from reconnect history. Do not paginate short settings forms merely to imitate collections.

### Pagination

**The Bounded Page Rule.** Long collections throughout the Mini App replace the visible page rather than append rows with “Load more.” Default page size is 5; choices are 5, 10 and 20. Keep Previous, current page and Next explicit.

**The Honest Total Rule.** Cursor-backed collections show the current page without a fabricated last page or total. Local snapshot pagination may show page totals only for the returned bounded dataset; recent logs and reconnect history are not complete archives.

- Filters/search and page-size changes restart at page 1; keep the chosen filters while moving between pages.
- Cursor state, page size and known page position survive route revisits in app state; local snapshot pagers do not promise that persistence. If a cursor page becomes empty after data shrinks, step back; local pages clamp to the available range.
- The shared pager uses a top divider, compact labels, minimum-height controls (44px) and wrapping metadata/actions. Loading disables its controls; unavailable directions are disabled (opacity 0.4).
- Announce page status politely and label each pager. Page changes bring the collection start into view without moving keyboard focus away from the pager.
- Keep loading, empty, error/retry and existing-data error states distinct; independent collections must not share a page index.

## Do's and Don'ts

### Do:
- **Do** preserve the incumbent dark violet palette, system typography, shell and RU/EN behavior.
- **Do** use bounded pages with explicit backward/forward navigation for long collections.
- **Do** reset pagination after filters or page-size changes and keep each collection independent.
- **Do** retain visible focus, labeled state and narrow-screen wrapping.

### Don't:
- **Don't** invent cursor totals or describe bounded recent logs as a complete archive.
- **Don't** turn the pager into a fixed overlay or accumulate pages with “Load more.”
- **Don't** introduce a replacement brand, font family or decorative asset system in a structural refinement.
- **Don't** ship synthetic review screenshots from `.impeccable/review` as product assets; this improvement adds no shipping raster assets.
