# Parkeerherinnering — Build Spec voor Claude Code

Plak dit bestand (of de inhoud ervan) als eerste prompt in Claude Code in een lege projectmap. Claude Code kan hiermee het volledige project opzetten zonder verdere vragen.

---

## Opdracht voor Claude Code

Bouw een **Progressive Web App (PWA)** genaamd "Parkeerherinnering" die mensen helpt onthouden waar ze geparkeerd staan en hen op tijd waarschuwt voor het verlopen van parkeertijd (blauwe zone / betaald parkeren). Geen backend, geen account, alles lokaal op het toestel.

### Tech stack
- Vanilla HTML, CSS, JavaScript (geen framework nodig — houd het licht en snel te bouwen)
- **Geolocation API** voor het vastleggen van de locatie
- **localStorage of IndexedDB** voor het opslaan van sessies (geen server)
- **Service Worker** voor offline-gebruik en lokale notificaties
- **Web Notifications API** voor de herinnering
- **Web App Manifest** zodat de app "installeerbaar" is op telefoon (toevoegen aan beginscherm)
- Terugnavigeren via een link naar Google Maps (`https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`) — geen eigen kaart nodig

### Bestandsstructuur
```
/index.html
/styles.css
/app.js
/sw.js              (service worker)
/manifest.json
/icons/icon-192.png
/icons/icon-512.png
```

### Kernfunctionaliteit (MVP)

1. **"Ik parkeer hier"-knop**
   - Vraagt locatietoestemming, legt lat/lng + timestamp vast.
   - Slaat dit op als actieve sessie in localStorage.

2. **Optionele notitie + foto**
   - Tekstveld voor bv. "verdieping 3, blauwe pijl" of straatnaam.
   - `<input type="file" accept="image/*" capture="environment">` om direct een foto te maken (bv. van het parkeerticket of straatnaambord).

3. **Timer-keuze bij het parkeren**
   Toon een simpele keuzelijst met presets, plus een "aangepast" optie:
   - Blauwe zone (2 uur) — meest voorkomende Belgische regel
   - Betaald parkeren — vrij invulbaar aantal uren/minuten
   - Geen limiet (gewoon alleen locatie onthouden, geen timer)

   Sla het gekozen verval-tijdstip (timestamp) op samen met de sessie.

4. **Notificatie vóór het verlopen**
   - Plan via de Service Worker een lokale notificatie **10 minuten vóór** de vervaltijd, en nogmaals bij het exacte vervalmoment.
   - Toon in de notificatie: "Je parkeertijd loopt bijna af" + knop/link terug naar de app.
   - **Belangrijk:** vermeld in de UI duidelijk dat achtergrondmeldingen op iOS Safari beperkt betrouwbaar zijn (Apple's restricties op web push in de browser). Werkt wél goed op Android/Chrome. Bouw de notificatie-logica zo dat ze *ook* checkt zodra de gebruiker de app terug opent (fallback: banner in de app als de tijd al verlopen is).

5. **"Navigeer terug"-knop**
   - Opent Google Maps met een routebeschrijving naar de opgeslagen lat/lng.

6. **Actieve sessie tonen**
   - Startscherm toont automatisch de actieve parkeersessie (locatie, resterende tijd, foto/notitie) i.p.v. opnieuw de startknop, zolang er een actieve sessie is.
   - Knop "Klaar / auto opgehaald" wist de sessie.

7. **Kleine geschiedenis (stretch goal, mag als laatste)**
   - Bewaar de laatste 5 sessies (locatie + datum) zodat je kan terugkijken waar je vaker parkeert. Niet verplicht voor de MVP.

### UI/UX richtlijnen
- Mobile-first, één hoofdscherm, minimale taps.
- Grote duidelijke knoppen (dit wordt vaak snel gebruikt terwijl je haast hebt).
- Nederlandstalige interface.
- Simpele, rustige kleuren — geen overbodige versiering.

### Niet nodig voor MVP
- Geen inlogsysteem, geen cloud-sync, geen andere talen, geen kaartweergave in-app (Google Maps-link volstaat).

### Acceptatiecriteria
- [ ] App is installeerbaar als PWA (manifest + service worker correct gekoppeld)
- [ ] Locatie wordt succesvol vastgelegd en opgeslagen bij "Ik parkeer hier"
- [ ] Timer-presets werken en berekenen correct het vervalmoment
- [ ] Notificatie wordt (op Android/Chrome) effectief getoond vóór het verlopen
- [ ] "Navigeer terug"-link opent correct Google Maps met de juiste coördinaten
- [ ] Actieve sessie blijft zichtbaar na herladen van de pagina (persistente opslag)
- [ ] Werkt volledig offline na eerste laden (behalve de Google Maps-link uiteraard)

### Testinstructies
Voeg een korte `README.md` toe met:
- Hoe lokaal te draaien (bv. `npx serve .` of `python -m http.server`)
- Opmerking dat Geolocation/Notifications enkel werken over `https://` of `localhost` (browserbeperking)
- Hoe te testen op een telefoon (via lokaal netwerk-IP of een tunnel zoals ngrok)

---

**Vraag aan Claude Code:** zet dit project stap voor stap op, begin met de bestandsstructuur en manifest/service worker basis, bouw dan de "Ik parkeer hier"-flow, daarna de timer + notificaties, en tot slot de terugnavigatie-knop. Test elke stap voor je verder gaat.
