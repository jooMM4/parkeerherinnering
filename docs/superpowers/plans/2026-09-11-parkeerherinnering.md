# Parkeerherinnering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vanilla-JS, installable, offline-capable PWA that lets someone save their parking location, an optional note/photo, and a timer, then reminds them before it expires and navigates them back via Google Maps.

**Architecture:** Single-page app (`index.html` + `styles.css` + `app.js`) backed by an IndexedDB wrapper (`db.js`) for persistence and a Service Worker (`sw.js`) for offline caching and notification display. A small pure-logic module (`lib/session-logic.js`) holds timer/notification math and is covered by automated tests (`node --test`); everything that touches Geolocation, IndexedDB, the Service Worker, or Notifications is verified manually in a real browser per task, since those APIs have no reliable headless equivalent in this buildless setup.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules, no bundler, no framework), IndexedDB, Service Worker, Web Notifications API, Web App Manifest. Python 3 + Pillow for one-time icon generation. Node's built-in test runner (`node --test`) for the pure-logic module only.

**Spec:**
- `/Users/laptopm5/Documents/Dev/park/parkeerherinnering-buildspec.md` (scope, features, acceptance criteria — source of truth)
- `/Users/laptopm5/Documents/Dev/park/docs/superpowers/specs/2026-09-11-parkeerherinnering-design.md` (technical decisions this plan implements)

## Global Constraints

- Dutch-language UI throughout (buildspec: "Nederlandstalige interface").
- No framework, no bundler, no backend, no accounts, no cloud sync (buildspec).
- Mobile-first, single main screen, minimal taps, large buttons (buildspec).
- Storage is IndexedDB, not localStorage (design doc — photos can exceed localStorage quota).
- Blue-zone preset = 120 minutes; warning notification fires 10 minutes before expiry (buildspec).
- UI must explicitly state that background notifications are unreliable on iOS Safari (buildspec).
- Tasks touching Geolocation, IndexedDB, Service Worker, or Notifications are verified by manual browser testing, not automated tests (design doc) — the "Test:" field in those tasks names the manual procedure instead of a test file path.
- Every task's commit message is in English per this template's convention; UI copy stays Dutch.

---

## File Structure

- `index.html` — full page shell (start form, active-session view, history, banner). Built complete in Task 1; later tasks only add behavior in `app.js`, not new markup.
- `styles.css` — all styling, built complete in Task 1.
- `manifest.json` — PWA manifest, built complete in Task 1 (references icon files created in Task 2).
- `icons/icon-192.png`, `icons/icon-512.png` — generated in Task 2.
- `scripts/generate_icons.py` — one-time icon generator (Task 2), not loaded by the app at runtime.
- `lib/session-logic.js` — pure functions: preset durations, expiry math, remaining-time formatting, notification-due logic (Task 3).
- `tests/session-logic.test.js` — automated tests for `lib/session-logic.js` (Task 3).
- `db.js` — IndexedDB wrapper: save/get active session, get history, end active session (Task 4).
- `sw.js` — Service Worker: install/activate/fetch caching (Task 5), notificationclick handling (Task 8).
- `app.js` — app bootstrap and all UI wiring, built incrementally: SW registration (Task 5) → "Ik parkeer hier" flow (Task 6) → active-session view (Task 7) → notifications + banner (Task 8) → history (Task 9).
- `package.json` — minimal, only to give `node --test` an ES-module context and a `test` script (Task 3). Not a build step for the app itself.
- `README.md` — run/test instructions per buildspec (Task 1).

---

### Task 1: Project scaffold — git, manifest, HTML/CSS shell, README

**Files:**
- Create: `.gitignore`
- Create: `manifest.json`
- Create: `index.html`
- Create: `styles.css`
- Create: `README.md`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: DOM element IDs every later task relies on — `start-view`, `active-view`, `banner`, `park-form`, `park-button`, `park-error`, `input[name="preset"]` (radio group with values `blue-zone` | `paid` | `none`), `custom-minutes-wrap`, `custom-minutes`, `note`, `photo`, `active-note`, `active-photo`, `active-remaining`, `navigate-button`, `done-button`, `history-section`, `history-list`. CSS class `.hidden` (sets `display: none`) is the show/hide mechanism used everywhere.

- [ ] **Step 1: Initialize git**

```bash
cd /Users/laptopm5/Documents/Dev/park
git init
```

- [ ] **Step 2: Create `.gitignore`**

```
.DS_Store
```

- [ ] **Step 3: Create `manifest.json`**

```json
{
  "name": "Parkeerherinnering",
  "short_name": "Parkeerherinnering",
  "description": "Onthoud waar je geparkeerd staat en krijg een herinnering voor je parkeertijd verloopt.",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "lang": "nl",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 4: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Parkeerherinnering</title>
  <link rel="manifest" href="./manifest.json">
  <meta name="theme-color" content="#2563eb">
  <link rel="icon" href="./icons/icon-192.png">
  <link rel="apple-touch-icon" href="./icons/icon-192.png">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main class="app">
    <h1>Parkeerherinnering</h1>

    <div id="banner" class="banner hidden" role="alert"></div>

    <section id="start-view">
      <form id="park-form">
        <label for="note">Notitie (optioneel)</label>
        <textarea id="note" name="note" placeholder="bv. verdieping 3, blauwe pijl"></textarea>

        <label for="photo">Foto (optioneel)</label>
        <input type="file" id="photo" name="photo" accept="image/*" capture="environment">

        <fieldset>
          <legend>Timer</legend>
          <label><input type="radio" name="preset" value="blue-zone" checked> Blauwe zone (2 uur)</label>
          <label><input type="radio" name="preset" value="paid"> Betaald parkeren</label>
          <label><input type="radio" name="preset" value="none"> Geen limiet</label>
        </fieldset>

        <div id="custom-minutes-wrap" class="hidden">
          <label for="custom-minutes">Aantal minuten</label>
          <input type="number" id="custom-minutes" min="1" step="1" value="60">
        </div>

        <button type="submit" id="park-button" class="primary-button">Ik parkeer hier</button>
        <p id="park-error" class="error hidden"></p>
      </form>

      <section id="history-section" class="hidden">
        <h2>Eerdere sessies</h2>
        <ul id="history-list"></ul>
      </section>
    </section>

    <section id="active-view" class="hidden">
      <p id="active-note"></p>
      <img id="active-photo" class="hidden" alt="Foto van parkeerplek">
      <p id="active-remaining" class="remaining"></p>
      <p class="ios-note">Let op: achtergrondmeldingen zijn op iOS Safari niet altijd betrouwbaar. Open de app om je resterende tijd te checken.</p>
      <button id="navigate-button" class="primary-button">Navigeer terug</button>
      <button id="done-button" class="secondary-button">Klaar / auto opgehaald</button>
    </section>
  </main>

  <script type="module" src="./app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create `styles.css`**

```css
:root {
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-primary: #2563eb;
  --color-primary-dark: #1d4ed8;
  --color-text: #1e293b;
  --color-muted: #64748b;
  --color-border: #e2e8f0;
  --color-warning-bg: #fef3c7;
  --color-warning-text: #92400e;
  --color-error: #dc2626;
  font-size: 18px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.app {
  max-width: 480px;
  margin: 0 auto;
  padding: 1.25rem 1rem 3rem;
}

h1 {
  font-size: 1.5rem;
  text-align: center;
  margin-bottom: 1rem;
}

.hidden { display: none !important; }

.banner {
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

form { display: flex; flex-direction: column; gap: 0.75rem; }

label { font-weight: 600; font-size: 0.95rem; }

textarea, input[type="number"], input[type="file"] {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  font-size: 1rem;
  background: var(--color-surface);
}

fieldset {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

fieldset label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 400;
  padding: 0.4rem 0;
}

.primary-button, .secondary-button {
  display: block;
  width: 100%;
  padding: 1rem;
  border: none;
  border-radius: 0.75rem;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
}

.primary-button {
  background: var(--color-primary);
  color: #fff;
}

.primary-button:active { background: var(--color-primary-dark); }
.primary-button:disabled { opacity: 0.6; }

.secondary-button {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  margin-top: 0.75rem;
}

.error {
  color: var(--color-error);
  font-weight: 600;
}

#active-view {
  background: var(--color-surface);
  border-radius: 0.75rem;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
}

.remaining {
  font-size: 1.4rem;
  font-weight: 700;
  text-align: center;
  margin: 1rem 0;
}

#active-photo {
  width: 100%;
  border-radius: 0.5rem;
  margin: 0.75rem 0;
}

