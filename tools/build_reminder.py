# Baut den Kurzbefehl "Heute offen": fragt /api/health, was heute noch fehlt (Vitalwerte, Vokabeln, Ernährung, Sport), und zeigt es als Mitteilung.
# Aufruf: python3 -I build_reminder.py <schluesseldatei> <ausgabe.plist>
import plistlib, sys, uuid

key = open(sys.argv[1]).read().strip()
U = lambda: str(uuid.uuid4()).upper()
OBJ = '￼'
url_u = U()
result = {'Type': 'ActionOutput', 'OutputUUID': url_u, 'OutputName': 'Contents of URL'}
text = lambda s, att={}: {'WFSerializationType': 'WFTextTokenString', 'Value': {'string': s, 'attachmentsByRange': att}}

actions = [
    {'WFWorkflowActionIdentifier': 'is.workflow.actions.downloadurl',
     'WFWorkflowActionParameters': {
         'UUID': url_u, 'ShowHeaders': True, 'WFHTTPMethod': 'GET',
         'WFURL': 'https://dashboard-5sc.pages.dev/api/health',
         'WFHTTPHeaders': {'WFSerializationType': 'WFDictionaryFieldValue', 'Value': {'WFDictionaryFieldValueItems': [
             {'WFItemType': 0, 'WFKey': text('X-Health-Key'), 'WFValue': text(key)}]}}}},
    # shortcut: ohne "Wenn" – der importierte Wenn-Block blieb auf iOS leer; meldet daher auch "Alles erledigt ✓"
    {'WFWorkflowActionIdentifier': 'is.workflow.actions.notification',
     'WFWorkflowActionParameters': {'UUID': U(), 'WFNotificationActionTitle': 'Heute noch offen',
                                    'WFNotificationActionBody': text(OBJ, {'{0, 1}': result})}},
]

shortcut = {
    'WFWorkflowActions': actions,
    'WFWorkflowClientVersion': '2607.0.2', 'WFWorkflowMinimumClientVersion': 900,
    'WFWorkflowMinimumClientVersionString': '900',
    'WFWorkflowIcon': {'WFWorkflowIconGlyphNumber': 59446, 'WFWorkflowIconStartColor': 4282601983},
    'WFWorkflowImportQuestions': [], 'WFWorkflowTypes': [], 'WFQuickActionSurfaces': [],
    'WFWorkflowInputContentItemClasses': [], 'WFWorkflowOutputContentItemClasses': [],
    'WFWorkflowHasShortcutInputVariables': False, 'WFWorkflowHasOutputFallback': False,
}

with open(sys.argv[2], 'wb') as f:
    plistlib.dump(shortcut, f, fmt=plistlib.FMT_XML)
print('ok', len(actions), 'Aktionen')
