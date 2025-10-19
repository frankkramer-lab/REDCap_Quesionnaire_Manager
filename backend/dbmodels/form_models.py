from backend.extensions import db
from sqlalchemy.dialects.postgresql import JSON
from datetime import datetime

class Form(db.Model):
    __tablename__ = "forms"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    imported_by_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    imported_by = db.relationship('User', backref='imported_forms')
    import_source_id = db.Column(db.Integer, db.ForeignKey("imported_csvs.id", ondelete="CASCADE"))
    sections = db.relationship(
        "Section",
        backref="form",
        cascade="all, delete-orphan",
        passive_deletes=True
    )


class Section(db.Model):
    __tablename__ = "sections"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    order = db.Column(db.Integer)
    form_id = db.Column(db.Integer, db.ForeignKey("forms.id", ondelete="CASCADE"))

    questions = db.relationship(
        "Question",
        backref="section",
        cascade="all, delete-orphan",
        passive_deletes=True
    )


class Question(db.Model):
    __tablename__ = "questions"
    id = db.Column(db.Integer, primary_key=True)
    variable_name = db.Column(db.String(255), nullable=False)
    label = db.Column(db.Text, nullable=False)
    field_type = db.Column(db.String(50), nullable=False)
    choices = db.Column(JSON, nullable=True)
    required = db.Column(db.Boolean, default=False)
    dependencies = db.Column(JSON, nullable=True)

    validation_type = db.Column(db.String(100), nullable=True)
    validation_min = db.Column(db.String(100), nullable=True)
    validation_max = db.Column(db.String(100), nullable=True)
    identifier = db.Column(db.String(100), nullable=True)
    branching_logic = db.Column(db.String(255), nullable=True)
    field_annotation = db.Column(db.String(255), nullable=True)

    field_note = db.Column(db.Text, nullable=True)
    custom_alignment = db.Column(db.String(50), nullable=True)
    question_number = db.Column(db.String(50), nullable=True)
    matrix_group_name = db.Column(db.String(100), nullable=True)
    matrix_ranking = db.Column(db.Boolean, default=False)

    version = db.Column(db.String(10), default="1.0")
    last_modified = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    modified_by = db.Column(db.String(255), nullable=True)

    section_id = db.Column(db.Integer, db.ForeignKey("sections.id", ondelete="CASCADE"))
    change_type = db.Column(db.String, default="changed")  # z. B. 'imported', 'created', 'fixed', 'changed'
    change_annotation = db.Column(db.Text, nullable=True)