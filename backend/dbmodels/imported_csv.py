from backend.extensions import db
from sqlalchemy.dialects.postgresql import JSON
from datetime import datetime

class ImportedCSV(db.Model):
    __tablename__ = "imported_csvs"

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    content = db.Column(JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 🔧 Nur ein Foreign Key zur User-Tabelle
    imported_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    imported_by = db.relationship("User", foreign_keys=[imported_by_id], backref="imported_csvs")

    # 🔗 Beziehung zu Form
    forms = db.relationship(
        "Form",
        backref="import_source",
        cascade="all, delete-orphan",
        passive_deletes=True
    )
