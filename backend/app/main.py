import os, io, json, time, threading, uuid
from collections import defaultdict, deque
from datetime import datetime
from xml.sax.saxutils import escape
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select
from .database import Session, User, Record, Audit, init_db, serialize, audit, now, uid
from .security import current, reviewer, admin, token, hash_password, verify, public_user, DEMO
from .orchestration.workflow import analyze, AGENTS
from .rag.retrieval import chunks

app=FastAPI(title='CLINIXAI Decision Support',version='1.0.0',docs_url='/api/docs',openapi_url='/api/openapi.json')
app.add_middleware(CORSMiddleware,allow_origins=os.getenv('CORS_ORIGINS','http://localhost:3000').split(','),allow_credentials=True,allow_methods=['GET','POST','PUT','DELETE'],allow_headers=['Authorization','Content-Type'])
requests=defaultdict(deque); lock=threading.Lock()
@app.middleware('http')
async def controls(request:Request,call_next):
    key=(request.client.host if request.client else 'unknown',request.url.path.startswith('/api/auth'))
    with lock:
        window=requests[key]; stamp=time.monotonic()
        while window and window[0]<stamp-60: window.popleft()
        limit=30 if key[1] else 240
        if len(window)>=limit: return JSONResponse({'detail':'Rate limit reached. Try again shortly.'},status_code=429)
        window.append(stamp)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'; response.headers['X-Frame-Options']='DENY'
    response.headers['Cache-Control']='no-store'
    return response

class Login(BaseModel):
    email:str=Field(min_length=3,max_length=254)
    password:str=Field(min_length=1,max_length=128)
class Register(Login):
    name:str=Field(min_length=2,max_length=100)
    password:str=Field(min_length=10,max_length=128)
class Vitals(BaseModel):
    heart_rate:float|None=Field(None,ge=1,le=300)
    systolic:float|None=Field(None,ge=1,le=300)
    spo2:float|None=Field(None,ge=1,le=100)
    temperature:float|None=Field(None,ge=25,le=45)
class Patient(BaseModel):
    name:str=Field(min_length=2,max_length=100)
    age:int=Field(ge=0,le=120)
    sex:str=Field(default='Not specified',max_length=40)
    history:str=Field(default='',max_length=5000)
    medications:str=Field(default='',max_length=5000)
    allergies:str=Field(default='',max_length=5000)
class CaseInput(BaseModel):
    patient_id:str
    symptoms:str=Field(min_length=3,max_length=5000)
    duration:str=Field(default='',max_length=200)
    notes:str=Field(default='',max_length=10000)
    vitals:Vitals=Field(default_factory=Vitals)
    consent:bool
class ReviewInput(BaseModel):
    case_id:str
    decision:str
    notes:str=Field(min_length=10,max_length=10000)
class Assignment(BaseModel):
    reviewer_id:str
class TextInput(BaseModel):
    text:str=Field(min_length=3,max_length=10000)

def add(db,kind,data,user,record_id=None):
    r=Record(id=record_id or uid(),kind=kind,owner=user.id if user else 'demo',data=data); db.add(r); db.commit(); return r
def get(db,id,kind=None):
    r=db.get(Record,id)
    if not r or r.deleted or (kind and r.kind!=kind): raise HTTPException(404,'Record not found')
    return r
def visible(user,r):
    if not DEMO and user.role=='clinician' and r.owner!=user.id: raise HTTPException(403,'Record access denied')
def listing(db,kind,user,search=''):
    rows=db.scalars(select(Record).where(Record.kind==kind,Record.deleted==False).order_by(Record.created_at.desc())).all()
    return [serialize(r) for r in rows if (DEMO or user.role in ('admin','expert') or r.owner==user.id) and search.lower() in json.dumps(r.data).lower()]
