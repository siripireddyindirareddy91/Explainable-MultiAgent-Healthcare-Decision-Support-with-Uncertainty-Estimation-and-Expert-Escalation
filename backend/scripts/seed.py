"""Idempotently create synthetic demo users and patient workflows."""
from backend.app.main import seed
seed()
print('Synthetic demo seed complete.')
