# Alkohol-Rückkopplung im Wochenrückblick – Design

Stand: 2026-10-09 · betrifft nur `index.html`

## Ziel

Alkohol wird wie bisher über die Ernährung eingetragen. Das Dashboard erkennt daraus die Gramm Alkohol pro Tag, verknüpft sie mit den Gesundheitswerten des folgenden Morgens und zeigt im Wochenrückblick, wie sich Alkohol auf Schlaf, Ruhepuls und HRV ausgewirkt hat.

Erfolgreich ist das Feature, wenn der Wochenrückblick nach einer Woche mit Trinktagen eine Zeile wie diese zeigt:
„Nach 2 Trinktagen: HRV −18 %, Ruhepuls +6, Tiefschlaf −25 min gegenüber alkoholfreien Nächten“.

## Nicht im Umfang

- keine eigene Alkohol-Kachel und keine separate Alkohol-Erfassung
- kein Hinweis am Morgen danach auf der Übersicht, keine eigene Alkohol-Analytics-Seite
- kein subjektives Morgen-Befinden
- die Auswertung erscheint nur im Wochenrückblick, nicht in der Gesundheitstabelle

## 1. Ruhepuls und HRV unter Gesundheit

Neue Messwerte im Datensatz `health` (ein Eintrag pro Tag, Datum = Morgen der Messung):

| Feld | Bedeutung | Einheit | Eingabe |
|---|---|---|---|
| `rhr` | Ruhepuls | Schläge/min | ganze Zahl, 30–120 |
| `hrv` | Herzratenvariabilität | ms | ganze Zahl, 5–250 |

Anpassungen:
- **Erfassen:** neue Kachel „Puls & HRV“ unter Gesundheit → Erfassen mit eigenem Dialog (Datum, Ruhepuls, HRV). Gespeichert wird über `saveHealthEntry(date, { rhr, hrv })`, leere Felder werden nicht geschrieben.
- **Protokoll-Tabelle:** zwei neue Spalten „Ruhepuls“ und „HRV“ nach „Blutdruck“. Ein einzelner Wert lässt sich wie die anderen per Klick löschen.
- **`HEALTH_FIELDS`:** Einträge `rhr` (Ruhepuls) und `hrv` (HRV).
- **Bearbeiten-Dialog** (`openHealthEdit` / `saveHealthEdit`): beide Felder ergänzen.
- **CSV-Export** (`exportHealth`): zwei Spalten ergänzen.
- **Analytics (Gesundheit):** neues Diagramm „Ruhepuls & HRV“ im Stil des Blutdruckverlaufs, mit zwei Linien.

## 2. Alkohol in der Ernährung erkennen

### Datenfeld

Neues optionales Feld `alk` = Alkoholgehalt in **% vol**:
- in eigenen Lebensmitteln (`ern_foods[].alk`)
- in der Nährwertbasis eines Treffers bzw. Eintrags (`base.alk`), damit es nach dem Eintragen am Eintrag in `ern_log` erhalten bleibt

### Quellen

- **Suche (`searchOFF`) und Barcode:** `alk` aus `nutriments.alcohol_100g` (Open Food Facts speichert dort % vol). Fehlt der Wert oder ist er 0, wird `alk` nicht gesetzt.
- **Eigene Lebensmittel:** neues optionales Eingabefeld „Alkohol % vol“ im Dialog (`saveOwnFood`, Laden beim Bearbeiten, `ownFoodBase`).

### Gramm Alkohol eines Eintrags

```
gramm = menge × alk / 100 × 0,789
```

`menge` ist die eingetragene Menge in ml **oder g**. Open Food Facts führt Getränke je 100 g, deshalb wird bei Getränken 1 g = 1 ml angenommen.

### Rückfall für Einträge ohne `alk`

Ältere Einträge und noch nicht ergänzte eigene Lebensmittel werden am Namen erkannt, damit die Vergangenheit als Vergleich dient:

| Stichwort (Wortanfang, ohne Groß-/Kleinschreibung) | % vol |
|---|---|
| Bier, Pils, Weizen, Helles, Radler (2,5), Kölsch, Export | 5 |
| Wein, Rotwein, Weißwein, Rosé, Riesling, Grauburgunder | 12 |
| Sekt, Prosecco, Champagner, Crémant | 11 |
| Aperol, Spritz | 8 |
| Schnaps, Wodka, Gin, Rum, Whisky, Korn, Likör (20), Obstler | 38 |

Der Rückfall gilt **nur für Einträge mit Einheit ml** und Menge. Speisen in Gramm wie „Bierschinken“ oder „Weizenbrot“ zählen also nie. Zusätzlich werden Namen mit „alkoholfrei“, „0,0“, „0.0“, „ohne Alkohol“ oder „essig“ ausgeschlossen, damit zum Beispiel „Weißweinessig“ nicht zählt. Ältere Open-Food-Facts-Einträge in Gramm ohne `alk` bleiben unberücksichtigt. Das ist akzeptiert, weil neue Einträge den Wert mitbringen.

