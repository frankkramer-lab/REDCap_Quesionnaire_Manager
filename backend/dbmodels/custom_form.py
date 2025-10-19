from backend.extensions import db
from sqlalchemy.dialects.postgresql import JSON


class CustomForm(db.Model):
    __tablename__ = "custom_forms"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    created_by_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_by = db.relationship('User', foreign_keys=[created_by_id], backref='created_custom_forms')


    sections = db.relationship("CustomSection", backref="form", cascade="all, delete-orphan")

class CustomSection(db.Model):
    __tablename__ = "custom_sections"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    order = db.Column(db.Integer)

    form_id = db.Column(db.Integer, db.ForeignKey("custom_forms.id", ondelete="CASCADE"))
    questions = db.relationship("CustomQuestion", backref="section", cascade="all, delete-orphan")


class CustomQuestion(db.Model):
    __tablename__ = "custom_questions"
    id = db.Column(db.Integer, primary_key=True)
    variable_name = db.Column(db.String(255), nullable=False)
    label = db.Column(db.Text, nullable=False)
    field_type = db.Column(db.String(50), nullable=False)
    choices = db.Column(JSON, nullable=True)
    required = db.Column(db.Boolean, default=False)
    dependencies = db.Column(JSON, nullable=True)
    validation_type = db.Column(db.String)
    validation_min = db.Column(db.String)
    validation_max = db.Column(db.String)
    identifier = db.Column(db.String)
    branching_logic = db.Column(db.String)
    field_annotation = db.Column(db.String)
    field_note = db.Column(db.Text, nullable=True)
    custom_alignment = db.Column(db.String(20), nullable=True)
    question_number = db.Column(db.String(20), nullable=True)
    matrix_group_name = db.Column(db.String(100), nullable=True)
    matrix_ranking = db.Column(db.Boolean, default=False)
    version = db.Column(db.String(10), default="1.0")
    last_edited_by = db.Column(db.String(255), nullable=True)
    last_edited_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    section_id = db.Column(db.Integer, db.ForeignKey("custom_sections.id", ondelete="CASCADE"))
