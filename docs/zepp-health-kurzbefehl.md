# Zepp → Dashboard

Jeden Tag schickt das iPhone Schlaf (letzte Nacht, mit Tief- und REM-Schlaf) und die Schritte von heute
aus Apple Health an das Dashboard. Der Kurzbefehl **„Zepp Dashboard“** ist fertig gebaut und liegt
schon in deiner Kurzbefehle-Mediathek (per iCloud auch auf dem iPhone).

## Einmal einrichten (5 Minuten, am iPhone)

1. **Zepp mit Health verbinden:** Zepp-App → **Profil** → **Konten hinzufügen** → **Apple Health** → alles erlauben.
2. **Kurzbefehl einmal von Hand starten:** Kurzbefehle-App → **Zepp Dashboard** antippen.
   Beim ersten Mal fragt das iPhone, ob der Kurzbefehl Health-Daten lesen und Daten an
   `dashboard-5sc.pages.dev` senden darf → **Immer erlauben**.
   Danach erscheint eine Mitteilung wie `{"saved":[…]}` – dann hat alles geklappt.
3. **Automatisch laufen lassen:** Kurzbefehle-App → **Automation** → **+** → **App** → **Zepp** →
   **Ist geschlossen** → **Sofort ausführen** → Kurzbefehl **Zepp Dashboard** auswählen.
   So läuft er jedes Mal, wenn du die Zepp-App schließt – also direkt nachdem die Uhr synchronisiert hat.
   (Eine feste Uhrzeit geht auch, aber bei gesperrtem iPhone kann iOS die Health-Daten nicht lesen.)

## Meldungen

| Mitteilung | Bedeutung |
|---|---|
| `{"saved":[…]}` | Werte sind im Dashboard (Gesundheit → Protokoll) |
| `Keine gültigen Werte` | Health hat noch nichts von Zepp – Zepp-App öffnen und synchronisieren lassen |
| `Nicht autorisiert` | Schlüssel stimmt nicht – Claude den Kurzbefehl neu bauen lassen |

Der leere Kurzbefehl „Zepp->Dashboard“ wird nicht gebraucht und kann gelöscht werden.

## Technik

- Der Kurzbefehl schickt rohe Health-Samples (`art;wert;quelle;start;ende` je Zeile) als `samples`.
  `functions/api/health.js` rechnet daraus die letzte Nacht und die Schritte von heute. Pro Wert zählt
  die Quelle mit den meisten Daten, damit iPhone und Uhr nicht doppelt zählen.
- Neu bauen: `python3 -I tools/build_shortcut.py Dashboard/.claude/health-key.txt "Zepp Dashboard.plist"`,
  dann `plutil -convert binary1` nach `….shortcut` und `shortcuts sign --mode anyone`.
- Secret `HEALTH_KEY` im Cloudflare-Projekt `dashboard`; der Wert liegt in `Dashboard/.claude/health-key.txt`
  und steckt auch im Kurzbefehl – den Kurzbefehl deshalb nicht teilen.
- Einzelne Tage nachtragen: `curl -X POST https://dashboard-5sc.pages.dev/api/health -H "X-Health-Key: SCHLUESSEL" -H "Content-Type: application/json" -d '{"date":"2026-10-27","steps":8000}'`
