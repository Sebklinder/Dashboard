# Zepp → Dashboard

Jeden Morgen schickt das iPhone Schlaf (letzte Nacht, mit Tief- und REM-Schlaf), Ruhepuls, HRV und die Schritte von gestern
aus Apple Health an das Dashboard. Der Kurzbefehl **„Zepp Health“** ist fertig gebaut und liegt
schon in deiner Kurzbefehle-Mediathek (per iCloud auch auf dem iPhone).

## Einmal einrichten (5 Minuten, am iPhone)

1. **Zepp mit Health verbinden:** Zepp-App → **Profil** → **Konten hinzufügen** → **Apple Health** → alles erlauben.
2. **Kurzbefehl einmal von Hand starten:** Kurzbefehle-App → **Zepp Health** antippen.
   Beim ersten Mal fragt das iPhone, ob der Kurzbefehl Health-Daten lesen und Daten an
   `dashboard-5sc.pages.dev` senden darf → **Immer erlauben**.
   Danach erscheint eine Mitteilung wie `{"saved":[…]}` – dann hat alles geklappt.
3. **Einmal am Tag, morgens:** Ein Lauf überträgt Schlaf, HRV und Ruhepuls der letzten Nacht
   (beim heutigen Tag) und die Schritte vom ganzen gestrigen Tag (beim gestrigen Tag).
   Automatisch: Kurzbefehle-App → **Automation** → **+** → **App** → **Zepp** → **Ist geschlossen** →
   **Sofort ausführen** → Kurzbefehl **Zepp Health** auswählen. Dann läuft er, sobald du morgens die
   Zepp-App öffnest und wieder schließt – die Uhr hat die Nacht dann schon übertragen.
   Eine feste Uhrzeit (**Tageszeit**) geht auch, aber bei gesperrtem iPhone gibt iOS keine
   Health-Daten heraus („Keine gültigen Werte“).
   Eine alte Automation um **23:50** kannst du löschen. Mehrfach am Tag starten schadet nicht:
   Jeder Lauf überschreibt dieselben Werte nur mit dem neueren Stand.

## Meldungen

| Mitteilung | Bedeutung |
|---|---|
| `{"saved":[…]}` | Werte sind im Dashboard (Gesundheit → Protokoll) |
| `Keine gültigen Werte` | Health hat noch nichts von Zepp – Zepp-App öffnen und synchronisieren lassen |
| `Nicht autorisiert` | Schlüssel stimmt nicht – Claude den Kurzbefehl neu bauen lassen |

Die alten Kurzbefehle „Zepp->Dashboard“, „Zepp Dashboard“ und „Zepp Dashboard 2“ werden nicht gebraucht und können gelöscht werden.

## Erinnerung „Vital eintragen“

Zeigt einmal am Tag die Mitteilung *„Noch eintragen: Blutdruck, Temperatur, Meditation – und Krankheit &
Medikamente, falls nötig.“* Einrichten: Kurzbefehle-App → **Automation** → **+** → **Tageszeit** →
z. B. **20:00**, **Täglich** → **Sofort ausführen** → Kurzbefehl **Vital eintragen**.
Anderen Text: Kurzbefehl am iPhone öffnen und die Mitteilung direkt ändern.

## Technik

- Der Kurzbefehl schickt rohe Health-Samples (`art;wert;quelle;start;ende` je Zeile) als `samples`.
  `functions/api/health.js` rechnet daraus die letzte Nacht und die Schritte von gestern. Pro Wert zählt
  die Quelle mit den meisten Daten, damit iPhone und Uhr nicht doppelt zählen.
- Neu bauen: `python3 -I tools/build_shortcut.py Dashboard/.claude/health-key.txt "Zepp Health.plist"`,
  dann `plutil -convert binary1` nach `….shortcut` und `shortcuts sign --mode anyone`.
- Secret `HEALTH_KEY` im Cloudflare-Projekt `dashboard`; der Wert liegt in `Dashboard/.claude/health-key.txt`
  und steckt auch im Kurzbefehl – den Kurzbefehl deshalb nicht teilen.
- Einzelne Tage nachtragen: `curl -X POST https://dashboard-5sc.pages.dev/api/health -H "X-Health-Key: SCHLUESSEL" -H "Content-Type: application/json" -d '{"date":"2026-10-27","steps":8000}'`
