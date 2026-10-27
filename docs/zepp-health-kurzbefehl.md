# Zepp → Dashboard per Kurzbefehl

Weg der Daten: **Zepp-App → Apple Health → Kurzbefehl (jeden Morgen) → `/api/health` → Dashboard**.

Der Endpoint trägt Schlaf (gesamt, Tief, REM), Schritte, Ruhepuls und HRV ins Gesundheits-Protokoll ein.
Leere Werte oder 0 überschreiben nichts. Blutdruck und Temperatur trägst du weiter von Hand ein.
Ab 12.000 Schritten wird das Schritte-Habit automatisch abgehakt, genau wie bei der Handeingabe.

## 1. Zepp → Apple Health

1. Zepp-App → **Profil → Konten hinzufügen** (je nach Version: „Drittanbieter-Apps“) → **Apple Health** → alles erlauben.
2. Prüfen, was ankommt: Health-App → Profilbild → **Apps → Zepp**. Dort steht, welche Datentypen Zepp schreibt.
   Fehlt etwas (z. B. HRV oder die Schlafphasen), schickt der Kurzbefehl dafür einfach nichts mit.

## 2. Geheimen Schlüssel in Cloudflare anlegen

1. Einen langen Zufallsschlüssel erzeugen, z. B. im Terminal: `openssl rand -hex 24`
2. Cloudflare-Dashboard → **Workers & Pages** → Dashboard-Projekt → **Einstellungen → Variablen und Geheimnisse**
   → Hinzufügen: Typ **Geheimnis**, Name `HEALTH_KEY`, Wert = der Schlüssel.
3. Neu bereitstellen (nächster Push oder „Bereitstellung wiederholen“), sonst kennt die Funktion den Schlüssel noch nicht.

Ohne `HEALTH_KEY` lehnt der Endpoint jede Anfrage ab.

## 3. Kurzbefehl „Zepp → Dashboard“ bauen

In der Kurzbefehle-App einen neuen Kurzbefehl anlegen. `ADRESSE` ist die Adresse, unter der dein Dashboard
mit „Synchronisiert“ läuft (die Cloudflare-Pages-Adresse, nicht github.io).

**Datum**
1. *Aktuelles Datum* → *Datum formatieren*: Benutzerdefiniert `yyyy-MM-dd` → *Variable festlegen* `Heute`
2. *Datum anpassen*: aktuelles Datum, **1 Tag abziehen** → *Datum formatieren* `yyyy-MM-dd` → *Variable festlegen* `Gestern`

**Schlaf der letzten Nacht** (zählt zum heutigen Datum, wie bei der Handeingabe)
3. *Health-Beispiele suchen*: Typ **Schlafanalyse**, Bedingungen (alle): *Enddatum ist heute*, *Quelle ist Zepp*,
   *Wert ist nicht Wach*, *Wert ist nicht Im Bett*
4. *Wiederholen mit jedem* Objekt: *Zeit zwischen Datumsangaben abrufen* (Startdatum → Enddatum des Objekts) **in Minuten**
5. Nach dem Wiederholen: *Statistik berechnen*: **Summe** → *Variable festlegen* `Schlaf`
6. Schritte 3–5 wiederholen mit zusätzlicher Bedingung *Wert ist Tief* → `Tief`, und *Wert ist REM* → `REM`

**Ruhepuls & HRV** (optional)
7. *Health-Beispiele suchen*: Typ **Ruhepuls**, *Startdatum ist heute*, *Quelle ist Zepp*, sortiert nach neuestem, Limit 1 → `Ruhepuls`
8. Dasselbe mit Typ **Herzfrequenzvariabilität** → `HRV`

**Schritte von gestern** (der Tag ist erst jetzt vollständig)
9. *Health-Beispiele suchen*: Typ **Schritte**, *Startdatum ist gestern*, *Quelle ist Zepp* → *Statistik berechnen*: **Summe** → `Schritte`

Die Quelle „Zepp“ ist wichtig: Sonst zählt das iPhone seine eigenen Schritte doppelt dazu.

**Senden** – zweimal *Inhalte von URL abrufen*:

| | Anfrage 1 (heute) | Anfrage 2 (gestern) |
|---|---|---|
| URL | `https://ADRESSE/api/health` | `https://ADRESSE/api/health` |
| Methode | POST | POST |
| Header | `X-Health-Key` = dein Schlüssel | `X-Health-Key` = dein Schlüssel |
| Hauptteil | JSON | JSON |
| Felder | `date` (Text) = `Heute`<br>`sleepMin` (Zahl) = `Schlaf`<br>`deepMin` (Zahl) = `Tief`<br>`remMin` (Zahl) = `REM`<br>`rhr` (Zahl) = `Ruhepuls`<br>`hrv` (Zahl) = `HRV` | `date` (Text) = `Gestern`<br>`steps` (Zahl) = `Schritte` |

Die Antwort zeigt, was gespeichert wurde, z. B. `{"saved":[{"date":"2026-10-27","sleepMin":452,...}]}`.
`Keine gültigen Werte` heißt: Zepp hatte für den Tag nichts in Health (Uhr nicht getragen oder noch nicht synchronisiert).

## 4. Automatisch jeden Morgen

Kurzbefehle → **Automation → Neue Automation → Tageszeit**, z. B. 10:00, täglich, **Sofort ausführen**
→ Kurzbefehl „Zepp → Dashboard“.

Vorher sollte die Zepp-App einmal geöffnet gewesen sein, damit die Uhr ihre Nachtdaten übertragen hat.
Wer die Uhr erst später synchronisiert, legt die Automation später. Man kann den Kurzbefehl auch jederzeit
von Hand erneut ausführen, er überschreibt dann einfach mit den aktuellen Werten.

## Testen ohne iPhone

```bash
curl -X POST https://ADRESSE/api/health -H "X-Health-Key: DEIN_SCHLUESSEL" -H "Content-Type: application/json" -d '{"date":"2026-10-27","steps":8000}'
```

Danach das Dashboard neu laden: Unter Gesundheit → Protokoll steht der Wert.
