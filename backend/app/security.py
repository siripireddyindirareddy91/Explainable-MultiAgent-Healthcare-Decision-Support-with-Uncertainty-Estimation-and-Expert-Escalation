import os, hashlib, secrets, hmac, time
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .database import Session, User, url
from sqlalchemy.exc import IntegrityError

DEMO = os.getenv('DEMO_MODE','true').lower() == 'true'
SECRET = os.getenv('JWT_SECRET')
if not SECRET:
    if not DEMO: raise RuntimeError('JWT_SECRET is required outside demo mode')
    SECRET='clinixai-public-synthetic-demo-only-2026-not-for-private-data'
bearer=HTTPBearer()
def hash_password(p):
    salt=secrets.token_hex(16)
    return salt+':'+hashlib.pbkdf2_hmac('sha256',p.encode(),salt.encode(),260000).hex()
def verify(p,stored):
    salt,digest=stored.split(':')
    return hmac.compare_digest(digest,hashlib.pbkdf2_hmac('sha256',p.encode(),salt.encode(),260000).hex())
def token(user): return jwt.encode({'sub':user.id,'exp':int(time.time())+7200,'iat':int(time.time()),'demo_identity':{'name':user.name,'email':user.email} if DEMO and user.role=='clinician' else None},SECRET,algorithm='HS256')
def current(auth:HTTPAuthorizationCredentials=Depends(bearer)):
    try:
        payload=jwt.decode(auth.credentials,SECRET,algorithms=['HS256'])
        with Session() as db:
            user=db.get(User,payload['sub'])
            # A Vercel cold start can replace demo SQLite while a signed session
            # remains valid. Recover only clinician identity, never privileged roles.
            identity=payload.get('demo_identity')
            if not user and DEMO and url.startswith('sqlite') and identity and isinstance(identity,dict):
                user=User(id=payload['sub'],name=str(identity.get('name','Demo clinician'))[:100],email=str(identity.get('email',''))[:254],role='clinician',password=hash_password(secrets.token_urlsafe(40)))
                db.add(user)
                try: db.commit()
                except IntegrityError:
                    db.rollback()
                    user=db.get(User,payload['sub'])
        if not user: raise HTTPException(401,'This account is unavailable. Please sign in again.')
        return user
    except jwt.ExpiredSignatureError: raise HTTPException(401,'Your session expired. Please sign in again.')
    except jwt.InvalidTokenError: raise HTTPException(401,'Invalid session. Please sign in again.')
def reviewer(user):
    if user.role not in ('expert','admin'): raise HTTPException(403,'Expert or administrator role required')
def admin(user):
    if user.role!='admin': raise HTTPException(403,'Administrator role required')
def public_user(u): return {'id':u.id,'name':u.name,'email':u.email,'role':u.role}
