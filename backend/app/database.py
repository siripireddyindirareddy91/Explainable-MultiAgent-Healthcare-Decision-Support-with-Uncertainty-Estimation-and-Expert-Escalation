import os, tempfile, uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

def now(): return datetime.now(timezone.utc).isoformat()
def uid(): return str(uuid.uuid4())
url = os.getenv('DATABASE_URL', 'sqlite:///' + os.path.join(tempfile.gettempdir() if os.getenv('VERCEL') else '.', 'clinixai.db'))
if url.startswith('postgres://'): url = url.replace('postgres://', 'postgresql+psycopg://', 1)
if url.startswith('postgresql://'): url = url.replace('postgresql://', 'postgresql+psycopg://', 1)
engine = create_engine(url, connect_args={'check_same_thread':False} if url.startswith('sqlite') else {}, pool_pre_ping=True)
Session = sessionmaker(engine, expire_on_commit=False)
class Base(DeclarativeBase): pass
class User(Base):
    __tablename__='users'
    id: Mapped[str]=mapped_column(String,primary_key=True,default=uid)
    email: Mapped[str]=mapped_column(String,unique=True,index=True)
    name: Mapped[str]=mapped_column(String)
    password: Mapped[str]=mapped_column(String)
    role: Mapped[str]=mapped_column(String,default='clinician')
class Record(Base):
    __tablename__='records'
    id: Mapped[str]=mapped_column(String,primary_key=True,default=uid)
    kind: Mapped[str]=mapped_column(String,index=True)
    owner: Mapped[str]=mapped_column(String,index=True)
    data: Mapped[dict]=mapped_column(JSON)
    created_at: Mapped[str]=mapped_column(String,default=now,index=True)
    deleted: Mapped[bool]=mapped_column(Boolean,default=False)
class Audit(Base):
    __tablename__='audit_logs'
    id: Mapped[str]=mapped_column(String,primary_key=True,default=uid)
    actor: Mapped[str]=mapped_column(String)
    action: Mapped[str]=mapped_column(String)
    target: Mapped[str]=mapped_column(String)
    created_at: Mapped[str]=mapped_column(String,default=now)
def init_db(): Base.metadata.create_all(engine)
def serialize(r): return {'id':r.id,'created_at':r.created_at,**r.data}
def audit(db,user,action,target): db.add(Audit(actor=user.name if user else 'system',action=action,target=target)); db.commit()
