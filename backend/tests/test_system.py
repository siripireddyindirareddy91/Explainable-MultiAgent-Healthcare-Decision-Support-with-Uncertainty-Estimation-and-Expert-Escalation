import os, tempfile, uuid
os.environ['DATABASE_URL']='sqlite:///'+os.path.join(tempfile.gettempdir(),'clinixai-test-'+uuid.uuid4().hex+'.db')
os.environ['DEMO_MODE']='true'
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.uncertainty.uncertainty_engine import assess
from backend.app.orchestration.workflow import analyze
from backend.app.rag.retrieval import retrieve
client=TestClient(app)
def auth(role='clinician'):
    r=client.post('/api/auth/login',json={'email':role+'@clinixai.demo','password':'ClinixDemo!2026'})
    assert r.status_code==200,r.text
    return {'Authorization':'Bearer '+r.json()['access_token']}
def test_auth_and_role_boundary():
    assert client.get('/api/patients').status_code in (401,403)
    assert client.post('/api/auth/login',json={'email':'admin@clinixai.demo','password':'wrong'}).status_code==401
    assert client.get('/api/audit-logs',headers=auth()).status_code==403
    assert client.get('/api/audit-logs',headers=auth('expert')).status_code==200
def test_register_cannot_elevate_role():
    r=client.post('/api/auth/register',json={'email':uuid.uuid4().hex+'@example.test','password':'StrongPassword!2026','name':'Test Clinician','role':'admin'})
    assert r.status_code==200
    assert r.json()['user']['role']=='clinician'
def test_uncertainty_direction_and_bounds():
    p={'age':40,'symptoms':'cough','history':'none','allergies':'none','medications':'none','duration':'2 days','vitals':{'spo2':99,'systolic':120,'heart_rate':75,'temperature':37}}
    complete=assess(p,[1,2,3],[],[])
    incomplete=assess({'age':40},[],['conflict'],[])
    assert 0<=complete['uncertainty_score']<incomplete['uncertainty_score']<=100
    assert abs(sum(complete['contributions'].values())-complete['uncertainty_score'])<=.5
    assert complete['calibration_quality']==0
def test_graph_safety_priority_and_missing_evidence():
    a=analyze({'age':40,'symptoms':'chest pain','vitals':{'spo2':89,'systolic':85}},[])
    assert a['escalation'] and a['safety'] and not a['evidence']
    assert a['report']['status']=='pending expert review'
    assert len(a['executions'])==9
def test_contradiction_detection():
    a=analyze({'age':30,'symptoms':'no fever','vitals':{'temperature':39}},[])
    assert a['contradictions']
def test_retrieval_never_invents_sources():
    assert retrieve('cough',[])==[]
    d={'id':'source-1','title':'Test document','chunks':[{'text':'cough fever vital observations','page':2}]}
    result=retrieve('cough fever',[d])
    assert result[0]['document_id']=='source-1' and result[0]['page']==2
def test_end_to_end_review_report_and_audit():
    clinician=auth(); expert=auth('expert')
    p=client.post('/api/patients',headers=clinician,json={'name':'Synthetic Test','age':42,'history':'None','medications':'None','allergies':'None'}).json()
    case=client.post('/api/cases',headers=clinician,json={'patient_id':p['id'],'symptoms':'Chest pain and cough','duration':'2 hours','consent':True,'vitals':{'spo2':90,'systolic':120,'heart_rate':110,'temperature':37}})
    assert case.status_code==200,case.text
    cid=case.json()['id']
    analyzed=client.post(f'/api/cases/{cid}/analyze',headers=clinician)
    assert analyzed.status_code==200,analyzed.text
    a=analyzed.json()['analysis']
    assert a['escalation'] and a['explanations']
    review={'case_id':cid,'decision':'Additional Information Required','notes':'Please verify oxygen reading and obtain a complete clinician history.'}
    assert client.post('/api/reviews',headers=clinician,json=review).status_code==403
    escalation=next(e for e in client.get('/api/escalations',headers=expert).json() if e['case_id']==cid)
    assert client.put('/api/escalations/'+escalation['id']+'/assign',headers=expert,json={'reviewer_id':'demo-expert'}).status_code==200
    assert client.post('/api/reviews',headers=expert,json=review).status_code==200
    review['decision']='Completed'
    assert client.post('/api/reviews',headers=expert,json=review).status_code==200
    assert client.post(f'/api/cases/{cid}/analyze',headers=clinician).status_code==409
    r=client.post('/api/reports/generate',headers=expert,json={'case_id':cid})
    assert r.status_code==200
    pdf=client.get('/api/reports/'+r.json()['id']+'/download',headers=expert)
    assert pdf.status_code==200 and pdf.content.startswith(b'%PDF')
    assert 'application/pdf' in pdf.headers['content-type']
    from pypdf import PdfReader
    import io
    text=' '.join(p.extract_text() for p in PdfReader(io.BytesIO(pdf.content)).pages)
    assert 'Synthetic' in text or 'SYNTHETIC' in text
    assert 'Completed' in text
    logs=client.get('/api/audit-logs',headers=expert).json()
    assert any(l['action']=='Report downloaded' for l in logs)
def test_upload_permissions_and_validation():
    assert client.post('/api/knowledge/upload',headers=auth(),files={'file':('ref.txt',b'cough fever synthetic text','text/plain')}).status_code==403
    r=client.post('/api/knowledge/upload',headers=auth('admin'),files={'file':('reference.txt',b'Synthetic cough fever reference document for testing retrieval.','text/plain')})
    assert r.status_code==200,r.text
    assert r.json()['chunks']
    assert client.post('/api/knowledge/upload',headers=auth('admin'),files={'file':('evil.exe',b'bad')}).status_code==422
def test_input_and_consent_validation():
    h=auth()
    assert client.post('/api/patients',headers=h,json={'name':'Test','age':150}).status_code==422
    p=client.get('/api/patients',headers=h).json()[0]
    assert client.post('/api/cases',headers=h,json={'patient_id':p['id'],'symptoms':'cough','consent':False}).status_code==422
