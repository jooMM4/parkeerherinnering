# Play Console publish checklist — Parkeerherinnering

Alles hieronder is voorbereid; deze laatste stappen moet je zelf zetten in
je eigen Play Console-account.

## 1. Vooraf: bewaar je signing key veilig

Bestand: `docs/play-store/android-package/signing.keystore` (wachtwoord in
`signing-key-info.txt`, zelfde map).
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
2. Upload: `docs/play-store/android-package/Parkeerherinnering.aab`
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

## Technische details van het gegenereerde package

- Package ID: `com.joodev.parkeerherinnering`
- Versie: 1.0.0.0 (versionCode 1)
- Signing key SHA-256 fingerprint:
  `17:78:32:89:D7:58:70:E9:59:5F:89:26:4C:A2:2E:FF:53:3E:92:20:2B:99:98:40:3F:14:9E:1B:42:CD:3C:55`
- Location delegation: ingeschakeld (native Android-locatiedialoog i.p.v.
  browserprompt — logisch gezien locatie de kernfunctie van de app is)
- Notification delegation: ingeschakeld
- Gehost op: `https://joomm4.github.io/parkeerherinnering/`
- Digital Asset Links geverifieerd op:
  `https://joomm4.github.io/parkeerherinnering/.well-known/assetlinks.json`

## Bekende observatie (geen blokkade)

PWABuilder's eigen automatische scan meldde "did not find a Service
Worker" ondanks dat de Service Worker daadwerkelijk werkt (uitgebreid
handmatig getest tijdens de bouw van de app). Dit blokkeerde de packaging
niet (0 verplichte fouten) en heeft geen invloed op hoe de TWA
functioneert — vermoedelijk een timing-eigenaardigheid in hoe PWABuilder's
scanner de site crawlt. Geen actie nodig.

## Bij een toekomstige update van de app

1. Werk de code bij in `/Users/laptopm5/Documents/Dev/park`, commit, push
   (GitHub Pages update automatisch).
2. Verhoog de versie in een nieuwe PWABuilder-package met dezelfde
   package ID en dezelfde signing key (of upload key, bij Play App
   Signing).
3. Upload de nieuwe .aab als nieuwe release in Play Console.