def notify(db,user,message,case_id=''): add(db,'notification',{'message':message,'case_id':case_id,'read':False},user)
def execute(db,c,user):
    patient=get(db,c.data['patient_id'],'patient'); visible(user,patient)
    context={**patient.data,**c.data}
    if c.data.get('documents'): context['notes']=context.get('notes','')+'\nAttached unverified patient document text:\n'+'\n'.join(d['text'] for d in c.data['documents'])[:20000]
    state=analyze(context,listing(db,'knowledge',user))
    state.pop('documents',None)
    c.data={**c.data,'status':'Expert review' if state['escalation'] else 'Clinician review','analysis':state,'analyzed_at':now()}; db.commit()
    if state['escalation'] and not any(e['case_id']==c.id for e in listing(db,'escalation',user)):
        add(db,'escalation',{'case_id':c.id,'patient_name':patient.data['name'],'priority':'Urgent' if state['safety'] else 'High','reasons':state['safety']+state['uncertainty']['reasons'],'status':'Pending','assigned_to':None,'score':state['uncertainty']['uncertainty_score']},user)
    for execution in state['executions']: add(db,'execution',{'case_id':c.id,**execution},user)
    for execution in state['executions']: add(db,'checkpoint',{'case_id':c.id,'node':execution['agent'],'completed_at':execution['completed_at']},user)
    audit(db,user,'Analysis completed',c.id); notify(db,user,'Analysis completed'+(' · Expert review required' if state['escalation'] else ''),c.id)
    return serialize(c)

