"""Initialize the version-one SQLAlchemy schema. Run from the repository root."""
from backend.app.database import init_db
init_db()
print('CLINIXAI version-one schema initialized.')
