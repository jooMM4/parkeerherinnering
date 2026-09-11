# Parkeerherinnering op Google Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Tasks 1 and 5 involve account-settings changes and real third-party-site actions (downloads, form submissions) that this session's operating rules require explicit human permission for at each instance — these steps must not be silently automated by an implementer, whether the controller or a dispatched subagent.**

**Goal:** Get the existing Parkeerherinnering PWA hosted publicly and packaged as a signed Android App Bundle that the user can upload to their own Google Play Console, plus all the store-listing content (privacy policy, descriptions, screenshots, feature graphic, Data Safety answers) needed to actually submit it.

**Architecture:** Push the existing PWA unchanged to GitHub Pages for public HTTPS hosting, use PWABuilder's cloud service (driven via browser automation) to generate a signed Trusted Web Activity Android package from the live URL, then close the loop by publishing PWABuilder's generated Digital Asset Links file back onto the hosted site so Chrome trusts the app/site pairing. No PWA source code changes.

**Tech Stack:** Git/GitHub Pages for hosting, PWABuilder (pwabuilder.com) for Android packaging, Claude's Chrome browser automation tools for driving PWABuilder and capturing store-listing screenshots. No Java/Android SDK installation (unavailable on this machine — this is why PWABuilder was chosen over Bubblewrap CLI).

**Spec:** `/Users/laptopm5/Documents/Dev/park/docs/superpowers/specs/2026-09-11-android-play-store-design.md`

## Global Constraints

- GitHub repo (empty, created by user): `https://github.com/jooMM4/parkeerherinnering.git`
- Android package name (immutable after publish): `com.joodev.parkeerherinnering`
- App display name: `Parkeerherinnering`
- All user-facing text (privacy policy, store listing, screenshots) is Dutch, matching the app itself.
- No task may require installing a JDK or Android SDK.
- Before downloading any file from a third-party site (PWABuilder) or submitting any form with real values, STOP and ask the user for explicit permission, stating exactly what will be downloaded (filename, source, approx. size) or submitted.
- Before changing any GitHub account/repo setting (enabling Pages), give the user the exact manual steps first; only perform it via browser automation if the user explicitly grants permission for that specific action.
- The final Play Console upload and "Submit for review" click are out of scope for any task in this plan — the last task produces a checklist for the user, not an attempted submission.
- Icons already exist at `icons/icon-192.png` / `icons/icon-512.png` in the repo — reuse them, do not regenerate.

---

## File Structure

- `.well-known/assetlinks.json` — Digital Asset Links file proving the Android app and the hosted site are the same origin. Created in Task 6, using the real fingerprint PWABuilder generates in Task 5 (cannot be written correctly before Task 5 runs).
- `privacy.html` — Dutch privacy policy page, hosted alongside the app (Task 2).
- `docs/play-store/store-listing.md` — short/long description text + Data Safety form answers, reference doc for the user to copy into Play Console (Task 3).
- `store-assets/screenshots/*.png` — phone screenshots of the running app (Task 4).
- `store-assets/feature-graphic.png` — 1024×500 Play Store feature graphic (Task 4).
- `store-assets/feature-graphic.html` — throwaway design canvas used to generate the feature graphic (Task 4), kept for future edits.
- `docs/play-store/android-package/` — downloaded PWABuilder output (signed .aab, keystore, generated assetlinks.json) (Task 5). **This directory contains a private signing key — never commit it.**
- `docs/play-store/publish-checklist.md` — final step-by-step checklist for the user's own Play Console submission (Task 7).
- `.gitignore` — updated to exclude `docs/play-store/android-package/` (contains the private keystore).

---

### Task 1: Host the PWA on GitHub Pages

**Files:**
- Modify: `.git/config` (via `git remote add`)
- No app files change — this pushes the existing repo as-is.

**Interfaces:**
- Consumes: nothing
- Produces: a live HTTPS URL (`https://joomm4.github.io/parkeerherinnering/`) that every later task depends on.

