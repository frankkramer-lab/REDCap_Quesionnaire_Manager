import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import app
from extensions import db

with app.app_context():
    db.create_all()
    print("📦 Datenbanktabellen wurden erfolgreich erstellt.")