### Tageswert

`ernAlcoholDay(day)` → `{ g, drinks }` mit Summe der Gramm aller Einträge des Tages und `drinks = g / 10` (Standardglas ≈ 10 g). Ein Tag ab 1 g zählt als Trinktag.

## 3. Verknüpfung mit den Gesundheitswerten

- Alkohol am Tag **D** wird den Morgenwerten vom Tag **D+1** zugeordnet (Schlaf, Tiefschlaf, REM, Ruhepuls, HRV). Das passt zur bestehenden Erfassung, bei der Schlaf mit dem Datum des Aufwachens gespeichert wird.
- **Trinknacht:** Nacht nach einem Trinktag. **Alkoholfreie Nacht:** Nacht nach einem Tag mit Ernährungseinträgen und 0 g Alkohol. Tage ganz ohne Ernährungseinträge zählen nicht als alkoholfrei, weil unbekannt ist, ob getrunken wurde.
- **Vergleichsbasis:** Mittelwert jedes Morgenwerts über alle alkoholfreien Nächte der **8 Wochen vor dem Ende der betrachteten Woche**.
- **Effekt:** Mittelwert der Trinknächte der Woche minus Basis. Ruhepuls und Schlaf werden absolut angegeben (Schläge, min), HRV relativ in %.
- **Mindestdaten:** Ein Effekt wird nur für Werte gezeigt, die mindestens 1 Trinknacht und 5 alkoholfreie Nächte haben. Sonst erscheint „noch zu wenig Vergleichsdaten“.

Umgesetzt als reine Funktion `alcoholEffect(from, to)` → `{ nights, effects: { hrv, rhr, deep, sleep, rem }, baseN }`.

## 4. Wochenrückblick

In `weekStats` kommen `alcG`, `alcDays`, `rhr`, `hrv` sowie die Anzahl der Messungen dazu. In `renderWeekReview` gibt es drei Ergänzungen:

1. **Zeile „Alkohol“**
   - aktuell: „3 Trinktage · ≈ 6 Gläser“, darunter „62 g Alkohol“
   - Vorwoche und Veränderung in Gläsern, weniger ist besser
   - Bewertung: „Alkoholfrei“ (gut) bei 0 g, „Moderat“ (Warnung) bei höchstens 2 Trinktagen und unter 50 g, sonst „Viel“ (schlecht)
   - Steht in der Woche gar kein Ernährungseintrag, bleibt die Zeile leer (—) ohne Bewertung.
2. **Zeile „Ruhepuls / HRV“:** Wochenschnitt „58 / 42 ms“ gegenüber der Vorwoche. Beim Ruhepuls ist weniger besser, bei der HRV mehr. Diese Zeile hat keine Bewertung.
3. **Zeile „Alkohol-Effekt“** in der Zusammenfassung über der Tabelle, neben „Lief gut“ und „Im Blick behalten“, nur wenn es Trinknächte gab:
   „Nach 2 Trinktagen: HRV −18 %, Ruhepuls +6, Tiefschlaf −25 min gegenüber alkoholfreien Nächten“
   Es werden nur Werte mit genügend Daten genannt, in dieser Reihenfolge: HRV, Ruhepuls, Tiefschlaf, Schlaf gesamt. Gibt es keinen davon, steht „noch zu wenig Vergleichsdaten“.

Die Alkohol-Zeile zählt mit ihrer Bewertung zu „Lief gut“ bzw. „Im Blick behalten“, wie die übrigen Zeilen. Daten zu Alkohol, Ruhepuls oder HRV zählen bei der Prüfung `hasData` mit.

## Fehlerfälle und Randbedingungen

- Nicht-numerische oder leere Werte für `alk`, `rhr` und `hrv` werden ignoriert.
- Einträge ohne Menge liefern 0 g Alkohol.
- Bestehende Daten müssen nicht migriert werden. Die neuen Felder sind optional, der Cloud-Sync überträgt sie unverändert mit.

## Prüfung

Es gibt kein Test-Setup, weil alles in einer HTML-Datei liegt. Geprüft wird in der Browser-Vorschau, ohne `DB.set`, damit nichts in den Cloud-Sync gelangt. Stattdessen wird `DB.get` mit Testdaten überlagert:
- Gramm-Berechnung: OFF-Bier 500 g mit 5 % ergibt ≈ 19,7 g, Rückfall „Rotwein“ 200 ml ergibt ≈ 18,9 g. „Bierschinken“ 100 g, „Weizenbrot“ 80 g, „Weizenbier alkoholfrei“ 500 ml und „Weißweinessig“ 10 ml ergeben 0 g.
- Effekt: 6 alkoholfreie Nächte mit HRV 50 und eine Trinknacht mit HRV 40 ergeben „HRV −20 %“. Bei nur 4 alkoholfreien Nächten erscheint der Hinweis auf zu wenig Daten.
- Optik: Wochenrückblick, neue Kachel, Dialog, Tabelle und Diagramm per Screenshot, auch in schmaler Ansicht.
