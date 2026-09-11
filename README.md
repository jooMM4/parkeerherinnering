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