.ios-note {
  font-size: 0.85rem;
  color: var(--color-muted);
}

#history-section {
  margin-top: 2rem;
}

#history-list {
  list-style: none;
  padding: 0;
}

#history-list li {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-muted);
}
```

- [ ] **Step 6: Create `README.md`**

```markdown
# Parkeerherinnering

Progressive Web App om te onthouden waar je geparkeerd staat en op tijd
gewaarschuwd te worden voor het verlopen van je parkeertijd.

## Lokaal draaien

Vanuit de projectmap:

    python3 -m http.server 8000

of

    npx serve .

Open daarna `http://localhost:8000` in je browser.

**Let op:** Geolocation en Web Notifications werken in de browser alleen
over `https://` of op `localhost` — dit is een browserbeperking, niet iets
dat deze app kan omzeilen.

## Testen op je telefoon

1. Zorg dat je telefoon op hetzelfde wifi-netwerk zit als je computer.
2. Zoek het lokale IP-adres van je computer op (bv. `ipconfig getifaddr en0` op macOS).
3. Start de server zoals hierboven en open `http://<jouw-ip>:8000` op je telefoon.
4. Omdat dit geen `https://` is, zullen Geolocation/Notifications op de
   telefoon mogelijk geweigerd worden. Gebruik voor een volledige test een
   tunnel zoals [ngrok](https://ngrok.com/):

       ngrok http 8000

   en open de `https://...ngrok-free.app` URL op je telefoon.

## Automatische tests

De pure rekenlogica (timer-berekeningen, notificatie-timing) heeft
automatische tests via Node's ingebouwde testrunner:

    npm test

De rest (Geolocation, IndexedDB, Service Worker, Notifications) vereist
een echte browseromgeving en wordt handmatig getest — zie
`docs/superpowers/plans/2026-09-11-parkeerherinnering.md` voor de
teststappen per onderdeel.

## Iconen opnieuw genereren

    python3 scripts/generate_icons.py

Vereist Pillow: `pip install Pillow` (op dit systeem al aanwezig).

## Achtergrondmeldingen op iOS

Web push/lokale notificaties op iOS Safari zijn beperkt betrouwbaar door
Apple's restricties op achtergrondactiviteit van web-apps. Op
Android/Chrome werkt dit wel goed. De app checkt daarom ook altijd
opnieuw zodra je 'm terug opent, en toont een banner als je parkeertijd
al verlopen blijkt te zijn.
```

- [ ] **Step 7: Serve and verify the shell loads**

```bash
cd /Users/laptopm5/Documents/Dev/park
python3 -m http.server 8765 &
sleep 1
curl -s http://localhost:8765/ | grep -o '<title>Parkeerherinnering</title>'
kill %1
```

Expected: prints `<title>Parkeerherinnering</title>`.

- [ ] **Step 8: Commit**

```bash
git add .gitignore manifest.json index.html styles.css README.md
git commit -m "Scaffold Parkeerherinnering PWA shell (manifest, HTML/CSS, README)"
```

---

### Task 2: Generate app icons

**Files:**
- Create: `scripts/generate_icons.py`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`

**Interfaces:**
- Consumes: nothing new (manifest.json from Task 1 already references `icons/icon-192.png` and `icons/icon-512.png`)
- Produces: the two PNG files themselves — no code interface, later tasks only reference the file paths.

- [ ] **Step 1: Create `scripts/generate_icons.py`**

```python
#!/usr/bin/env python3
"""Genereert icon-192.png en icon-512.png voor de Parkeerherinnering PWA."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "icons"
BACKGROUND = (37, 99, 235)  # #2563eb
FOREGROUND = (255, 255, 255)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BACKGROUND)
    draw = ImageDraw.Draw(img)

    margin = size * 0.12
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size * 0.18,
        fill=BACKGROUND,
        outline=FOREGROUND,
        width=max(2, int(size * 0.02)),
    )

    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", int(size * 0.55))
    except OSError:
        font = ImageFont.load_default()

    text = "P"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    position = ((size - text_w) / 2 - bbox[0], (size - text_h) / 2 - bbox[1])
    draw.text(position, text, fill=FOREGROUND, font=font)

    return img


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        icon = draw_icon(size)
        path = OUTPUT_DIR / f"icon-{size}.png"
        icon.save(path, format="PNG")
        print(f"geschreven: {path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the script**

```bash
cd /Users/laptopm5/Documents/Dev/park
python3 scripts/generate_icons.py
```

Expected output: two lines confirming `icons/icon-192.png` and `icons/icon-512.png` were written.

- [ ] **Step 3: Verify the PNGs are correct**

```bash
file icons/icon-192.png icons/icon-512.png
```

Expected: `icons/icon-192.png: PNG image data, 192 x 192, ...` and `icons/icon-512.png: PNG image data, 512 x 512, ...`.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate_icons.py icons/icon-192.png icons/icon-512.png
git commit -m "Add generated PWA icons and icon-generation script"
```

---

### Task 3: Pure session logic module with automated tests

**Files:**
- Create: `package.json`
- Create: `lib/session-logic.js`
- Test: `tests/session-logic.test.js`

**Interfaces:**
- Consumes: nothing
- Produces (used by `db.js` in Task 4 and `app.js` from Task 6 onward):
  - `PRESETS: { BLUE_ZONE: 'blue-zone', PAID: 'paid', NONE: 'none' }`
  - `BLUE_ZONE_MINUTES: 120`
  - `WARNING_MINUTES_BEFORE: 10`
  - `calculateExpiryTimestamp(presetType: string, customMinutes: number|null, startTimestamp: number): number|null` — throws on invalid `paid` input or unknown preset
  - `getRemainingMs(expiryTimestamp: number|null, now: number): number|null`
  - `formatRemainingTime(remainingMs: number|null): string` — Dutch strings: `'Geen limiet'`, `'Verlopen'`, `'Nm resterend'`, `'Uu Nm resterend'`
  - `getNotificationDue(session: {expiryTimestamp: number|null, notified10min: boolean, notifiedExpiry: boolean}, now: number): 'warning'|'expiry'|null`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "parkeerherinnering",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing tests — `tests/session-logic.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS,
  WARNING_MINUTES_BEFORE,
  calculateExpiryTimestamp,
  getRemainingMs,
  formatRemainingTime,
  getNotificationDue,
} from '../lib/session-logic.js';

test('calculateExpiryTimestamp: blue zone adds 120 minutes', () => {
  const start = 1000000;
  const expiry = calculateExpiryTimestamp(PRESETS.BLUE_ZONE, null, start);
  assert.equal(expiry, start + 120 * 60 * 1000);
});

test('calculateExpiryTimestamp: none returns null', () => {
  assert.equal(calculateExpiryTimestamp(PRESETS.NONE, null, 1000000), null);
});

test('calculateExpiryTimestamp: paid uses customMinutes', () => {
  const start = 1000000;
  const expiry = calculateExpiryTimestamp(PRESETS.PAID, 45, start);
  assert.equal(expiry, start + 45 * 60 * 1000);
});

test('calculateExpiryTimestamp: paid without valid customMinutes throws', () => {
  assert.throws(() => calculateExpiryTimestamp(PRESETS.PAID, 0, 1000000));
  assert.throws(() => calculateExpiryTimestamp(PRESETS.PAID, NaN, 1000000));
});

test('calculateExpiryTimestamp: unknown preset throws', () => {
  assert.throws(() => calculateExpiryTimestamp('bogus', null, 1000000));
});

test('getRemainingMs: null expiry returns null', () => {
  assert.equal(getRemainingMs(null, 1000000), null);
});

test('getRemainingMs: computes difference', () => {
  assert.equal(getRemainingMs(5000, 2000), 3000);
});

test('formatRemainingTime: no limit', () => {
  assert.equal(formatRemainingTime(null), 'Geen limiet');
});

test('formatRemainingTime: expired', () => {
  assert.equal(formatRemainingTime(-1), 'Verlopen');
  assert.equal(formatRemainingTime(0), 'Verlopen');
});

test('formatRemainingTime: minutes only', () => {
  assert.equal(formatRemainingTime(25 * 60 * 1000), '25m resterend');
});

test('formatRemainingTime: hours and minutes', () => {
  assert.equal(formatRemainingTime(125 * 60 * 1000), '2u 5m resterend');
});

test('getNotificationDue: warning fires at 10 min before expiry', () => {
  const expiryTimestamp = 1000000;
  const session = { expiryTimestamp, notified10min: false, notifiedExpiry: false };
  const now = expiryTimestamp - WARNING_MINUTES_BEFORE * 60 * 1000;
  assert.equal(getNotificationDue(session, now), 'warning');
});

test('getNotificationDue: expiry takes priority over warning when both due', () => {
  const expiryTimestamp = 1000000;
  const session = { expiryTimestamp, notified10min: false, notifiedExpiry: false };
  assert.equal(getNotificationDue(session, expiryTimestamp), 'expiry');
});

test('getNotificationDue: nothing due before warning window', () => {
  const expiryTimestamp = 1000000;
  const session = { expiryTimestamp, notified10min: false, notifiedExpiry: false };
  const now = expiryTimestamp - 20 * 60 * 1000;
  assert.equal(getNotificationDue(session, now), null);
});

test('getNotificationDue: null when already notified and nothing further due', () => {
  const expiryTimestamp = 1000000;
  const session = { expiryTimestamp, notified10min: true, notifiedExpiry: false };
  const now = expiryTimestamp - WARNING_MINUTES_BEFORE * 60 * 1000;
  assert.equal(getNotificationDue(session, now), null);
});

test('getNotificationDue: no-limit session never due', () => {
  const session = { expiryTimestamp: null, notified10min: false, notifiedExpiry: false };
  assert.equal(getNotificationDue(session, Date.now()), null);
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/laptopm5/Documents/Dev/park
npm test
```

Expected: FAIL — `Cannot find module '../lib/session-logic.js'` (module doesn't exist yet).

- [ ] **Step 4: Implement `lib/session-logic.js`**

```js
export const PRESETS = {
  BLUE_ZONE: 'blue-zone',
  PAID: 'paid',
  NONE: 'none',
};

export const BLUE_ZONE_MINUTES = 120;
export const WARNING_MINUTES_BEFORE = 10;

export function calculateExpiryTimestamp(presetType, customMinutes, startTimestamp) {
  if (presetType === PRESETS.NONE) return null;
  if (presetType === PRESETS.BLUE_ZONE) return startTimestamp + BLUE_ZONE_MINUTES * 60 * 1000;
  if (presetType === PRESETS.PAID) {
    if (!Number.isFinite(customMinutes) || customMinutes <= 0) {
      throw new Error('customMinutes must be a positive number for the paid preset');
    }
    return startTimestamp + customMinutes * 60 * 1000;
  }
  throw new Error(`Unknown presetType: ${presetType}`);
}

export function getRemainingMs(expiryTimestamp, now) {
  if (expiryTimestamp === null || expiryTimestamp === undefined) return null;
  return expiryTimestamp - now;
}

export function formatRemainingTime(remainingMs) {
  if (remainingMs === null || remainingMs === undefined) return 'Geen limiet';
  if (remainingMs <= 0) return 'Verlopen';
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}u ${minutes}m resterend`;
  return `${minutes}m resterend`;
}

export function getNotificationDue(session, now) {
  if (session.expiryTimestamp === null || session.expiryTimestamp === undefined) return null;
  const warningAt = session.expiryTimestamp - WARNING_MINUTES_BEFORE * 60 * 1000;
  if (!session.notifiedExpiry && now >= session.expiryTimestamp) return 'expiry';
  if (!session.notified10min && now >= warningAt) return 'warning';
  return null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all 15 tests green.

- [ ] **Step 6: Commit**

```bash
git add package.json lib/session-logic.js tests/session-logic.test.js
git commit -m "Add pure session-logic module with automated tests"
```

---

### Task 4: IndexedDB wrapper

**Files:**
- Create: `db.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (stores raw session objects, does not import `session-logic.js`)
- Produces (used by `app.js` from Task 6 onward):
  - `saveSession(session: object): Promise<void>` — `session.id` is the key; creates or overwrites
  - `getActiveSession(): Promise<object|null>` — returns the session with `active: true`, or `null`
  - `getHistory(): Promise<object[]>` — returns sessions with `active: false`, newest first, max 5
  - `endActiveSession(): Promise<void>` — marks the active session `active: false` and prunes history beyond 5 entries

Session object shape (established here, used by every later task): `{ id: string, lat: number, lng: number, timestamp: number, note: string, photoBlob: Blob|null, expiryTimestamp: number|null, presetType: string, active: boolean, notified10min: boolean, notifiedExpiry: boolean }`.

- [ ] **Step 1: Implement `db.js`**

```js
const DB_NAME = 'parkeerherinnering';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const MAX_HISTORY = 5;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore(mode, run) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = run(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  }));
}

