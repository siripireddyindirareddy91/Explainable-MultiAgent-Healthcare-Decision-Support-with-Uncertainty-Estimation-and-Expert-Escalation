import os, hashlib, secrets, hmac, time
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .database import Session, User

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
def token(user): return jwt.encode({'sub':user.id,'exp':int(time.time())+7200,'iat':int(time.time())},SECRET,algorithm='HS256')
def current(auth:HTTPAuthorizationCredentials=Depends(bearer)):
    try:
        payload=jwt.decode(auth.credentials,SECRET,algorithms=['HS256'])
        with Session() as db: user=db.get(User,payload['sub'])
        if not user: raise ValueError()
        return user
    except Exception: raise HTTPException(401,'Session expired. Please sign in again.')
def reviewer(user):
    if user.role not in ('expert','admin'): raise HTTPException(403,'Expert or administrator role required')
def admin(user):
    if user.role!='admin': raise HTTPException(403,'Administrator role required')
def public_user(u): return {'id':u.id,'name':u.name,'email':u.email,'role':u.role}
