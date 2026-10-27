# Zepp → Dashboard: Kurzbefehl einrichten

**Ziel:** Jeden Morgen schickt dein iPhone automatisch Schlaf und Schritte aus der Zepp-App an dein Dashboard.
Du baust dafür einmal einen Kurzbefehl (ca. 15 Minuten), danach läuft alles von selbst.

Der Server ist fertig eingerichtet. Du brauchst nur dein iPhone und den Schlüssel.

---

## Teil A – Vorbereitung (2 Minuten)

**A1. Zepp mit Apple Health verbinden**
Zepp-App öffnen → unten **Profil** → **Konten hinzufügen** → **Apple Health** → **Alle aktivieren** → **Erlauben**.

**A2. Prüfen, ob die Daten ankommen**
Health-App öffnen → **Entdecken** → **Schlaf**. Steht dort die letzte Nacht? Dann passt es.
(Falls nicht: Zepp-App einmal öffnen, damit die Uhr synchronisiert, und nochmal schauen.)

**A3. Schlüssel aufs iPhone holen**
Der Schlüssel liegt auf dem Mac in `Dashboard/.claude/health-key.txt`. Am einfachsten Claude sagen
„kopier mir den Health-Schlüssel“ – dann liegt er in der Zwischenablage und du kannst ihn am iPhone
einfach einfügen (gleiche Apple-ID, Bluetooth an). Er ist ein Passwort: nicht weitergeben.

---

## Teil B – Kurzbefehl bauen

Kurzbefehle-App → oben rechts **+** → oben auf den Namen tippen → **Zepp → Dashboard** nennen.

Jetzt fügst du nacheinander Aktionen hinzu. Eine Aktion findest du immer über das Suchfeld
**„Aktion suchen“** unten. Variablen (die farbigen Kästchen) setzt du, indem du in ein Feld tippst
und oben über der Tastatur die passende Variable auswählst.

### Block 1: Schlaf der letzten Nacht

| # | Aktion suchen | Was du einstellst |
|---|---|---|
| 1 | **Health-Beispiele suchen** | Bei „Typ“ **Schlafanalyse** wählen. Dann **Filter hinzufügen** und drei Filter setzen: **Enddatum** → *ist heute* · **Quelle** → *ist Zepp* · **Wert** → *ist nicht Im Bett*. Ganz oben muss **„Alle“** der Filter stehen. |
| 2 | **Mit jedem wiederholen** | Wird automatisch mit den Health-Beispielen verbunden. |
| 3 | **Zeit zwischen Daten abrufen** | *Innerhalb* der Wiederholung (eingerückt). Erstes Feld: Variable **Wiederholungsobjekt** antippen → **Startdatum**. Zweites Feld: **Wiederholungsobjekt** → **Enddatum**. Einheit: **Minuten**. |
| 4 | **Statistik berechnen** | *Nach* „Ende der Wiederholung“. **Summe** von **Wiederholungsergebnisse**. |

Falls Zepp auch „Wach“-Phasen meldet, Schritt 1 noch um den Filter **Wert** → *ist nicht Wach* ergänzen.

### Block 2: Schritte von gestern

| # | Aktion suchen | Was du einstellst |
|---|---|---|
| 5 | **Health-Beispiele suchen** | Typ **Schritte**. Filter: **Startdatum** → *ist gestern* · **Quelle** → *ist Zepp*. |
| 6 | **Statistik berechnen** | **Summe** von **Health-Beispiele** (aus Schritt 5). |

Die Quelle „Zepp“ ist wichtig – sonst zählt das iPhone seine eigenen Schritte doppelt.

### Block 3: An das Dashboard senden

| # | Aktion suchen | Was du einstellst |
|---|---|---|
| 7 | **Inhalte von URL abrufen** | URL: `https://dashboard-5sc.pages.dev/api/health` · Auf den Pfeil **>** tippen: **Methode** → *POST* |
| | ↳ **Header** | **+ Neuen Header hinzufügen**: Schlüssel `X-Health-Key`, Text = **dein Schlüssel** (einfügen) |
| | ↳ **Hauptteil anfordern** | **JSON**. Zwei Felder hinzufügen, jeweils Typ **Zahl**: <br>`sleepMin` = Variable **Statistik** aus Schritt 4 <br>`stepsYesterday` = Variable **Statistik** aus Schritt 6 |
| 8 | **Ergebnis anzeigen** | (nur zum Testen – kann später gelöscht werden) |

**Testen:** unten auf ▶ tippen. Erwartet: eine Meldung wie `{"saved":[{"date":"2026-10-28","sleepMin":452}, …]}`.
Dann das Dashboard öffnen → **Gesundheit → Protokoll**: Schlaf und Schritte stehen drin.

| Meldung | Bedeutung |
|---|---|
| `Nicht autorisiert` | Schlüssel falsch oder Header-Name falsch geschrieben (`X-Health-Key`) |
| `Keine gültigen Werte` | Health hat für die Zeit nichts von Zepp – Zepp-App öffnen, synchronisieren lassen, nochmal |

---

## Teil C – Jeden Morgen automatisch

Kurzbefehle-App → unten **Automation** → **+** → **Tageszeit** → z. B. **10:00**, **Täglich**
→ **Sofort ausführen** wählen → Weiter → Kurzbefehl **Zepp → Dashboard** auswählen.

Tipp: Die Uhrzeit so legen, dass du morgens schon einmal die Zepp-App offen hattest.
Läuft er mal zu früh, einfach später von Hand nochmal starten – er überschreibt dann mit den aktuellen Werten.

---

## Später erweitern (optional)

Weitere Felder im JSON von Schritt 7, alle Typ **Zahl**. Die Werte holst du wie in Block 1 bzw. 2:

| Feld | Woher |
|---|---|
| `deepMin` | wie Block 1, aber Filter **Wert** → *ist Tief* |
| `remMin` | wie Block 1, aber Filter **Wert** → *ist REM* |
| `rhr` | **Health-Beispiele suchen**: Typ **Ruhepuls**, Startdatum *ist heute*, Quelle *Zepp*, Limit 1 |
| `hrv` | wie Ruhepuls, Typ **Herzfrequenzvariabilität** |

Ob Zepp Tief-/REM-Schlaf, Ruhepuls und HRV an Health gibt, siehst du in der Health-App unter
Profilbild → **Apps → Zepp**. Fehlt ein Wert, wird er einfach nicht übertragen.

---

## Technik (für später)

- Endpoint: `functions/api/health.js`, Secret `HEALTH_KEY` im Cloudflare-Projekt `dashboard`.
- Ohne `date` im JSON gilt: Schlaf/Puls/HRV → heute, `stepsYesterday` → gestern (Zeitzone Berlin).
  Mit `date` (`YYYY-MM-DD`) oder einer Liste von Einträgen lassen sich auch einzelne Tage nachtragen.
- Test vom Mac: `curl -X POST https://dashboard-5sc.pages.dev/api/health -H "X-Health-Key: SCHLUESSEL" -H "Content-Type: application/json" -d '{"date":"2026-10-27","steps":8000}'`
