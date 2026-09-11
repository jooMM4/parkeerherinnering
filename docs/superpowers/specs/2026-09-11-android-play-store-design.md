# Parkeerherinnering op Google Play — Design

## Doel

De bestaande Parkeerherinnering PWA (gebouwd eerder deze sessie,
`/Users/laptopm5/Documents/Dev/park`) publiceren als Android-app op de Google
Play Store, zonder de app te herschrijven — de PWA blijft de enige bron van
waarheid voor functionaliteit.

## Architectuur

```
PWA (bestaand, getest)
  → gepusht naar GitHub Pages (publieke https-URL)
  → /.well-known/assetlinks.json toegevoegd (bewijst "deze Android-app IS deze site")
  → PWABuilder leest de live URL, genereert een ondertekende Android App Bundle (.aab)
  → gebruiker uploadt de .aab naar bestaande Play Console
  → Google review → gepubliceerd
```

### Waarom Trusted Web Activity (TWA), niet Capacitor

De app gebruikt uitsluitend standaard web-API's die al werken in de PWA
(Geolocation, Notifications, IndexedDB, Service Worker). Een TWA opent de PWA
in een Chrome-gebaseerde weergave zonder browser-UI — geen herbouw nodig,
kleinste footprint, en dit is de door Google zelf gedocumenteerde weg om een
bestaande PWA op Play Store te zetten. Capacitor (een volwaardige native
WebView-wrapper) zou meer controle geven maar is hier pure overhead: geen van
de app's functies heeft native plugins nodig die een TWA niet al aankan.

### Waarom PWABuilder, niet Bubblewrap CLI

Dit systeem heeft geen Java runtime en geen Android SDK geïnstalleerd.
Bubblewrap (Google's eigen CLI) vereist een JDK plus een download van
~1-2GB aan Android SDK-onderdelen om lokaal te bouwen. PWABuilder
(pwabuilder.com, Microsoft, expliciet genoemd in Google's eigen
PWA-naar-Play-Store documentatie) genereert hetzelfde eindresultaat (een
ondertekende TWA) volledig in de cloud vanaf de live site-URL — geen lokale
installatie nodig. Voor een app van deze omvang levert dat geen enkel
functioneel verschil op, alleen minder frictie.

## Onderdelen

### 1. Hosting: GitHub Pages

- Nieuwe publieke repo op GitHub (door gebruiker aangemaakt, bv.
  `parkeerherinnering`), gepusht door Claude via het bestaande lokale
  git-repo.
- GitHub Pages ingeschakeld op de repo, resulterend in een stabiele
  `https://<username>.github.io/parkeerherinnering/` URL.
- Geen wijzigingen aan de PWA-code zelf nodig voor hosting — het is exact
  dezelfde statische site die al lokaal getest is.

### 2. Digital Asset Links (`/.well-known/assetlinks.json`)

Nieuw bestand, toegevoegd aan de gehoste site. Bevat de SHA-256
vingerafdruk van de Android-ondertekeningssleutel (verkregen via
PWABuilder's packaging-stap) zodat Chrome op het toestel de TWA en de
website als hetzelfde vertrouwt — dit is wat de browser-UI (adresbalk)
laat verdwijnen zodat het aanvoelt als een echte app.

### 3. Package identity

- Package name (onveranderlijk na publicatie): `com.joodev.parkeerherinnering`
- App-naam: "Parkeerherinnering" (ongewijzigd)
- Iconen: hergebruikt uit bestaande `icons/icon-192.png` /
  `icons/icon-512.png` — PWABuilder genereert de vereiste Android
  adaptive-icon varianten hieruit.

### 4. Ondertekeningssleutel (signing key)

- PWABuilder genereert een keystore tijdens het packagen.
- Gebruiker schakelt **Play App Signing** in bij de eerste upload (Google's
  huidige standaard) — Google beheert vanaf dan de sleutel die
  daadwerkelijk gebruikers-downloads ondertekent; de lokale keystore
  dient alleen om toekomstige uploads te verifiëren.
- **Kritiek:** de gegenereerde keystore-file moet de gebruiker permanent
  veilig bewaren (bv. wachtwoordmanager of externe backup) — verlies vóór
  de eerste succesvolle upload betekent dat de app nooit meer geüpdatet
  kan worden.

### 5. Store listing content

- **Privacyverklaring** (verplicht door Google omdat de app locatie
  gebruikt): Claude schrijft een korte, accurate pagina en host deze als
  `/privacy.html` op dezelfde GitHub Pages site. Inhoud: geen backend, geen
  analytics, locatie/foto/notitie blijven uitsluitend lokaal in IndexedDB
  op het toestel, niets wordt verzonden of gedeeld.
- **Data Safety formulier** (Play Console): Claude bereidt de antwoorden
  voor — in essentie "geen data verzameld/verzonden", aangezien de app
  nergens naar communiceert.
- **Store-listing tekst** (korte + lange beschrijving, Nederlandstalig):
  door Claude opgesteld op basis van de bestaande buildspec.
- **Screenshots (min. 2) + feature graphic (1024×500)**: Claude genereert
  deze via browseropnames van de draaiende app.

## Taakverdeling

**Claude automatiseert:**
- Push naar GitHub Pages
- `assetlinks.json` toevoegen en verifiëren
- PWABuilder bedienen via de browser, package genereren en downloaden
- Privacyverklaring, store-listing tekst, Data Safety antwoorden opstellen
- Screenshots en feature graphic genereren

**Gebruiker moet zelf doen:**
- GitHub-repo aanmaken (Claude gaf hiervoor stap-voor-stap instructies)
- Inloggen op Play Console en de daadwerkelijke upload + "Submit for
  review" klik — dit is de eigen account en uitgeversverantwoordelijkheid
  van de gebruiker, geen actie die Claude namens hen uitvoert
- De keystore-file veilig en permanent bewaren

## Out of scope

- Geen herschrijving van app-functionaliteit — de PWA blijft ongewijzigd.
- Geen iOS-publicatie (niet gevraagd).
- Geen automatische Play Store-inzending — de laatste "submit"-klik blijft
  bij de gebruiker.

## Openstaande input van gebruiker

- GitHub repository-URL (gebruiker maakt deze aan volgens gegeven
  instructies, en deelt de URL terug)