def seed():
    init_db()
    if not DEMO: return
    with Session() as db:
        for role,name in [('admin','Alex Morgan'),('clinician','Dr. Maya Rao'),('expert','Dr. Arjun Shah')]:
            if not db.scalar(select(User).where(User.email==role+'@clinixai.demo')): db.add(User(id='demo-'+role,email=role+'@clinixai.demo',name=name,role=role,password=hash_password('ClinixDemo!2026')))
        db.commit(); user=db.get(User,'demo-clinician')
        stable=lambda key:str(uuid.uuid5(uuid.NAMESPACE_URL,'clinixai-demo-v2:'+key))
        if not db.get(Record,stable('knowledge')):
            add(db,'knowledge',{'title':'Synthetic teaching reference · vital-sign review','source':'CLINIXAI synthetic teaching material, version 1. Not an external medical guideline.','synthetic':True,'chunks':[{'text':'Fever cough fatigue symptoms require clinician history and vital signs review. Elevated temperature and heart rate can have many explanations. This synthetic passage is for demonstrating retrieval only. It is not clinical evidence.','page':1},{'text':'Chest pain breathlessness dizziness and oxygen saturation observations require qualified professional assessment. Missing information and contradictory history require human review. Synthetic demonstration text; not a validated guideline.','page':2}]},user,stable('knowledge'))
        samples=[('Aarav Mehta',46,'Male','Hypertension','Amlodipine','None known','Chest pain and breathlessness','2 hours',{'heart_rate':116,'systolic':156,'spo2':90,'temperature':37.2}),('Sofia Williams',32,'Female','None reported','None','Penicillin','Fever and cough','3 days',{'heart_rate':104,'systolic':118,'spo2':97,'temperature':38.6}),('Rohan Patel',61,'Male','','Metformin','','Fatigue and dizziness','1 week',{'heart_rate':86,'systolic':126,'spo2':None,'temperature':36.8}),('Emma Wilson',28,'Female','None reported','None','None known','Mild cough','2 days',{'heart_rate':75,'systolic':114,'spo2':99,'temperature':36.7})]
        samples += [
            ('Ananya Sharma',37,'Female','Asthma','Recorded inhaler','Dust','Cough and fatigue','4 days',{'heart_rate':92,'systolic':122,'spo2':96,'temperature':37.3}),
            ('James Anderson',54,'Male','Hypertension','Recorded antihypertensive','None known','Dizziness and fatigue','2 days',{'heart_rate':82,'systolic':148,'spo2':98,'temperature':36.6}),
            ('Priya Nair',26,'Female','None reported','None','None known','Fever and sore throat','2 days',{'heart_rate':95,'systolic':112,'spo2':99,'temperature':38.2}),
            ('Daniel Kim',43,'Male','None reported','None','None known','Mild cough and fatigue','5 days',{'heart_rate':79,'systolic':124,'spo2':98,'temperature':36.9}),
            ('Fatima Khan',68,'Female','Diabetes','Recorded glucose-lowering medication','','Fatigue and dizziness','1 week',{'heart_rate':88,'systolic':138,'spo2':97,'temperature':36.8}),
            ('Oliver Brown',72,'Male','Cardiac history','Recorded medication','None known','Chest pain and dizziness','1 hour',{'heart_rate':134,'systolic':88,'spo2':91,'temperature':37.1}),
            ('Kavya Reddy',31,'Female','None reported','None','None known','Cough and fever','3 days',{'heart_rate':101,'systolic':116,'spo2':97,'temperature':38.4}),
            ('Lucas Martin',48,'Male','None reported','None','None known','Fatigue after poor sleep','1 week',{'heart_rate':74,'systolic':126,'spo2':99,'temperature':36.7}),
            ('Meera Iyer',59,'Female','Hypertension','Recorded medication','None known','Dizziness and cough','2 days',{'heart_rate':84,'systolic':142,'spo2':98,'temperature':37.0}),
            ('Noah Thompson',35,'Male','None reported','None','None known','Cough and fatigue','4 days',{'heart_rate':80,'systolic':119,'spo2':99,'temperature':36.8}),
            ('Aisha Ahmed',41,'Female','','None','','Fever and fatigue','3 days',{'heart_rate':108,'systolic':None,'spo2':None,'temperature':38.7}),
            ('Vikram Desai',64,'Male','Respiratory history','Recorded inhaler','None known','Severe breathlessness and cough','6 hours',{'heart_rate':122,'systolic':105,'spo2':89,'temperature':37.8})]
        for i,(name,age,sex,history,meds,allergies,symptoms,duration,vitals) in enumerate(samples):
            pid,cid=stable('patient:'+name),stable('case:'+name)
            if db.get(Record,cid): continue
            p=db.get(Record,pid) or add(db,'patient',{'name':name,'age':age,'sex':sex,'history':history,'medications':meds,'allergies':allergies,'synthetic':True},user,pid)
            c=add(db,'case',{'patient_id':p.id,'patient_name':name,'symptoms':symptoms,'duration':duration,'notes':'Synthetic teaching scenario. No real patient information.','vitals':vitals,'consent':True,'status':'Draft'},user,cid)
            execute(db,c,user)
            if i in (3,4,6,7,10,11,13):
                decision='Completed' if i%2 else 'Additional Information Required'
                review_data={'case_id':cid,'decision':decision,'notes':'Synthetic example reviewer note: observations inspected; complete history and confirm recorded vital signs before interpretation. No diagnosis or treatment is established.','reviewer_id':'demo-expert','reviewer_name':'Dr. Arjun Shah','reviewed_at':now(),'authorship':'seeded synthetic example','synthetic':True}
                rr=add(db,'review',review_data,user,stable('review:'+name))
                c.data={**c.data,'status':decision,'review':serialize(rr)}; db.commit()
                for e in listing(db,'escalation',user):
                    if e['case_id']==cid:
                        er=get(db,e['id']);er.data={**er.data,'status':decision,'assigned_to':'demo-expert','assigned_name':'Dr. Arjun Shah'};db.commit()
                add(db,'report',{'case_id':cid,'patient_name':name,'status':decision,'snapshot':serialize(c)},user,stable('report:'+name))
seed()