- [ ] **Step 1: Add the GitHub remote and push**

```bash
cd /Users/laptopm5/Documents/Dev/park
git remote add origin https://github.com/jooMM4/parkeerherinnering.git
git push -u origin master
```

Expected: push succeeds, all 13 existing commits land on GitHub.

- [ ] **Step 2: Enable GitHub Pages**

This is a repository-settings change on the user's GitHub account. Ask the user which they prefer:

> "GitHub Pages needs to be turned on for this repo. Either:
> 1. You do it yourself: go to `https://github.com/jooMM4/parkeerherinnering/settings/pages`, under "Build and deployment" set **Source: Deploy from a branch**, **Branch: master**, **Folder: / (root)**, click **Save**.
> 2. I do it for you via the browser, if you're logged into GitHub in Chrome and grant permission.
>
> Which would you prefer?"

Wait for the user's answer and either let them confirm they've done it, or get explicit permission before navigating to that settings page and clicking Save on their behalf.

- [ ] **Step 3: Verify the site is live**

GitHub Pages builds can take 1-2 minutes after first enabling. Poll:

```bash
for i in 1 2 3 4 5 6; do
  code=$(curl -s -o /dev/null -w "%{http_code}" https://joomm4.github.io/parkeerherinnering/)
  echo "attempt $i: $code"
  [ "$code" = "200" ] && break
  sleep 20
done
curl -s https://joomm4.github.io/parkeerherinnering/ | grep -o '<title>Parkeerherinnering</title>'
```

Expected: HTTP 200 and the title tag found within 6 attempts (~2 minutes).

- [ ] **Step 4: No commit needed for this task** (nothing new to commit — the remote/push already covers it). Confirm with `git remote -v` and `git status` that origin is set and the working tree is clean.

---

### Task 2: Write and deploy the Dutch privacy policy

**Files:**
- Create: `privacy.html`

**Interfaces:**
- Consumes: the live URL from Task 1 (for verification only)
- Produces: `https://joomm4.github.io/parkeerherinnering/privacy.html`, which Task 7's checklist tells the user to paste into Play Console's privacy policy field.

- [ ] **Step 1: Create `privacy.html`**

```html
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Privacyverklaring — Parkeerherinnering</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main class="app">
    <h1>Privacyverklaring</h1>
    <p>Laatst bijgewerkt: 11 september 2026</p>

    <p>Parkeerherinnering is een Progressive Web App zonder backend, zonder
    account en zonder externe servers. Alle gegevens die je invoert blijven
    uitsluitend op je eigen toestel.</p>

    <h2>Welke gegevens verzamelt de app?</h2>
    <ul>
      <li><strong>Locatie</strong> — vastgelegd wanneer je op "Ik parkeer
        hier" tikt, via de Geolocation-API van je browser. Wordt lokaal
        opgeslagen (IndexedDB) en nooit verzonden naar een server.</li>
      <li><strong>Notitie en foto (optioneel)</strong> — blijven lokaal
        opgeslagen op je toestel.</li>
    </ul>

    <h2>Wordt er iets gedeeld met derden?</h2>
    <p>Nee. Deze app heeft geen backend, geen analytics, geen advertenties
    en geen enkele netwerkverbinding, behalve de optionele link naar Google
    Maps die je zelf activeert via de "Navigeer terug"-knop. Dat opent de
    Google Maps-app of -website met de bewaarde coördinaten; Google's
    eigen privacybeleid is daarop van toepassing zodra je die link
    opent.</p>

    <h2>Hoe lang worden gegevens bewaard?</h2>
    <p>Tot je op "Klaar / auto opgehaald" tikt (actieve sessie), of tot de
    geschiedenis de laatste 5 sessies overschrijft. Je kan alle gegevens op
    elk moment zelf verwijderen door de site-data van de app te wissen via
    je browser- of toestelinstellingen.</p>

    <h2>Contact</h2>
    <p>Vragen over deze privacyverklaring? Neem contact op via
    <a href="mailto:joodev@proton.me">joodev@proton.me</a>.</p>

    <p><a href="./index.html">&larr; Terug naar de app</a></p>
  </main>
</body>
</html>
```

