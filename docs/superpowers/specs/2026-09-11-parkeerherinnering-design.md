# Parkeerherinnering — Design Note (aanvulling op buildspec)

Dit document vult de technische keuzes aan die niet in
`parkeerherinnering-buildspec.md` staan vastgelegd. De buildspec blijft de
bron van waarheid voor scope, features en acceptatiecriteria; dit document
beschrijft alleen de implementatiekeuzes.

## Opslag: IndexedDB

De buildspec staat localStorage of IndexedDB toe. Keuze: **IndexedDB**,
omdat foto's (base64/blob) de ~5–10MB localStorage-quota kunnen overschrijden.

Eén database `parkeerherinnering`, één object store `sessions`, key path `id`.

### Datamodel per sessie
```js
{
  id: string,              // uuid
  lat: number,
  lng: number,
  timestamp: number,       // ms epoch, moment van parkeren
  note: string,             // optioneel
  photoBlob: Blob | null,   // optioneel
  expiryTimestamp: number | null, // null = "geen limiet"
  presetType: "blue-zone" | "paid" | "none",
  active: boolean,          // true = huidige sessie, false = geschiedenis
  notified10min: boolean,   // voorkomt dubbele notificaties
  notifiedExpiry: boolean
}
```
Geschiedenis = laatste 5 sessies met `active: false`, gesorteerd op timestamp
aflopend; oudste wordt verwijderd bij overschrijding.

## Notificatie-implementatie

1. Bij het starten van een sessie met een `expiryTimestamp`, plant `app.js`
   twee `setTimeout`s (10 min vóór, en op het exacte moment) die
   `registration.showNotification(...)` aanroepen via de actieve Service
   Worker registration. Dit werkt alleen zolang het tabblad/de app open is
   of op de achtergrond actief blijft (afhankelijk van OS/browser).
2. **Fallback bij heropenen:** bij elke `DOMContentLoaded` en
   `visibilitychange` (naar zichtbaar) herberekent `app.js` de resterende
   tijd van de actieve sessie. Is de sessie al verlopen of binnen 10 minuten
   van verlopen, en is de bijbehorende notificatie nog niet getoond
   (`notified10min`/`notifiedExpiry` vlag), toon dan meteen een in-app
   banner en (indien toestemming) een notificatie, en zet de vlag.
3. UI vermeldt expliciet dat achtergrondnotificaties op iOS Safari beperkt
   betrouwbaar zijn.

## Iconen

Eenvoudig plat icoon: een "P" in een pin/marker-vorm, gegenereerd als SVG en
gerasterd naar `icon-192.png` en `icon-512.png` via een eenmalig scriptje
(geen externe asset-tools nodig).

## Geen build-stap

Vanilla HTML/CSS/JS zoals de buildspec vereist. Testen via
`python -m http.server` of `npx serve .`. Geen framework, geen bundler, geen
automated test framework — handmatige verificatie per stap volgens de
acceptatiecriteria in de buildspec.