@app.get('/api/health')
def health(): return {'status':'ok','mode':'synthetic-demo' if DEMO else 'configured','storage':'ephemeral-demo' if os.getenv('VERCEL') and not os.getenv('DATABASE_URL') else 'database','version':'1.0.0'}
@app.get('/api/system/status')
def status(user=Depends(current)): return {**health(),'agents':len(AGENTS),'calibration':'unvalidated','durable_storage':bool(os.getenv('DATABASE_URL'))}
@app.post('/api/auth/login')
def login(body:Login):
    with Session() as db:
        u=db.scalar(select(User).where(User.email==body.email.lower()))
        if not u or not verify(body.password,u.password): raise HTTPException(401,'Invalid email or password')
        audit(db,u,'Signed in',u.id); return {'access_token':token(u),'user':public_user(u)}
@app.post('/api/auth/register')
def register(body:Register):
    with Session() as db:
        if db.scalar(select(User).where(User.email==body.email.lower())): raise HTTPException(409,'Email already registered')
        u=User(id=uid(),email=body.email.lower(),name=body.name,password=hash_password(body.password),role='clinician'); db.add(u); db.commit(); audit(db,u,'Account registered',u.id)
        return {'access_token':token(u),'user':public_user(u)}
@app.get('/api/auth/me')
def me(user=Depends(current)): return public_user(user)
@app.post('/api/auth/refresh')
def refresh(user=Depends(current)): return {'access_token':token(user)}
@app.get('/api/patients')
def patients(search:str='',user=Depends(current)):
    with Session() as db: return listing(db,'patient',user,search)
@app.post('/api/patients')
def create_patient(body:Patient,user=Depends(current)):
    with Session() as db:
        r=add(db,'patient',{**body.model_dump(),'synthetic':DEMO},user); audit(db,user,'Patient registered',r.id); return serialize(r)
@app.get('/api/patients/{id}')
def patient(id:str,user=Depends(current)):
    with Session() as db:
        r=get(db,id,'patient'); visible(user,r); return serialize(r)
@app.put('/api/patients/{id}')
def update_patient(id:str,body:Patient,user=Depends(current)):
    with Session() as db:
        r=get(db,id,'patient'); visible(user,r); r.data={**r.data,**body.model_dump()}; db.commit(); audit(db,user,'Patient updated',id); return serialize(r)
@app.delete('/api/patients/{id}')
def delete_patient(id:str,user=Depends(current)):
    with Session() as db:
        r=get(db,id,'patient'); visible(user,r); r.deleted=True; db.commit(); audit(db,user,'Patient archived',id); return {'ok':True}
@app.get('/api/cases')
def cases(search:str='',user=Depends(current)):
    with Session() as db: return listing(db,'case',user,search)
@app.post('/api/cases')
def create_case(body:CaseInput,user=Depends(current)):
    if not body.consent: raise HTTPException(422,'Data-use consent is required')
    with Session() as db:
        p=get(db,body.patient_id,'patient'); visible(user,p)
        r=add(db,'case',{**body.model_dump(),'patient_name':p.data['name'],'status':'Draft'},user); audit(db,user,'Case created',r.id); return serialize(r)
@app.get('/api/cases/{id}')
def case(id:str,user=Depends(current)):
    with Session() as db:
        c=get(db,id,'case'); visible(user,c); return serialize(c)
@app.post('/api/cases/{id}/analyze')
def analyze_case(id:str,user=Depends(current)):
    with Session() as db:
        c=get(db,id,'case'); visible(user,c)
        if c.data.get('status') in ('Completed','Approved','Rejected'): raise HTTPException(409,'Reviewed cases cannot be re-analyzed; create a new case to preserve review history.')
        return execute(db,c,user)
@app.get('/api/cases/{id}/{section}')
def result(id:str,section:str,user=Depends(current)):
    with Session() as db:
        c=get(db,id,'case'); visible(user,c); a=c.data.get('analysis')
        if not a: raise HTTPException(409,'Run analysis first')
        keys={'results':None,'explanations':'explanations','uncertainty':'uncertainty','evidence':'evidence','agents':'executions'}
        if section not in keys: raise HTTPException(404,'Unknown section')
        return a if keys[section] is None else a[keys[section]]
