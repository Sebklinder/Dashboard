// Regeln, die Dashboard (index.html) und Cloud-Funktionen (functions/api/health.js) gleich rechnen müssen.
// Bewusst ohne import/export: im Browser als <script>, in den Functions per `import '../../rules.js'`.
globalThis.RULES = {
  STEPS_GOAL: 12000,                         // ab hier wird das Schritte-Habit abgehakt
  VOCAB_GOAL: 20,                            // Sprachtrainer: Antworten je Tag
  MED_GOAL: 20,                              // Medizintrainer: Antworten je Tag
  TRAINING_GOALS: { kraft: 120, cardio: 120 }, // Minuten je Woche
  // Dauer-Eingaben in Dezimalminuten – "mm:ss" oder reine Minutenzahl (Alt-Einträge); leer/ungültig = null
  parseDur(v) {
    if (v === undefined || v === null || v === '') return null;
    v = String(v).trim();
    if (v.includes(':')) {
      const [m, s] = v.split(':');
      return (parseInt(m) || 0) + (parseInt(s) || 0) / 60;
    }
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  },
};