function getAll() {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }));
}

export function saveSession(session) {
  return withStore('readwrite', (store) => {
    store.put(session);
  });
}

export async function getActiveSession() {
  const all = await getAll();
  return all.find((s) => s.active) || null;
}

export async function getHistory() {
  const all = await getAll();
  return all
    .filter((s) => !s.active)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_HISTORY);
}

export async function endActiveSession() {
  const active = await getActiveSession();
  if (!active) return;
  active.active = false;
  await saveSession(active);

  const all = await getAll();
  const history = all
    .filter((s) => !s.active)
    .sort((a, b) => b.timestamp - a.timestamp);
  const excess = history.slice(MAX_HISTORY);
  if (excess.length > 0) {
    await withStore('readwrite', (store) => {
      excess.forEach((s) => store.delete(s.id));
    });
  }
}
```

- [ ] **Step 2: Manual browser verification**

```bash
cd /Users/laptopm5/Documents/Dev/park
python3 -m http.server 8765
```

Open `http://localhost:8765/` in Chrome, open DevTools Console, and run:

```js
const db = await import('./db.js');
await db.saveSession({ id: 'test1', lat: 51.05, lng: 3.72, timestamp: Date.now(), note: 'test', photoBlob: null, expiryTimestamp: null, presetType: 'none', active: true, notified10min: false, notifiedExpiry: false });
await db.getActiveSession();   // -> the object above
await db.getHistory();         // -> []
await db.endActiveSession();
await db.getActiveSession();   // -> null
await db.getHistory();         // -> [the object above, now active:false]
```