@app.post('/api/cases/{id}/escalate')
def escalate_case(id:str,user=Depends(current)):
    with Session() as db:
        c=get(db,id,'case'); visible(user,c)
        existing=[e for e in listing(db,'escalation',user) if e['case_id']==id]
        if existing: return existing[0]
        r=add(db,'escalation',{'case_id':id,'patient_name':c.data['patient_name'],'priority':'High','reasons':['Explicit clinician request'],'status':'Pending','score':c.data.get('analysis',{}).get('uncertainty',{}).get('uncertainty_score',100),'assigned_to':None},user)
        c.data={**c.data,'status':'Expert review'}; db.commit(); audit(db,user,'Expert review requested',id); return serialize(r)
@app.get('/api/escalations')
def escalations(user=Depends(current)):
    with Session() as db: return listing(db,'escalation',user)
@app.get('/api/escalations/{id}')
def escalation(id:str,user=Depends(current)):
    with Session() as db:
        r=get(db,id,'escalation'); visible(user,r); return serialize(r)
@app.put('/api/escalations/{id}/assign')
def assign(id:str,body:Assignment,user=Depends(current)):
    reviewer(user)
    with Session() as db:
        u=db.get(User,body.reviewer_id)
        if not u or u.role not in ('admin','expert'): raise HTTPException(422,'Choose an authorized expert')
        r=get(db,id,'escalation'); r.data={**r.data,'assigned_to':u.id,'assigned_name':u.name,'status':'Assigned'}; db.commit(); audit(db,user,'Expert assigned',id); notify(db,u,'Case assigned for review',r.data['case_id']); return serialize(r)
@app.get('/api/reviews')
def reviews(user=Depends(current)):
    with Session() as db: return listing(db,'review',user)
@app.post('/api/reviews')
def review(body:ReviewInput,user=Depends(current)):
    reviewer(user)
    if body.decision not in ('Approved','Rejected','Additional Information Required','Completed'): raise HTTPException(422,'Invalid review decision')
    with Session() as db:
        c=get(db,body.case_id,'case')
        if not c.data.get('analysis'): raise HTTPException(409,'Analysis must complete before review')
        pending=[e for e in listing(db,'escalation',user) if e['case_id']==c.id]
        for e in pending:
            if e.get('assigned_to') and e['assigned_to']!=user.id and user.role!='admin': raise HTTPException(403,'This case is assigned to another expert')
        r=add(db,'review',{**body.model_dump(),'reviewer_id':user.id,'reviewer_name':user.name,'reviewed_at':now(),'authorship':'human'},user)
        c.data={**c.data,'status':body.decision,'review':serialize(r)}
        for e in pending:
            er=get(db,e['id']); er.data={**er.data,'status':body.decision}
        db.commit(); audit(db,user,'Expert decision: '+body.decision,c.id); notify(db,user,'Expert review recorded',c.id); return serialize(r)
@app.post('/api/reviews/{id}/comments')
def comment(id:str,body:TextInput,user=Depends(current)):
    reviewer(user)
    with Session() as db:
        get(db,id,'review'); r=add(db,'comment',{'review_id':id,'text':body.text,'author':user.name},user); audit(db,user,'Review comment added',id); return serialize(r)
@app.get('/api/agents')
@app.get('/api/agents/status')
def agents(user=Depends(current)): return [{'name':a,'mode':'deterministic local','enabled':True} for a in AGENTS]
@app.get('/api/users')
def users(user=Depends(current)):
    with Session() as db: return [public_user(u) for u in db.scalars(select(User)) if user.role=='admin' or u.role in ('admin','expert')]
@app.get('/api/knowledge')
def knowledge(user=Depends(current)):
    with Session() as db: return listing(db,'knowledge',user)
