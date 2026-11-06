import time
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from ..database import now
from ..uncertainty.uncertainty_engine import assess
from ..rag.retrieval import retrieve

AGENTS=['Patient Data','Clinical Analysis','Medical Knowledge','Differential Insight','Explainability','Uncertainty Estimation','Safety and Risk Review','Expert Escalation','Report Generation']
class State(TypedDict,total=False):
    patient:dict
    documents:list
    observations:list
    evidence:list
    contradictions:list
    considerations:list
    explanations:list
    uncertainty:dict
    safety:list
    escalation:bool
    executions:list
    report:dict
def run_node(name,fn):
    def node(s):
        start=now(); t=time.perf_counter(); update=fn(s)
        update['executions']=s.get('executions',[])+[{'agent':name,'status':'completed','started_at':start,'completed_at':now(),'duration_ms':round((time.perf_counter()-t)*1000,2),'output':update.copy()}]
        return update
    return node
def patient_data(s): return {'patient':s['patient'],'observations':[],'contradictions':[]}
def clinical(s):
    p=s['patient']; v=p.get('vitals',{}); obs=[]; contradictions=[]
    for key,low,high,label in [('heart_rate',60,100,'Heart rate'),('systolic',90,140,'Systolic pressure'),('spo2',95,100,'Oxygen saturation'),('temperature',36,38,'Temperature')]:
        val=v.get(key)
        if val is not None and (val<low or val>high): obs.append({'factor':label,'value':val,'finding':f'{label} is outside configured demonstration range ({low}–{high}).','type':'verified input / rule interpretation'})
    text=(p.get('symptoms','')+' '+p.get('notes','')).lower()
    if 'no fever' in text and v.get('temperature',0)>38: contradictions.append('Reported absence of fever conflicts with recorded elevated temperature.')
    if 'no medications' in p.get('notes','').lower() and p.get('medications','').lower() not in ('','none','no medications'): contradictions.append('Notes and medication list disagree.')
    if not obs: obs.append({'factor':'Available observations','value':'review','finding':'No configured vital-sign rule was triggered. This does not exclude illness.','type':'rule interpretation'})
    return {'observations':obs,'contradictions':contradictions}
def knowledge(s): return {'evidence':retrieve(s['patient'].get('symptoms','')+' '+s['patient'].get('notes',''),s.get('documents',[]))}
def differential(s):
    return {'considerations':[{'title':'Reconcile abnormal observations' if len(s['observations'])>1 else 'Complete clinician assessment','support':[o['finding'] for o in s['observations']],'against':s['contradictions'],'limitations':'Pattern-based demonstration. No diagnosis or treatment recommendation is generated.'}]}
def explain(s): return {'explanations':[{'agent':'Clinical Analysis','statement':o['finding'],'basis':f"Recorded input: {o['factor']} = {o['value']}"} for o in s['observations']]+[{'agent':'Medical Knowledge','statement':f"Retrieved {len(s['evidence'])} matching passages. Retrieval similarity does not establish clinical relevance.",'basis':'Local bag-of-words cosine retrieval; source text is shown.'}]}
def uncertainty(s): return {'uncertainty':assess(s['patient'],s['evidence'],s['contradictions'],s['observations'])}
def safety(s):
    p=s['patient']; v=p.get('vitals',{}); flags=[]; text=p.get('symptoms','').lower()
    for check,msg in [(v.get('spo2') is not None and v['spo2']<92,'Low recorded oxygen saturation'),(v.get('systolic') is not None and v['systolic']<90,'Low recorded systolic pressure'),(v.get('heart_rate') is not None and (v['heart_rate']>130 or v['heart_rate']<40),'Markedly abnormal recorded heart rate'),(any(w in text for w in ['chest pain','unconscious','severe breathlessness','stroke','suicidal']),'Configured emergency symptom phrase detected')]:
        if check: flags.append(msg+' — urgent assessment by a qualified professional is required.')
    critical=any(v.get(k) is None for k in ('spo2','systolic'))
    if critical: flags.append('Safety-critical vital signs are missing; clinician review required.')
    return {'safety':flags,'escalation':bool(flags or s['uncertainty']['requires_expert_review'] or s['contradictions'] or not s['evidence'])}
def escalate(s): return {'escalation':True}
def report(s): return {'report':{'generated_at':now(),'status':'pending expert review' if s['escalation'] else 'pending clinician review','disclaimer':'Unverified synthetic research decision support. Not a diagnosis, prescription, or calibrated clinical prediction.'}}
graph=StateGraph(State)
functions=[patient_data,clinical,knowledge,differential,explain,uncertainty,safety,escalate,report]
for name,fn in zip(AGENTS,functions): graph.add_node(name,run_node(name,fn))
graph.add_edge(START,AGENTS[0])
for i in range(6): graph.add_edge(AGENTS[i],AGENTS[i+1])
graph.add_conditional_edges(AGENTS[6],lambda s:'escalate' if s['escalation'] else 'report',{'escalate':AGENTS[7],'report':AGENTS[8]})
graph.add_edge(AGENTS[7],AGENTS[8]); graph.add_edge(AGENTS[8],END)
workflow=graph.compile()
def analyze(patient,documents): return workflow.invoke({'patient':patient,'documents':documents,'executions':[]},{'recursion_limit':20})