Also open DevTools → Application → IndexedDB → `parkeerherinnering` → `sessions` and confirm the record is visible. Stop the server (Ctrl+C) when done.

- [ ] **Step 3: Commit**

```bash
git add db.js
git commit -m "Add IndexedDB session storage wrapper"
```

---

### Task 5: Service Worker + registration bootstrap

**Files:**
- Create: `sw.js`
- Create: `app.js`

**Interfaces:**
- Consumes: none
- Produces: `app.js` module-level `init()` entry point (runs on load) and a `registerServiceWorker()` function that later tasks build on top of in the same file. `sw.js` caches `./`, `./index.html`, `./styles.css`, `./app.js`, `./db.js`, `./lib/session-logic.js`, `./manifest.json`, `./icons/icon-192.png`, `./icons/icon-512.png` under cache name `parkeerherinnering-v1`.

- [ ] **Step 1: Create `sw.js`**

```js
const CACHE_NAME = 'parkeerherinnering-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './lib/session-logic.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- [ ] **Step 2: Create `app.js`**

```js
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('./sw.js');
  } catch (err) {
    console.error('Service worker registratie mislukt:', err);
    return null;
  }
}

async function init() {
  await registerServiceWorker();
}

init();
```

- [ ] **Step 3: Manual browser verification**

```bash
cd /Users/laptopm5/Documents/Dev/park
python3 -m http.server 8765
```

Open `http://localhost:8765/` in Chrome. In DevTools → Application → Service Workers, confirm a worker for `sw.js` is `activated and running`. In Application → Cache Storage, confirm `parkeerherinnering-v1` contains all 9 listed assets. Then check "Offline" in the Network tab and reload — the page must still load. Uncheck "Offline" and stop the server when done.

- [ ] **Step 4: Commit**

```bash
git add sw.js app.js
git commit -m "Add service worker caching and registration bootstrap"
```

---

### Task 6: "Ik parkeer hier" flow

**Files:**
- Modify: `app.js` (full replacement below)

**Interfaces:**
- Consumes: `saveSession`, `getActiveSession` from `db.js` (Task 4); `PRESETS`, `calculateExpiryTimestamp` from `lib/session-logic.js` (Task 3); DOM IDs from `index.html` (Task 1)
- Produces: `renderApp()` — re-checks the active session and toggles `#start-view`/`#active-view` visibility; called by later tasks after any state change

- [ ] **Step 1: Replace `app.js` with:**

