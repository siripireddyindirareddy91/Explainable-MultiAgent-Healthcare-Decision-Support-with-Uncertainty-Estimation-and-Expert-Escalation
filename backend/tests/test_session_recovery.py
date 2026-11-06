"""Regression checks for a valid demo session surviving SQLite account loss."""
from .test_system import client, auth
from backend.app.database import Session, User
import uuid

def test_registered_clinician_session_survives_demo_database_reset():
    response=client.post('/api/auth/register',json={'email':uuid.uuid4().hex+'@example.test','name':'Synthetic Cold Start','password':'DemoPassword!2026'})
    assert response.status_code==200
    data=response.json(); headers={'Authorization':'Bearer '+data['access_token']}
    with Session() as db:
        user=db.get(User,data['user']['id']); db.delete(user); db.commit()
    recovered=client.get('/api/auth/me',headers=headers)
    assert recovered.status_code==200,recovered.text
    assert recovered.json()['id']==data['user']['id']
    assert recovered.json()['role']=='clinician'
    assert client.get('/api/patients',headers=headers).status_code==200
    assert client.get('/api/audit-logs',headers=headers).status_code==403

def test_expired_or_tampered_sessions_are_rejected():
    assert client.get('/api/auth/me',headers={'Authorization':'Bearer invalid.jwt.signature'}).status_code==401

def test_seed_contains_varied_records_and_reports():
    headers=auth('expert')
    cases=client.get('/api/cases',headers=headers).json()
    assert len(cases)>=16
    assert any(c['status']=='Completed' for c in cases)
    assert client.get('/api/reports',headers=headers).json()