async def extract_document(file:UploadFile):
    name=file.filename or ''; extension=name.rsplit('.',1)[-1].lower()
    if extension not in ('pdf','txt','docx'): raise HTTPException(422,'Only PDF, DOCX and TXT are supported')
    content=await file.read(5*1024*1024+1)
    if len(content)>5*1024*1024: raise HTTPException(413,'Maximum upload size is 5 MB')
    try:
        if extension=='pdf':
            from pypdf import PdfReader
            reader=PdfReader(io.BytesIO(content)); extracted=[{'text':c,'page':i+1} for i,p in enumerate(reader.pages[:100]) for c in chunks(p.extract_text() or '')]
        elif extension=='docx':
            from docx import Document
            import zipfile
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(x.file_size for x in archive.infolist())>20*1024*1024: raise ValueError('Expanded document too large')
            extracted=[{'text':c,'page':None} for c in chunks('\n'.join(p.text for p in Document(io.BytesIO(content)).paragraphs))]
        else: extracted=[{'text':c,'page':None} for c in chunks(content.decode('utf-8'))]
        if not extracted: raise ValueError('No extractable text; scanned PDFs require OCR')
        if len(extracted)>2000: raise ValueError('Document too large')
    except Exception as e: raise HTTPException(422,'Unable to extract document text. Check the file format and size.') from e
    return {'title':name[:200],'source':'User-uploaded reference; provenance and clinical validity require reviewer verification.','chunks':extracted,'synthetic':False}
@app.post('/api/knowledge/upload')
async def upload(file:UploadFile=File(...),user=Depends(current)):
    admin(user)
    data=await extract_document(file)
    with Session() as db:
        r=add(db,'knowledge',data,user); audit(db,user,'Knowledge document uploaded',r.id); return serialize(r)
@app.post('/api/cases/{id}/documents')
async def attach_document(id:str,file:UploadFile=File(...),user=Depends(current)):
    with Session() as db:
        c=get(db,id,'case'); visible(user,c)
        if c.data.get('status') in ('Completed','Approved','Rejected'): raise HTTPException(409,'Reviewed cases are immutable; create a follow-up case')
        data=await extract_document(file)
        r=add(db,'clinical_document',{'case_id':id,**data},user)
        c.data={**c.data,'documents':c.data.get('documents',[])+[{'id':r.id,'title':data['title'],'text':'\n'.join(x['text'] for x in data['chunks'])}]}; db.commit()
        audit(db,user,'Clinical document attached',id); return serialize(r)
@app.delete('/api/knowledge/{id}')
def delete_knowledge(id:str,user=Depends(current)):
    admin(user)
    with Session() as db:
        r=get(db,id,'knowledge'); r.deleted=True; db.commit(); audit(db,user,'Knowledge document removed',id); return {'ok':True}
@app.get('/api/notifications')
def notifications(user=Depends(current)):
    with Session() as db: return [n for n in listing(db,'notification',user) if DEMO or db.get(Record,n['id']).owner==user.id]
@app.post('/api/notifications/read')
def read_notifications(user=Depends(current)):
    with Session() as db:
        for n in listing(db,'notification',user):
            r=get(db,n['id'])
            if DEMO or r.owner==user.id: r.data={**r.data,'read':True}
        db.commit(); return {'ok':True}
@app.get('/api/audit-logs')
def logs(limit:int=100,user=Depends(current)):
    reviewer(user)
    with Session() as db: return [{'id':a.id,'actor':a.actor,'action':a.action,'target':a.target,'created_at':a.created_at} for a in db.scalars(select(Audit).order_by(Audit.created_at.desc()).limit(min(max(limit,1),500)))]