```js
import { saveSession, getActiveSession } from './db.js';
import { PRESETS, calculateExpiryTimestamp } from './lib/session-logic.js';

const startView = document.getElementById('start-view');
const activeView = document.getElementById('active-view');
const parkForm = document.getElementById('park-form');
const parkButton = document.getElementById('park-button');
const parkError = document.getElementById('park-error');
const presetRadios = parkForm.querySelectorAll('input[name="preset"]');
const customMinutesWrap = document.getElementById('custom-minutes-wrap');
const customMinutesInput = document.getElementById('custom-minutes');

let swRegistration = null;

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('./sw.js');
  } catch (err) {
    console.error('Service worker registratie mislukt:', err);
    return null;
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation wordt niet ondersteund door deze browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

function updateCustomMinutesVisibility() {
  const selected = parkForm.querySelector('input[name="preset"]:checked').value;
  customMinutesWrap.classList.toggle('hidden', selected !== PRESETS.PAID);
}

presetRadios.forEach((radio) => radio.addEventListener('change', updateCustomMinutesVisibility));

parkForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  parkError.classList.add('hidden');
  parkButton.disabled = true;
  try {
    const position = await getCurrentPosition();
    const preset = parkForm.querySelector('input[name="preset"]:checked').value;
    const customMinutes = preset === PRESETS.PAID ? Number(customMinutesInput.value) : null;
    const now = Date.now();
    const expiryTimestamp = calculateExpiryTimestamp(preset, customMinutes, now);
    const photoFile = document.getElementById('photo').files[0] || null;

    const session = {
      id: crypto.randomUUID(),
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: now,
      note: document.getElementById('note').value.trim(),
      photoBlob: photoFile,
      expiryTimestamp,
      presetType: preset,
      active: true,
      notified10min: false,
      notifiedExpiry: false,
    };

    await saveSession(session);
    parkForm.reset();
    updateCustomMinutesVisibility();
    await renderApp();
  } catch (err) {
    console.error(err);
    parkError.textContent = err.message || 'Er ging iets mis bij het opslaan van je parkeersessie.';
    parkError.classList.remove('hidden');
  } finally {
    parkButton.disabled = false;
  }
});

async function renderApp() {
  const active = await getActiveSession();
  if (active) {
    startView.classList.add('hidden');
    activeView.classList.remove('hidden');
  } else {
    startView.classList.remove('hidden');
    activeView.classList.add('hidden');
  }
}

async function init() {
  swRegistration = await registerServiceWorker();
  updateCustomMinutesVisibility();
  await renderApp();
}

init();
```

- [ ] **Step 2: Manual browser verification**

```bash
cd /Users/laptopm5/Documents/Dev/park
python3 -m http.server 8765
```

Open `http://localhost:8765/` in Chrome. Fill in a note, pick "Betaald parkeren", confirm the minutes field appears; pick "Blauwe zone", confirm it hides again. Click "Ik parkeer hier", grant location permission when prompted. Confirm the view switches to `#active-view` (blank at this point — Task 7 fills it in) and `#start-view` is hidden. Reload the page and confirm it goes straight to the (still blank) active view rather than the form — this proves the session persisted in IndexedDB. Stop the server when done.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "Implement Ik-parkeer-hier flow: geolocation capture and session save"
```

---

### Task 7: Active-session view (countdown, navigate, done)

**Files:**
- Modify: `app.js` (full replacement below)

**Interfaces:**
- Consumes: `endActiveSession` from `db.js` (added to the Task 4 imports); `getRemainingMs`, `formatRemainingTime` from `lib/session-logic.js`
- Produces: `renderActiveSession(session)` and `updateRemainingDisplay()` — Task 8 calls `scheduleNotifications` from inside `renderActiveSession`, so that call site must exist at the end of `renderActiveSession`'s body when Task 8 modifies this file.

- [ ] **Step 1: Replace `app.js` with:**

```js
import { saveSession, getActiveSession, endActiveSession } from './db.js';
import { PRESETS, calculateExpiryTimestamp, getRemainingMs, formatRemainingTime } from './lib/session-logic.js';

const startView = document.getElementById('start-view');
const activeView = document.getElementById('active-view');
const parkForm = document.getElementById('park-form');
const parkButton = document.getElementById('park-button');
const parkError = document.getElementById('park-error');
const presetRadios = parkForm.querySelectorAll('input[name="preset"]');
const customMinutesWrap = document.getElementById('custom-minutes-wrap');
const customMinutesInput = document.getElementById('custom-minutes');
const activeNote = document.getElementById('active-note');
const activePhoto = document.getElementById('active-photo');
const activeRemaining = document.getElementById('active-remaining');
const navigateButton = document.getElementById('navigate-button');
const doneButton = document.getElementById('done-button');

let swRegistration = null;
let currentSession = null;
let countdownInterval = null;
let currentPhotoUrl = null;

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('./sw.js');
  } catch (err) {
    console.error('Service worker registratie mislukt:', err);
    return null;
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation wordt niet ondersteund door deze browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

function updateCustomMinutesVisibility() {
  const selected = parkForm.querySelector('input[name="preset"]:checked').value;
  customMinutesWrap.classList.toggle('hidden', selected !== PRESETS.PAID);
}

presetRadios.forEach((radio) => radio.addEventListener('change', updateCustomMinutesVisibility));

parkForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  parkError.classList.add('hidden');
  parkButton.disabled = true;
  try {
    const position = await getCurrentPosition();
    const preset = parkForm.querySelector('input[name="preset"]:checked').value;
    const customMinutes = preset === PRESETS.PAID ? Number(customMinutesInput.value) : null;
    const now = Date.now();
    const expiryTimestamp = calculateExpiryTimestamp(preset, customMinutes, now);
    const photoFile = document.getElementById('photo').files[0] || null;

    const session = {
      id: crypto.randomUUID(),
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: now,
      note: document.getElementById('note').value.trim(),
      photoBlob: photoFile,
      expiryTimestamp,
      presetType: preset,
      active: true,
      notified10min: false,
      notifiedExpiry: false,
    };

    await saveSession(session);
    parkForm.reset();
    updateCustomMinutesVisibility();
    await renderApp();
  } catch (err) {
    console.error(err);
    parkError.textContent = err.message || 'Er ging iets mis bij het opslaan van je parkeersessie.';
    parkError.classList.remove('hidden');
  } finally {
    parkButton.disabled = false;
  }
});

function renderActiveSession(session) {
  currentSession = session;
  activeNote.textContent = session.note || '(geen notitie)';

  if (currentPhotoUrl) {
    URL.revokeObjectURL(currentPhotoUrl);
    currentPhotoUrl = null;
  }
  if (session.photoBlob) {
    currentPhotoUrl = URL.createObjectURL(session.photoBlob);
    activePhoto.src = currentPhotoUrl;
    activePhoto.classList.remove('hidden');
  } else {
    activePhoto.classList.add('hidden');
  }

  updateRemainingDisplay();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(updateRemainingDisplay, 30000);
}