- [ ] **Step 2: Commit and push**

```bash
cd /Users/laptopm5/Documents/Dev/park
git add privacy.html
git commit -m "Add Dutch privacy policy page for Play Store listing"
git push
```

- [ ] **Step 3: Verify it's live**

```bash
sleep 30
curl -s https://joomm4.github.io/parkeerherinnering/privacy.html | grep -o '<title>Privacyverklaring — Parkeerherinnering</title>'
```

Expected: title tag found. (GitHub Pages redeploys automatically on push; 30s is usually enough, retry with another 30s sleep once if it isn't.)

---

### Task 3: Draft Play Store listing text and Data Safety answers

**Files:**
- Create: `docs/play-store/store-listing.md`

**Interfaces:**
- Consumes: nothing
- Produces: text the user copy-pastes into Play Console fields in Task 7 — this task does not touch Play Console itself.

- [ ] **Step 1: Create `docs/play-store/store-listing.md`**

```markdown
# Play Store listing — Parkeerherinnering

## Korte beschrijving (max. 80 tekens — deze telt 66)

Onthoud waar je geparkeerd staat en mis nooit meer je parkeertijd.

## Volledige beschrijving (max. 4000 tekens)

Parkeerherinnering helpt je onthouden waar je geparkeerd staat en
waarschuwt je op tijd voordat je parkeertijd verloopt.

**Hoe het werkt**
- Tik op "Ik parkeer hier" om je locatie vast te leggen.
- Voeg optioneel een notitie toe (bv. "verdieping 3, blauwe pijl") of een
  foto van je parkeerticket of de straatnaam.
- Kies een timer: blauwe zone (2 uur), betaald parkeren (zelf in te
  stellen), of gewoon geen limiet als je alleen de locatie wil onthouden.
- Je krijgt een melding 10 minuten voor je parkeertijd verloopt, en
  nogmaals op het moment zelf.
- Tik op "Navigeer terug" voor een routebeschrijving naar je auto via
  Google Maps.

**Privacy eerst**
Geen account nodig, geen cloud, geen tracking. Alle gegevens blijven op je
eigen toestel. Zie de privacyverklaring voor details.

**Let op**
Achtergrondmeldingen zijn op iOS Safari beperkt betrouwbaar door Apple's
eigen restricties — op Android werkt dit prima. De app controleert ook
altijd opnieuw zodra je 'm terug opent, met een banner als je tijd al
verlopen is.

## Categorie

Hulpprogramma's (Tools)

## Privacybeleid-URL

https://joomm4.github.io/parkeerherinnering/privacy.html

## Contactgegevens

joodev@proton.me

## Data Safety formulier — antwoorden

Play's Data Safety formulier vraagt specifiek naar gegevens die van het
toestel naar de ontwikkelaar of een derde partij worden **verzonden**.
Deze app heeft geen backend en verzendt niets — dus voor elke
gegevenscategorie is het juiste antwoord "Nee, deze app verzamelt dit
type gegevens niet":

- **Locatie** (approximate/precise): app gebruikt de Geolocation-API,
  maar de coördinaten worden alleen lokaal in IndexedDB opgeslagen —
  nooit verzonden. Antwoord: **niet verzameld** (niet: "verzameld maar
  niet gedeeld" — er is letterlijk geen netwerkverzending).
- **Foto's/video's**: optioneel toegevoegd, blijft lokaal. Antwoord:
  **niet verzameld**.
- **Alle overige categorieën** (persoonlijke info, financiële info,
  berichten, activiteit binnen de app, apparaat-/andere ID's,
  prestatiegegevens, enz.): niet van toepassing, app heeft geen accounts,
  geen analytics-SDK's, geen advertentienetwerk. Antwoord: **niet
  verzameld** voor alles.
- **Versleuteling tijdens verzending**: niet van toepassing (er is geen
  verzending).
- **Gebruikers kunnen verzoeken dat gegevens worden verwijderd**: ja, via
  de eigen "Klaar"-knop in de app of door site-data te wissen in de
  browser/toestelinstellingen.

## Contentrating-vragenlijst — richtlijnen

Geen geweld, geen door gebruikers gegenereerde content die met anderen
wordt gedeeld, geen advertenties, geen aankopen in de app, geen
gebruikersinteractie met andere gebruikers. Dit resulteert doorgaans in de
laagste/mildste rating (bv. "Voor iedereen" / "PEGI 3").
```

- [ ] **Step 2: Verify the character-limit claims**

```bash
cd /Users/laptopm5/Documents/Dev/park
python3 -c "
short = 'Onthoud waar je geparkeerd staat en mis nooit meer je parkeertijd.'
print('short desc length:', len(short))
assert len(short) <= 80
"
```

Expected: prints a number ≤ 80, no assertion error.

- [ ] **Step 3: Commit**

```bash
git add docs/play-store/store-listing.md
git commit -m "Draft Play Store listing text and Data Safety form answers"
```

---

### Task 4: Generate screenshots and feature graphic

**Files:**
- Create: `store-assets/screenshots/01-start.png`
- Create: `store-assets/screenshots/02-active-session.png`
- Create: `store-assets/feature-graphic.html`
- Create: `store-assets/feature-graphic.png`

**Interfaces:**
- Consumes: the live site from Task 1 (`https://joomm4.github.io/parkeerherinnering/`)
- Produces: image files Task 7's checklist tells the user to upload to Play Console.

- [ ] **Step 1: Capture the start-screen screenshot**

Using Chrome browser automation tools (load them via `ToolSearch` with query `"select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__tabs_close_mcp"` if deferred):

1. Create a tab, navigate to `https://joomm4.github.io/parkeerherinnering/`.
2. Resize the window to 1080×1920 (a standard Play Store phone screenshot size, 9:16 — well within Play's required max-2:1 ratio).
3. Take a screenshot with `save_to_disk: true`.
4. Save the result as `store-assets/screenshots/01-start.png`.

- [ ] **Step 2: Capture an active-session screenshot**

Seed a realistic-looking session purely for the screenshot (this is throwaway test data on the live site, not real user data — clear it in Step 3):

Via javascript_tool on the same tab:
```js
navigator.geolocation.getCurrentPosition = (success) => success({ coords: { latitude: 51.0500, longitude: 3.7300 } });
document.getElementById('note').value = 'Verdieping 2, blauwe pijl richting uitgang';
document.querySelector('input[name="preset"][value="blue-zone"]').checked = true;
document.getElementById('park-form').dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));
```
Wait ~1s, take a screenshot with `save_to_disk: true`, save as `store-assets/screenshots/02-active-session.png`.

- [ ] **Step 3: Clean up the seeded session on the live site**

```js
const db = await import('./db.js');
await db.endActiveSession();
```
Reload the page to confirm it shows the start screen again, then close the tab.

- [ ] **Step 4: Build the feature graphic design canvas**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  html, body { margin: 0; padding: 0; width: 1024px; height: 500px; overflow: hidden; }
  .graphic {
    width: 1024px; height: 500px;
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    display: flex; align-items: center; justify-content: center; gap: 48px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .icon {
    width: 200px; height: 200px; border-radius: 36px;
    background: #ffffff; display: flex; align-items: center; justify-content: center;
    font-size: 140px; font-weight: 800; color: #2563eb;
  }
  .text h1 { color: #ffffff; font-size: 56px; margin: 0 0 12px; }
  .text p { color: #dbeafe; font-size: 26px; margin: 0; max-width: 520px; }
</style>
</head>
<body>
  <div class="graphic">
    <div class="icon">P</div>
    <div class="text">
      <h1>Parkeerherinnering</h1>
      <p>Onthoud waar je geparkeerd staat en mis nooit meer je parkeertijd.</p>
    </div>
  </div>
</body>
</html>
```

Save as `store-assets/feature-graphic.html`.

- [ ] **Step 5: Render the feature graphic**

1. Navigate a tab to `file:///Users/laptopm5/Documents/Dev/park/store-assets/feature-graphic.html`.
2. Resize the window so the viewport is exactly 1024×500.
3. Take a screenshot with `save_to_disk: true`.
4. Save as `store-assets/feature-graphic.png`.

- [ ] **Step 6: Verify image dimensions**

```bash
cd /Users/laptopm5/Documents/Dev/park
file store-assets/screenshots/01-start.png store-assets/screenshots/02-active-session.png store-assets/feature-graphic.png
```

Expected: `feature-graphic.png` reports `1024 x 500`; both screenshots report dimensions with the longer side ÷ shorter side ≤ 2 (e.g. 1080×1920 is exactly 1.78).

- [ ] **Step 7: Commit**

```bash
git add store-assets/
git commit -m "Add Play Store screenshots and feature graphic"
git push
```

---

### Task 5: Package the app via PWABuilder

**Files:**
- Create: `docs/play-store/android-package/` (downloaded files — .aab, keystore, generated assetlinks.json)
- Modify: `.gitignore` (exclude the keystore)

**Interfaces:**
- Consumes: the live site from Task 1
- Produces: a signed `.aab` file and a generated `assetlinks.json` containing the real signing-certificate SHA-256 fingerprint, which Task 6 consumes verbatim.

- [ ] **Step 1: Update `.gitignore`**

Add this line to the existing `.gitignore`:
```
docs/play-store/android-package/
```
This directory will contain a private signing key — it must never be committed.

- [ ] **Step 2: Navigate PWABuilder and start packaging**

Load Chrome tools via `ToolSearch` if deferred (same set as Task 4, no `resize_window` needed here). Navigate a tab to `https://www.pwabuilder.com/`. Enter the live URL `https://joomm4.github.io/parkeerherinnering/` into PWABuilder's input and start the scan. Wait for it to finish analyzing the manifest and service worker.

- [ ] **Step 3: Check PWABuilder's validation results**

Take a screenshot of the results page. Expected: manifest and service worker both show green/passing checks (icons, name, start_url, display mode already satisfy PWA requirements from the original build). If anything shows as failing, stop and report it — do not proceed to packaging with unresolved errors.

- [ ] **Step 4: Configure the Android package — ASK PERMISSION before submitting**

Navigate to the Android packaging options. Fill in (do not submit yet):
- Package ID: `com.joodev.parkeerherinnering`
- App name: `Parkeerherinnering`
- Signing: choose "Create a new signing key" (PWABuilder generates one)

**Before clicking the final "Generate" / "Download" action, stop and ask the user:**

> "I'm about to submit PWABuilder's Android packaging form with package ID `com.joodev.parkeerherinnering` and app name `Parkeerherinnering`, which will generate a new signing key and a downloadable .zip (typically a few MB, containing the .aab, the keystore, and a ready-made assetlinks.json). OK to proceed?"

Wait for explicit yes before continuing.

- [ ] **Step 5: Generate and download — ASK PERMISSION before the download itself**

Click generate. When PWABuilder offers the download, confirm with the user again if the offer wasn't covered by Step 4's permission (state the actual filename PWABuilder shows), then download it to `docs/play-store/android-package/`.

- [ ] **Step 6: Unzip and inventory the contents**

```bash
cd /Users/laptopm5/Documents/Dev/park/docs/play-store/android-package
unzip -o *.zip
find . -maxdepth 2 -type f | sort
```

Expected: at minimum a `.aab` file, a `.keystore` or `.jks` file, and an `assetlinks.json` file (PWABuilder generates this automatically as part of the Android package output). If `assetlinks.json` isn't present in the download, look for the SHA-256 fingerprint value displayed directly on PWABuilder's results page instead and note it for Task 6.

- [ ] **Step 7: Verify the AAB is structurally valid**

AAB files are zip archives, so this works without any Java/Android tooling:

```bash
unzip -l docs/play-store/android-package/*.aab | head -20
```

Expected: a zip listing showing typical AAB internals (e.g. `base/manifest/AndroidManifest.xml`, `BundleConfig.pb`). A failure here (not a valid zip) means the download was corrupted — re-download.

- [ ] **Step 8: Tell the user to back up the keystore NOW**

Report the exact path to the keystore file and remind the user: this file must be backed up somewhere safe and permanent (password manager, encrypted backup) before Task 7's checklist has them upload to Play Console — losing it before Play App Signing registers it means the app can never be updated again.

- [ ] **Step 9: Commit the .gitignore change only**

```bash
cd /Users/laptopm5/Documents/Dev/park
git add .gitignore
git commit -m "Ignore downloaded Android package directory (contains private signing key)"
```

---

### Task 6: Deploy the real Digital Asset Links file

**Files:**
- Create: `.well-known/assetlinks.json`

**Interfaces:**
- Consumes: the `assetlinks.json` content (or fingerprint value) produced by Task 5
- Produces: `https://joomm4.github.io/parkeerherinnering/.well-known/assetlinks.json`, which Chrome checks at install/launch time to trust the TWA.

- [ ] **Step 1: Copy PWABuilder's generated file into the repo**

```bash
cd /Users/laptopm5/Documents/Dev/park
cp docs/play-store/android-package/assetlinks.json .well-known/assetlinks.json
```

If PWABuilder didn't produce a ready-made file (per Task 5 Step 6's fallback), construct it manually using the noted fingerprint:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.joodev.parkeerherinnering",
    "sha256_cert_fingerprints": ["<fingerprint from PWABuilder>"]
  }
}]
```

- [ ] **Step 2: Validate it's well-formed JSON**

```bash
python3 -m json.tool .well-known/assetlinks.json
```

Expected: pretty-printed JSON output, no parse error. Confirm `package_name` reads exactly `com.joodev.parkeerherinnering`.

- [ ] **Step 3: Commit and push**

```bash
git add .well-known/assetlinks.json
git commit -m "Add Digital Asset Links file linking the Android app to the hosted site"
git push
```

- [ ] **Step 4: Verify it's live and correctly served**

```bash
sleep 30
curl -s https://joomm4.github.io/parkeerherinnering/.well-known/assetlinks.json | python3 -m json.tool
```

Expected: same JSON content served back with HTTP 200 (if this returns an HTML 404 page, GitHub Pages may need the `.well-known` dot-directory allowed — it is by default, but retry once after another 30s if the first check fails).

---

### Task 7: Final validation and Play Console publish checklist

**Files:**
- Create: `docs/play-store/publish-checklist.md`

**Interfaces:**
- Consumes: outputs of every prior task (live URLs, store-listing.md content, screenshot/graphic paths, the .aab path)
- Produces: nothing further consumes this — it's the terminal deliverable handed to the user.

- [ ] **Step 1: Re-verify every live URL in one pass**

```bash
cd /Users/laptopm5/Documents/Dev/park
for path in "" "privacy.html" ".well-known/assetlinks.json"; do
  url="https://joomm4.github.io/parkeerherinnering/${path}"
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  echo "$url -> $code"
done
```

Expected: all three report `200`.

- [ ] **Step 2: Create `docs/play-store/publish-checklist.md`**

```markdown
# Play Console publish checklist — Parkeerherinnering

Alles hieronder is voorbereid; deze laatste stappen moet je zelf zetten in
je eigen Play Console-account.

## 1. Vooraf: bewaar je signing key veilig

Bestand: `docs/play-store/android-package/<naam>.keystore` (of `.jks`).
Zet dit NU ergens veilig en permanent (wachtwoordmanager, versleutelde
back-up) — verlies vóór de eerste succesvolle upload betekent dat je deze
app nooit meer kan updaten.

## 2. Nieuwe app aanmaken in Play Console

1. Log in op https://play.google.com/console
2. "App maken" → naam: `Parkeerherinnering`, taal: Nederlands, type: App,
   gratis.
3. Bevestig de verklaringen (developer program policies, US export laws).

## 3. App-bundle uploaden

1. Production → Create new release (of eerst een Internal Testing-track
   gebruiken om te proberen — aanbevolen voor de allereerste keer).
2. Upload: `docs/play-store/android-package/<naam>.aab`
3. Schakel **Play App Signing** in wanneer gevraagd (standaard aanbevolen).

## 4. Store listing invullen

Gebruik de kant-en-klare tekst uit `docs/play-store/store-listing.md`:
- Korte beschrijving, volledige beschrijving, categorie, contactgegevens.
- Privacybeleid-URL: `https://joomm4.github.io/parkeerherinnering/privacy.html`
- Screenshots: `store-assets/screenshots/01-start.png` en `02-active-session.png`
- Feature graphic: `store-assets/feature-graphic.png`
- App-icoon: `icons/icon-512.png`

## 5. Data Safety formulier

Volg de antwoorden onder "Data Safety formulier — antwoorden" in
`docs/play-store/store-listing.md` — samengevat: voor elke categorie
"niet verzameld", omdat de app geen backend heeft en niets verzendt.

## 6. Contentrating-vragenlijst

Volg de richtlijnen onder "Contentrating-vragenlijst" in
`docs/play-store/store-listing.md`.

## 7. Review en publiceren

1. Controleer alle secties in Play Console op groene vinkjes (geen rode
   waarschuwingen).
2. Klik zelf op "Submit for review" — dit is de enige stap die je zelf
   moet zetten; niemand anders kan dit namens jou doen.
3. Google's review duurt doorgaans enkele uren tot een paar dagen.

## Bij een toekomstige update van de app

1. Werk de code bij in `/Users/laptopm5/Documents/Dev/park`, commit, push
   (GitHub Pages update automatisch).
2. Verhoog de versie in een nieuwe PWABuilder-package met dezelfde
   package ID en dezelfde signing key (of upload key, bij Play App
   Signing).
3. Upload de nieuwe .aab als nieuwe release in Play Console.
```

- [ ] **Step 3: Commit**

```bash
git add docs/play-store/publish-checklist.md
git commit -m "Add final Play Console publish checklist"
git push
```

- [ ] **Step 4: Report completion to the user**

Summarize: live site URL, privacy policy URL, where the .aab and keystore are, where the checklist is, and that the last step (Play Console submission) is theirs to do.

---

## Self-Review Notes

- **Spec coverage:** hosting (Task 1), Digital Asset Links (Tasks 5-6), package identity (Task 5), signing key handling + custody warning (Task 5 Steps 8, Task 7 Step 1), store listing content incl. privacy policy and Data Safety (Tasks 2-3), screenshots/feature graphic (Task 4), division of labor / final checklist (Task 7) — every spec section maps to a task.
- **No placeholders:** every file has complete real content; the two steps that inherently require a live human decision (GitHub Pages settings, PWABuilder form submission/download) are explicit permission-gated checkpoints with concrete wording, not silent placeholders.
- **Type/value consistency:** package name `com.joodev.parkeerherinnering` and the repo URL are used identically (verified by re-reading) across Tasks 1, 5, 6, 7. The live URL `https://joomm4.github.io/parkeerherinnering/` is consistent across all verification steps.
- **No Java/Android SDK dependency:** confirmed no task requires `java`, `keytool` execution, `bundletool`, or Android Studio — AAB validation in Task 5 Step 7 uses only `unzip`, which works without Java since AAB is a zip format.
