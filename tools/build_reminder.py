# Baut den Kurzbefehl "Vital eintragen": nur eine Mitteilung, welche Werte noch von Hand fehlen.
# Aufruf: python3 -I build_reminder.py <ausgabe.plist>
import plistlib, sys, uuid

BODY = 'Noch eintragen: Blutdruck, Temperatur, Meditation – und Krankheit & Medikamente, falls nötig.'

shortcut = {
    'WFWorkflowActions': [
        {'WFWorkflowActionIdentifier': 'is.workflow.actions.notification',
         'WFWorkflowActionParameters': {'UUID': str(uuid.uuid4()).upper(), 'WFNotificationActionTitle': 'Vitalwerte',
                                        'WFNotificationActionBody': BODY}}],
    'WFWorkflowClientVersion': '2607.0.2', 'WFWorkflowMinimumClientVersion': 900,
    'WFWorkflowMinimumClientVersionString': '900',
    'WFWorkflowIcon': {'WFWorkflowIconGlyphNumber': 59446, 'WFWorkflowIconStartColor': 4282601983},
    'WFWorkflowImportQuestions': [], 'WFWorkflowTypes': [], 'WFQuickActionSurfaces': [],
    'WFWorkflowInputContentItemClasses': [], 'WFWorkflowOutputContentItemClasses': [],
    'WFWorkflowHasShortcutInputVariables': False, 'WFWorkflowHasOutputFallback': False,
}

with open(sys.argv[1], 'wb') as f:
    plistlib.dump(shortcut, f, fmt=plistlib.FMT_XML)
