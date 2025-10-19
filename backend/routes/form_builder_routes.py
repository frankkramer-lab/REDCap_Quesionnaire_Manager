from flask import Blueprint, jsonify, request
from backend.extensions import db
from backend.dbmodels.imported_csv import ImportedCSV
from backend.dbmodels.form_models import Form, Section, Question

form_builder_bp = Blueprint("form_builder", __name__)


# Helper: convert REDCap-like choice string to dict
def parse_choices(choice_str):
    if not choice_str or "|" not in choice_str:
        return None
    try:
        return {
            key.strip(): val.strip()
            for key, val in (item.split(",", 1) for item in choice_str.split("|"))
        }
    except Exception:
        return None


# Flat structured output of all form data
@form_builder_bp.route("/api/form-builder/data", methods=["GET"])
def get_builder_data():
    forms = Form.query.all()
    sections = Section.query.all()
    questions = Question.query.all()

    return jsonify({
        "forms": [
            {
                "id": f.id,
                "name": f.name,
                "description": f.description,
                "created_at": f.created_at.isoformat()
            } for f in forms
        ],
        "sections": [
            {
                "id": s.id,
                "title": s.title,
                "order": s.order,
                "form_id": s.form_id
            } for s in sections
        ],
        "questions": [
            {
                "id": q.id,
                "variable_name": q.variable_name,
                "label": q.label,
                "field_type": q.field_type,
                "choices": q.choices,
                "required": q.required,
                "dependencies": q.dependencies,
                "section_id": q.section_id,
                "validation_type": q.validation_type,
                "validation_min": q.validation_min,
                "validation_max": q.validation_max,
                "identifier": q.identifier,
                "branching_logic": q.branching_logic,
                "field_annotation": q.field_annotation,
                "field_note": q.field_note,
                "custom_alignment": q.custom_alignment,
                "question_number": q.question_number,
                "matrix_group_name": q.matrix_group_name,
                "matrix_ranking": q.matrix_ranking
            } for q in questions
        ]
    })


# Fully nested form output
@form_builder_bp.route("/api/forms/full", methods=["GET"])
def get_full_forms():
    forms = Form.query.all()
    result = []

    for form in forms:
        result.append({
            "id": form.id,
            "name": form.name,
            "description": form.description,
            "created_at": form.created_at.isoformat(),

            "sections": [
                {
                    "id": section.id,
                    "title": section.title,
                    "order": section.order,
                    "questions": [
                        {
                            "id": question.id,
                            "variable_name": question.variable_name,
                            "label": question.label,
                            "field_type": question.field_type,
                            "choices": question.choices,
                            "required": question.required,
                            "dependencies": question.dependencies,
                            "validation_type": question.validation_type,
                            "validation_min": question.validation_min,
                            "validation_max": question.validation_max,
                            "identifier": question.identifier,
                            "branching_logic": question.branching_logic,
                            "field_annotation": question.field_annotation,
                            "field_note": question.field_note,
                            "custom_alignment": question.custom_alignment,
                            "question_number": question.question_number,
                            "matrix_group_name": question.matrix_group_name,
                            "matrix_ranking": question.matrix_ranking
                        }
                        for question in section.questions
                    ]
                }
                for section in form.sections
            ]
        })
    return jsonify(result)


# Create a new form based on existing question IDs
@form_builder_bp.route("/api/forms", methods=["POST"])
def create_new_form():
    data = request.json
    form_name = data.get("name")
    description = data.get("description")
    question_ids = data.get("question_ids", [])

    if not form_name or not question_ids:
        return jsonify({"error": "Name and questions are required"}), 400

    new_form = Form(name=form_name, description=description)
    db.session.add(new_form)
    db.session.flush()

    default_section = Section(title="Default Section", order=1, form_id=new_form.id)
    db.session.add(default_section)
    db.session.flush()

    for qid in question_ids:
        original = Question.query.get(qid)
        if original:
            copied = Question(
                variable_name=f"{original.variable_name}_{new_form.id}",
                label=original.label,
                field_type=original.field_type,
                choices=original.choices,
                required=original.required,
                dependencies=original.dependencies,
                validation_type=original.validation_type,
                validation_min=original.validation_min,
                validation_max=original.validation_max,
                identifier=original.identifier,
                branching_logic=original.branching_logic,
                field_annotation=original.field_annotation,
                field_note=original.field_note,
                custom_alignment=original.custom_alignment,
                question_number=original.question_number,
                matrix_group_name=original.matrix_group_name,
                matrix_ranking=original.matrix_ranking,
                section_id=default_section.id,
            )
            db.session.add(copied)

    db.session.commit()
    return jsonify({"message": "Form created successfully"}), 201


# Convert all imported CSV entries to structured forms
@form_builder_bp.route("/api/forms/from-imports", methods=["POST"])
def convert_imported_csvs_to_forms():
    csv_entries = ImportedCSV.query.all()
    created_forms = []

    for entry in csv_entries:
        content = entry.content
        if not content or not isinstance(content, list):
            continue

        form_name = content[0].get("Form Name") or f"Imported Form {entry.id}"
        form = Form(name=form_name, description=f"Imported on {entry.created_at.strftime('%Y-%m-%d')}")
        db.session.add(form)
        db.session.flush()

        section_map = {}
        for index, row in enumerate(content):
            section_title = row.get("Section Header", "General") or "General"
            if section_title not in section_map:
                section = Section(title=section_title, order=len(section_map) + 1, form_id=form.id)
                db.session.add(section)
                db.session.flush()
                section_map[section_title] = section

            question = Question(
                variable_name=row.get("Variable / Field Name", f"var_{index}"),
                label=row.get("Field Label", ""),
                field_type=row.get("Field Type", "text"),
                choices=parse_choices(row.get("Choices, Calculations, OR Slider Labels", "")),
                required=(row.get("Required Field?", "").lower() == "y"),
                validation_type=row.get("Text Validation Type OR Show Slider Number"),
                validation_min=row.get("Text Validation Min"),
                validation_max=row.get("Text Validation Max"),
                identifier=row.get("Identifier?"),
                branching_logic=row.get("Branching Logic (Show field only if...)"),
                field_annotation=row.get("Field Annotation"),
                field_note=row.get("Field Note"),
                custom_alignment=row.get("Custom Alignment"),
                question_number=row.get("Question Number (surveys only)"),
                matrix_group_name=row.get("Matrix Group Name"),
                matrix_ranking=(row.get("Matrix Ranking?", "").lower() == "y"),
                dependencies=None,
                section_id=section_map[section_title].id
            )
            db.session.add(question)

        created_forms.append(form.name)

    db.session.commit()
    return jsonify({
        "message": f"{len(created_forms)} forms created",
        "forms": created_forms
    }), 201
