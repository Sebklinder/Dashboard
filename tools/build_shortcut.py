# Baut den Kurzbefehl "Zepp Dashboard" als unsigniertes Plist.
# Aufruf: python3 -I build_shortcut.py <schluesseldatei> <ausgabe.plist>
import plistlib, sys, uuid

key = open(sys.argv[1]).read().strip()
U = lambda: str(uuid.uuid4()).upper()
OBJ = '￼'
ISO = "yyyy-MM-dd'T'HH:mm:ssZZZZZ"

def tokens(string, attachments):
    return {'WFSerializationType': 'WFTextTokenString',
            'Value': {'string': string, 'attachmentsByRange': attachments}}

def output(uuid_, name):
    return {'Type': 'ActionOutput', 'OutputUUID': uuid_, 'OutputName': name}

def item(prop, date=False):
    agg = [{'Type': 'WFCoercionVariableAggrandizement', 'CoercionItemClass': 'WFHKSampleContentItem'},
           {'Type': 'WFPropertyVariableAggrandizement', 'PropertyName': prop}]
    if date:
        agg.append({'Type': 'WFDateFormatVariableAggrandizement', 'WFDateFormatStyle': 'Custom',
                    'WFDateFormat': ISO, 'WFISO8601IncludeTime': True})
    return {'Type': 'Variable', 'VariableName': 'Repeat Item', 'Aggrandizements': agg}

def find(type_label, date_row):
    u = U()
    rows = [{'Bounded': True, 'Operator': 4, 'Property': 'Type', 'Removable': False,
             'Values': {'Enumeration': {'WFSerializationType': 'WFStringSubstitutableState', 'Value': type_label}}},
            dict({'Bounded': True, 'Property': 'Start Date', 'Removable': False}, **date_row)]
    return u, {'WFWorkflowActionIdentifier': 'is.workflow.actions.filter.health.quantity',
               'WFWorkflowActionParameters': {'UUID': u, 'WFContentItemFilter': {
                   'WFSerializationType': 'WFContentPredicateTableTemplate',
                   'Value': {'WFActionParameterFilterPrefix': 1, 'WFContentPredicateBoundedDate': False,
                             'WFActionParameterFilterTemplates': rows}}}}

def lines(kind, find_uuid):
    """Je Sample eine Zeile 'art;wert;quelle;start;ende', danach mit Zeilenumbrüchen verbunden."""
    group, text_u, end_u, combine_u = U(), U(), U(), U()
    prefix = kind + ';'
    p = len(prefix)
    att = {f'{{{p}, 1}}': item('Value'), f'{{{p + 2}, 1}}': item('Source'),
           f'{{{p + 4}, 1}}': item('Start Date', True), f'{{{p + 6}, 1}}': item('End Date', True)}
    actions = [
        {'WFWorkflowActionIdentifier': 'is.workflow.actions.repeat.each',
         'WFWorkflowActionParameters': {'GroupingIdentifier': group, 'WFControlFlowMode': 0,
                                        'WFInput': {'WFSerializationType': 'WFTextTokenAttachment',
                                                    'Value': output(find_uuid, 'Health Samples')}}},
        {'WFWorkflowActionIdentifier': 'is.workflow.actions.gettext',
         'WFWorkflowActionParameters': {'UUID': text_u,
                                        'WFTextActionText': tokens(prefix + ';'.join([OBJ] * 4), att)}},
        {'WFWorkflowActionIdentifier': 'is.workflow.actions.repeat.each',
         'WFWorkflowActionParameters': {'GroupingIdentifier': group, 'WFControlFlowMode': 2, 'UUID': end_u}},
        {'WFWorkflowActionIdentifier': 'is.workflow.actions.text.combine',
         'WFWorkflowActionParameters': {'UUID': combine_u, 'WFTextSeparator': 'New Lines',
                                        'text': {'WFSerializationType': 'WFTextTokenAttachment',
                                                 'Value': output(end_u, 'Repeat Results')}}},
    ]
    return combine_u, actions

def field(k, v):
    return {'WFItemType': 0, 'WFKey': tokens(k, {}), 'WFValue': v}

sleep_find_u, sleep_find = find('Sleep', {'Operator': 1001, 'Values': {'Number': '2', 'Unit': 16}})  # Start in den letzten 2 Tagen
steps_find_u, steps_find = find('Steps', {'Operator': 1002, 'Values': {'Number': '7', 'Unit': 16}})  # Start ist heute
rhr_find_u, rhr_find = find('Resting Heart Rate', {'Operator': 1001, 'Values': {'Number': '2', 'Unit': 16}})
hrv_find_u, hrv_find = find('Heart Rate Variability', {'Operator': 1001, 'Values': {'Number': '2', 'Unit': 16}})
sleep_text_u, sleep_lines = lines('sleep', sleep_find_u)
steps_text_u, steps_lines = lines('steps', steps_find_u)
rhr_text_u, rhr_lines = lines('rhr', rhr_find_u)
hrv_text_u, hrv_lines = lines('hrv', hrv_find_u)
texts = [sleep_text_u, steps_text_u, rhr_text_u, hrv_text_u]
url_u = U()

actions = [sleep_find, *sleep_lines, steps_find, *steps_lines, rhr_find, *rhr_lines, hrv_find, *hrv_lines,
    {'WFWorkflowActionIdentifier': 'is.workflow.actions.downloadurl',
     'WFWorkflowActionParameters': {
         'UUID': url_u, 'ShowHeaders': True, 'WFHTTPMethod': 'POST', 'WFHTTPBodyType': 'JSON',
         'WFURL': 'https://dashboard-5sc.pages.dev/api/health',
         'WFHTTPHeaders': {'WFSerializationType': 'WFDictionaryFieldValue', 'Value': {'WFDictionaryFieldValueItems': [
             field('X-Health-Key', tokens(key, {}))]}},
         'WFJSONValues': {'WFSerializationType': 'WFDictionaryFieldValue', 'Value': {'WFDictionaryFieldValueItems': [
             field('samples', tokens('\n'.join([OBJ] * len(texts)),
                                     {f'{{{2 * i}, 1}}': output(u, 'Combined Text') for i, u in enumerate(texts)}))]}}}},
    {'WFWorkflowActionIdentifier': 'is.workflow.actions.notification',
     'WFWorkflowActionParameters': {'UUID': U(), 'WFNotificationActionTitle': 'Zepp → Dashboard',
                                    'WFNotificationActionSound': False,
                                    'WFNotificationActionBody': tokens(OBJ, {'{0, 1}': output(url_u, 'Contents of URL')})}},
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

# Selbstcheck: jede Platzhalter-Position zeigt wirklich auf ein ￼
for a in actions:
    def walk(o):
        if isinstance(o, dict):
            if o.get('WFSerializationType') == 'WFTextTokenString':
                s = o['Value']['string']
                for r in o['Value']['attachmentsByRange']:
                    assert s[int(r.strip('{}').split(',')[0])] == OBJ, (s, r)
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(a)

with open(sys.argv[2], 'wb') as f:
    plistlib.dump(shortcut, f, fmt=plistlib.FMT_XML)
print('ok', len(actions), 'Aktionen')