@app.get('/api/analytics/{section}')
def analytics(section:str,user=Depends(current)):
    with Session() as db:
        cs=listing(db,'case',user); es=listing(db,'escalation',user); scores=[c['analysis']['uncertainty']['uncertainty_score'] for c in cs if c.get('analysis')]
        return {'patients':len(listing(db,'patient',user)),'cases':len(cs),'analyzed':len(scores),'pending':sum(e['status'] in ('Pending','Assigned','Additional Information Required') for e in es),'high_uncertainty':sum(s>50 for s in scores),'completed':sum(c['status'] in ('Approved','Completed','Rejected') for c in cs),'average_uncertainty':round(sum(scores)/len(scores)) if scores else 0,'distribution':[{'name':label,'value':sum(low<=s<=high for s in scores)} for label,low,high in [('Lower',0,25),('Moderate',26,50),('High',51,75),('Very high',76,100)]],'trend':[{'name':c['patient_name'].split()[0],'uncertainty':c.get('analysis',{}).get('uncertainty',{}).get('uncertainty_score',0)} for c in cs[:10]],'agent_executions':len(listing(db,'execution',user))}
@app.get('/api/reports')
def reports(user=Depends(current)):
    with Session() as db: return listing(db,'report',user)
@app.post('/api/reports/generate')
def generate(body:dict,user=Depends(current)):
    with Session() as db:
        c=get(db,str(body.get('case_id','')),'case'); visible(user,c)
        if not c.data.get('analysis'): raise HTTPException(409,'Run analysis first')
        r=add(db,'report',{'case_id':c.id,'patient_name':c.data['patient_name'],'status':c.data['status'],'snapshot':serialize(c)},user); audit(db,user,'Report generated',r.id); notify(db,user,'Report generated',c.id); return serialize(r)
@app.get('/api/reports/{id}/download')
def download(id:str,user=Depends(current)):
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    with Session() as db:
        r=get(db,id,'report'); visible(user,r); c=r.data['snapshot']; a=c['analysis']; buffer=io.BytesIO(); styles=getSampleStyleSheet(); story=[]
        def p(text,style='BodyText'): story.extend([Paragraph(escape(str(text)),styles[style]),Spacer(1,8)])
        p('CLINIXAI | Decision-support report','Title'); p('SYNTHETIC RESEARCH DEMONSTRATION','Heading2')
        p('Case: '+c['id']); p('Patient reference: '+c['patient_id']); p('Generated: '+r.created_at); p('Review status: '+c['status'])
        p('Reported symptoms','Heading2'); p(c['symptoms']); p('Observations','Heading2')
        for o in a['observations']: p(o['finding'])
        p('Uncertainty','Heading2'); p(str(a['uncertainty']['uncertainty_score'])+'/100 · '+a['uncertainty']['uncertainty_category']); p(a['uncertainty']['method'])
        for key,value in a['uncertainty']['contributions'].items(): p(f'{key}: {value} uncertainty points')
        p('Evidence and provenance','Heading2')
        for e in a['evidence']: p(e['title']+' | '+e['source']+' | '+e['passage'])
        if not a['evidence']: p('No supporting evidence retrieved.')
        p('Safety flags and contradictions','Heading2')
        for flag in a['safety']+a['contradictions']: p(flag)
        p('Explanation','Heading2')
        for e in a['explanations']: p(e['agent']+': '+e['statement'])
        if c.get('review'): p('Human review','Heading2'); p(c['review']['reviewer_name']+' · '+c['review']['decision']); p(c['review']['notes'])
        p('Limitations','Heading2'); p(a['report']['disclaimer']); p('Rules, thresholds, and retrieval are unvalidated demonstration mechanisms. Synthetic source material is not clinical evidence. All outputs require qualified human review.')
        def footer(canvas,doc):
            canvas.setFont('Helvetica',8); canvas.setFillColor(colors.grey); canvas.drawString(40,24,f'CLINIXAI · Synthetic research demonstration · Page {doc.page}')
        SimpleDocTemplate(buffer,rightMargin=42,leftMargin=42,topMargin=42,bottomMargin=42).build(story,onFirstPage=footer,onLaterPages=footer)
        audit(db,user,'Report downloaded',id)
        return Response(buffer.getvalue(),media_type='application/pdf',headers={'Content-Disposition':f'attachment; filename="clinixai-{id[:8]}.pdf"'})