function updateRemainingDisplay() {
  if (!currentSession) return;
  const remainingMs = getRemainingMs(currentSession.expiryTimestamp, Date.now());
  activeRemaining.textContent = formatRemainingTime(remainingMs);
}

navigateButton.addEventListener('click', () => {
  if (!currentSession) return;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${currentSession.lat},${currentSession.lng}`;
  window.open(url, '_blank');
});

doneButton.addEventListener('click', async () => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  await endActiveSession();
  currentSession = null;
  await renderApp();
});

async function renderApp() {
  const active = await getActiveSession();
  if (active) {
    startView.classList.add('hidden');
    activeView.classList.remove('hidden');
    renderActiveSession(active);
  } else {
    startView.classList.remove('hidden');
    activeView.classList.add('hidden');
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }
}

async function init() {
  swRegistration = await registerServiceWorker();
  updateCustomMinutesVisibility();
  await renderApp();
}

init();
```

- [ ] **Step 2: Manual browser verification**

```bash
cd /Users/laptopm5/Documents/Dev/park
python3 -m http.server 8765
```

Open `http://localhost:8765/`. Start a session with a note and a photo (pick any image file), preset "Betaald parkeren", 2 minutes. Confirm the active view shows the note, the photo, and a "2m resterend" countdown that ticks down. Click "Navigeer terug" and confirm a new tab opens to Google Maps directions pointed at your coordinates. Go back, click "Klaar / auto opgehaald" and confirm it returns to the start form. Stop the server when done.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "Add active-session view: countdown, navigate-back, and done button"
```

---

### Task 8: Notifications — scheduling, fallback check, in-app banner

**Files:**
- Modify: `app.js` (full replacement below)
- Modify: `sw.js` (add `notificationclick` handler)

**Interfaces:**
- Consumes: `WARNING_MINUTES_BEFORE`, `getNotificationDue` from `lib/session-logic.js` (added to Task 7's imports)
- Produces: `checkNotificationsOnResume()` — called on `init()` and on `visibilitychange`; Task 9 does not call this directly but must not remove it.

- [ ] **Step 1: Replace `app.js` with:**

```js
import { saveSession, getActiveSession, endActiveSession } from './db.js';
import {
  PRESETS,
  WARNING_MINUTES_BEFORE,
  calculateExpiryTimestamp,
  getRemainingMs,
  formatRemainingTime,
  getNotificationDue,
} from './lib/session-logic.js';

const startView = document.getElementById('start-view');
const activeView = document.getElementById('active-view');
const banner = document.getElementById('banner');
const parkForm = document.getElementById('park-form');
const parkButton = document.getElementById('park-button');
const parkError = document.getElementById('park-error');
const presetRadios = parkForm.querySelectorAll('input[name="preset"]');
const customMinutesWrap = document.getElementById('custom-minutes-wrap');
const customMinutesInput = document.getElementById('custom-minutes');
const activeNote = document.getElementById('active-note');
const activePhoto = document.getElementById('active-photo');
const activeRemaining = document.getElementById('active-remaining');
const navigateButton = document.getElementById('navigate-button');
const doneButton = document.getElementById('done-button');

let swRegistration = null;
let currentSession = null;
let countdownInterval = null;
let currentPhotoUrl = null;
let warningTimeoutId = null;
let expiryTimeoutId = null;

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('./sw.js');
  } catch (err) {
    console.error('Service worker registratie mislukt:', err);
    return null;
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation wordt niet ondersteund door deze browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

function updateCustomMinutesVisibility() {
  const selected = parkForm.querySelector('input[name="preset"]:checked').value;
  customMinutesWrap.classList.toggle('hidden', selected !== PRESETS.PAID);
}

presetRadios.forEach((radio) => radio.addEventListener('change', updateCustomMinutesVisibility));

async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

async function fireNotification(title, body) {
  if (swRegistration && swRegistration.showNotification) {
    await swRegistration.showNotification(title, { body });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function clearScheduledNotifications() {
  if (warningTimeoutId) { clearTimeout(warningTimeoutId); warningTimeoutId = null; }
  if (expiryTimeoutId) { clearTimeout(expiryTimeoutId); expiryTimeoutId = null; }
}

function scheduleNotifications(session) {
  clearScheduledNotifications();
  if (session.expiryTimestamp === null) return;

  const now = Date.now();
  const warningAt = session.expiryTimestamp - WARNING_MINUTES_BEFORE * 60 * 1000;

  if (!session.notified10min && warningAt > now) {
    warningTimeoutId = setTimeout(async () => {
      await fireNotification('Je parkeertijd loopt bijna af', 'Nog 10 minuten voordat je parkeertijd verloopt.');
      session.notified10min = true;
      await saveSession(session);
    }, warningAt - now);
  }

  if (!session.notifiedExpiry && session.expiryTimestamp > now) {
    expiryTimeoutId = setTimeout(async () => {
      await fireNotification('Je parkeertijd is verlopen', 'Tijd om je auto op te halen.');
      session.notifiedExpiry = true;
      await saveSession(session);
      await checkNotificationsOnResume();
    }, session.expiryTimestamp - now);
  }
}

function showBanner(message) {
  banner.textContent = message;
  banner.classList.remove('hidden');
}

function hideBanner() {
  banner.classList.add('hidden');
  banner.textContent = '';
}

async function checkNotificationsOnResume() {
  const active = await getActiveSession();
  if (!active) {
    hideBanner();
    return;
  }
  const now = Date.now();
  const due = getNotificationDue(active, now);
  if (due === 'warning') {
    await fireNotification('Je parkeertijd loopt bijna af', 'Nog 10 minuten voordat je parkeertijd verloopt.');
    active.notified10min = true;
    await saveSession(active);
  } else if (due === 'expiry') {
    await fireNotification('Je parkeertijd is verlopen', 'Tijd om je auto op te halen.');
    active.notifiedExpiry = true;
    await saveSession(active);
  }
  if (active.expiryTimestamp !== null && now >= active.expiryTimestamp) {
    showBanner('Je parkeertijd is verlopen. Tik op "Navigeer terug" om je auto op te halen.');
  } else {
    hideBanner();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkNotificationsOnResume();
  }
});

parkForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  parkError.classList.add('hidden');
  parkButton.disabled = true;
  try {
    const position = await getCurrentPosition();
    const preset = parkForm.querySelector('input[name="preset"]:checked').value;
    const customMinutes = preset === PRESETS.PAID ? Number(customMinutesInput.value) : null;
    const now = Date.now();
    const expiryTimestamp = calculateExpiryTimestamp(preset, customMinutes, now);
    const photoFile = document.getElementById('photo').files[0] || null;

    const session = {
      id: crypto.randomUUID(),
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: now,
      note: document.getElementById('note').value.trim(),
      photoBlob: photoFile,
      expiryTimestamp,
      presetType: preset,
      active: true,
      notified10min: false,
      notifiedExpiry: false,
    };

    await requestNotificationPermission();
    await saveSession(session);
    parkForm.reset();
    updateCustomMinutesVisibility();
    await renderApp();
  } catch (err) {
    console.error(err);
    parkError.textContent = err.message || 'Er ging iets mis bij het opslaan van je parkeersessie.';
    parkError.classList.remove('hidden');
  } finally {
    parkButton.disabled = false;
  }
});

function renderActiveSession(session) {
  currentSession = session;
  activeNote.textContent = session.note || '(geen notitie)';

  if (currentPhotoUrl) {
    URL.revokeObjectURL(currentPhotoUrl);
    currentPhotoUrl = null;
  }
  if (session.photoBlob) {
    currentPhotoUrl = URL.createObjectURL(session.photoBlob);
    activePhoto.src = currentPhotoUrl;
    activePhoto.classList.remove('hidden');
  } else {
    activePhoto.classList.add('hidden');
  }

  updateRemainingDisplay();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(updateRemainingDisplay, 30000);

  scheduleNotifications(session);
}

function updateRemainingDisplay() {
  if (!currentSession) return;
  const remainingMs = getRemainingMs(currentSession.expiryTimestamp, Date.now());
  activeRemaining.textContent = formatRemainingTime(remainingMs);
}

navigateButton.addEventListener('click', () => {
  if (!currentSession) return;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${currentSession.lat},${currentSession.lng}`;
  window.open(url, '_blank');
});

doneButton.addEventListener('click', async () => {
  clearScheduledNotifications();
  hideBanner();
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  await endActiveSession();
  currentSession = null;
  await renderApp();
});

async function renderApp() {
  const active = await getActiveSession();
  if (active) {
    startView.classList.add('hidden');
    activeView.classList.remove('hidden');
    renderActiveSession(active);
  } else {
    startView.classList.remove('hidden');
    activeView.classList.add('hidden');
    clearScheduledNotifications();
    hideBanner();
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }
}

async function init() {
  swRegistration = await registerServiceWorker();
  updateCustomMinutesVisibility();
  await renderApp();
  await checkNotificationsOnResume();
}

init();
```

- [ ] **Step 2: Append the `notificationclick` handler to `sw.js`**

```js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('./');
    })
  );
});
```

- [ ] **Step 3: Manual browser verification**

```bash
cd /Users/laptopm5/Documents/Dev/park
python3 -m http.server 8765
```

Open `http://localhost:8765/` in Chrome, allow notifications when prompted. Start a session with preset "Betaald parkeren" and 1 minute (this fires the expiry notification almost immediately since the 10-min warning window is longer than the session itself — confirms the "already past warning time" path). Wait up to 60 seconds and confirm a system notification "Je parkeertijd is verlopen" appears. Separately, start a fresh session with 15 minutes, switch to another browser tab for a few seconds and back (triggering `visibilitychange`) — confirm no premature banner appears. Then use DevTools Console to force an expiry check without waiting:

```js
const db = await import('./db.js');
const active = await db.getActiveSession();
active.expiryTimestamp = Date.now() - 1000;
await db.saveSession(active);
document.dispatchEvent(new Event('visibilitychange'));
```

Confirm the in-app banner "Je parkeertijd is verlopen..." appears. Stop the server when done.

- [ ] **Step 4: Commit**

```bash
git add app.js sw.js
git commit -m "Add expiry notifications with resume-time fallback and in-app banner"
```

---

### Task 9: History (last 5 sessions) + final acceptance pass

**Files:**
- Modify: `app.js` (full replacement below)

**Interfaces:**
- Consumes: `getHistory` from `db.js` (added to Task 8's imports)
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Replace `app.js` with:**

```js
import { saveSession, getActiveSession, getHistory, endActiveSession } from './db.js';
import {
  PRESETS,
  WARNING_MINUTES_BEFORE,
  calculateExpiryTimestamp,
  getRemainingMs,
  formatRemainingTime,
  getNotificationDue,
} from './lib/session-logic.js';

const startView = document.getElementById('start-view');
const activeView = document.getElementById('active-view');
const banner = document.getElementById('banner');
const parkForm = document.getElementById('park-form');
const parkButton = document.getElementById('park-button');
const parkError = document.getElementById('park-error');
const presetRadios = parkForm.querySelectorAll('input[name="preset"]');
const customMinutesWrap = document.getElementById('custom-minutes-wrap');
const customMinutesInput = document.getElementById('custom-minutes');
const activeNote = document.getElementById('active-note');
const activePhoto = document.getElementById('active-photo');
const activeRemaining = document.getElementById('active-remaining');
const navigateButton = document.getElementById('navigate-button');
const doneButton = document.getElementById('done-button');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');

let swRegistration = null;
let currentSession = null;
let countdownInterval = null;
let currentPhotoUrl = null;
let warningTimeoutId = null;
let expiryTimeoutId = null;

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('./sw.js');
  } catch (err) {
    console.error('Service worker registratie mislukt:', err);
    return null;
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation wordt niet ondersteund door deze browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

function updateCustomMinutesVisibility() {
  const selected = parkForm.querySelector('input[name="preset"]:checked').value;
  customMinutesWrap.classList.toggle('hidden', selected !== PRESETS.PAID);
}

presetRadios.forEach((radio) => radio.addEventListener('change', updateCustomMinutesVisibility));

async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

async function fireNotification(title, body) {
  if (swRegistration && swRegistration.showNotification) {
    await swRegistration.showNotification(title, { body });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function clearScheduledNotifications() {
  if (warningTimeoutId) { clearTimeout(warningTimeoutId); warningTimeoutId = null; }
  if (expiryTimeoutId) { clearTimeout(expiryTimeoutId); expiryTimeoutId = null; }
}

function scheduleNotifications(session) {
  clearScheduledNotifications();
  if (session.expiryTimestamp === null) return;

  const now = Date.now();
  const warningAt = session.expiryTimestamp - WARNING_MINUTES_BEFORE * 60 * 1000;

  if (!session.notified10min && warningAt > now) {
    warningTimeoutId = setTimeout(async () => {
      await fireNotification('Je parkeertijd loopt bijna af', 'Nog 10 minuten voordat je parkeertijd verloopt.');
      session.notified10min = true;
      await saveSession(session);
    }, warningAt - now);
  }

  if (!session.notifiedExpiry && session.expiryTimestamp > now) {
    expiryTimeoutId = setTimeout(async () => {
      await fireNotification('Je parkeertijd is verlopen', 'Tijd om je auto op te halen.');
      session.notifiedExpiry = true;
      await saveSession(session);
      await checkNotificationsOnResume();
    }, session.expiryTimestamp - now);
  }
}

function showBanner(message) {
  banner.textContent = message;
  banner.classList.remove('hidden');
}

function hideBanner() {
  banner.classList.add('hidden');
  banner.textContent = '';
}

async function checkNotificationsOnResume() {
  const active = await getActiveSession();
  if (!active) {
    hideBanner();
    return;
  }
  const now = Date.now();
  const due = getNotificationDue(active, now);
  if (due === 'warning') {
    await fireNotification('Je parkeertijd loopt bijna af', 'Nog 10 minuten voordat je parkeertijd verloopt.');
    active.notified10min = true;
    await saveSession(active);
  } else if (due === 'expiry') {
    await fireNotification('Je parkeertijd is verlopen', 'Tijd om je auto op te halen.');
    active.notifiedExpiry = true;
    await saveSession(active);
  }
  if (active.expiryTimestamp !== null && now >= active.expiryTimestamp) {
    showBanner('Je parkeertijd is verlopen. Tik op "Navigeer terug" om je auto op te halen.');
  } else {
    hideBanner();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkNotificationsOnResume();
  }
});

parkForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  parkError.classList.add('hidden');
  parkButton.disabled = true;
  try {
    const position = await getCurrentPosition();
    const preset = parkForm.querySelector('input[name="preset"]:checked').value;
    const customMinutes = preset === PRESETS.PAID ? Number(customMinutesInput.value) : null;
    const now = Date.now();
    const expiryTimestamp = calculateExpiryTimestamp(preset, customMinutes, now);
    const photoFile = document.getElementById('photo').files[0] || null;

    const session = {
      id: crypto.randomUUID(),
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: now,
      note: document.getElementById('note').value.trim(),
      photoBlob: photoFile,
      expiryTimestamp,
      presetType: preset,
      active: true,
      notified10min: false,
      notifiedExpiry: false,
    };

    await requestNotificationPermission();
    await saveSession(session);
    parkForm.reset();
    updateCustomMinutesVisibility();
    await renderApp();
  } catch (err) {
    console.error(err);
    parkError.textContent = err.message || 'Er ging iets mis bij het opslaan van je parkeersessie.';
    parkError.classList.remove('hidden');
  } finally {
    parkButton.disabled = false;
  }
});

function renderActiveSession(session) {
  currentSession = session;
  activeNote.textContent = session.note || '(geen notitie)';

  if (currentPhotoUrl) {
    URL.revokeObjectURL(currentPhotoUrl);
    currentPhotoUrl = null;
  }
  if (session.photoBlob) {
    currentPhotoUrl = URL.createObjectURL(session.photoBlob);
    activePhoto.src = currentPhotoUrl;
    activePhoto.classList.remove('hidden');
  } else {
    activePhoto.classList.add('hidden');
  }

  updateRemainingDisplay();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(updateRemainingDisplay, 30000);

  scheduleNotifications(session);
}

function updateRemainingDisplay() {
  if (!currentSession) return;
  const remainingMs = getRemainingMs(currentSession.expiryTimestamp, Date.now());
  activeRemaining.textContent = formatRemainingTime(remainingMs);
}

navigateButton.addEventListener('click', () => {
  if (!currentSession) return;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${currentSession.lat},${currentSession.lng}`;
  window.open(url, '_blank');
});

doneButton.addEventListener('click', async () => {
  clearScheduledNotifications();
  hideBanner();
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  await endActiveSession();
  currentSession = null;
  await renderApp();
});

function formatHistoryTimestamp(ts) {
  return new Date(ts).toLocaleString('nl-BE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

async function renderHistory() {
  const history = await getHistory();
  historyList.innerHTML = '';
  if (history.length === 0) {
    historySection.classList.add('hidden');
    return;
  }
  historySection.classList.remove('hidden');
  history.forEach((session) => {
    const li = document.createElement('li');
    const when = formatHistoryTimestamp(session.timestamp);
    const noteText = session.note ? ` — ${session.note}` : '';
    li.textContent = `${when}${noteText}`;
    historyList.appendChild(li);
  });
}

async function renderApp() {
  const active = await getActiveSession();
  if (active) {
    startView.classList.add('hidden');
    activeView.classList.remove('hidden');
    renderActiveSession(active);
  } else {
    startView.classList.remove('hidden');
    activeView.classList.add('hidden');
    clearScheduledNotifications();
    hideBanner();
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    await renderHistory();
  }
}

async function init() {
  swRegistration = await registerServiceWorker();
  updateCustomMinutesVisibility();
  await renderApp();
  await checkNotificationsOnResume();
}

init();
```

- [ ] **Step 2: Manual browser verification of history**

```bash
cd /Users/laptopm5/Documents/Dev/park
python3 -m http.server 8765
```

Open `http://localhost:8765/`. Start and immediately end (via "Klaar / auto opgehaald") 3 sessions in a row with different notes. Confirm "Eerdere sessies" appears on the start screen listing the 3 most recent first. Repeat until 6 total sessions have been ended and confirm only the 5 most recent remain.

- [ ] **Step 3: Full acceptance-criteria walkthrough**

Go through every checkbox in `parkeerherinnering-buildspec.md`'s "Acceptatiecriteria" section against the running app: installable as PWA (check the browser's install icon appears), location captured and saved, timer presets compute correct expiry, notification shown before expiry on Chrome, "Navigeer terug" opens correct coordinates, active session survives reload, and the app loads with DevTools Network set to "Offline" after the first successful load. Note and fix any gap found before proceeding. Stop the server when done.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "Add session history list and complete MVP acceptance pass"
```

---

## Self-Review Notes

- **Spec coverage:** every buildspec MVP item (1–7) and every acceptance-criteria checkbox maps to a task above; the stretch-goal history (item 7) is Task 9.
- **Type consistency:** the session object shape is defined once in Task 4 and reused verbatim (same field names) in every subsequent `app.js` version; `db.js` function names (`saveSession`, `getActiveSession`, `getHistory`, `endActiveSession`) and `lib/session-logic.js` export names are identical across every task that imports them.
- **No placeholders:** every step ships complete, runnable code; manual-test tasks name the exact clicks/console commands to run instead of a generic "verify it works."
