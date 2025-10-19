from flask import Blueprint, request, jsonify, Response
from backend.extensions import db
from backend.dbmodels.custom_form import CustomForm, CustomSection, CustomQuestion
import io
import csv
from backend.dbmodels.user import User
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload



custom_form_bp = Blueprint("custom_form", __name__)


# 📤 Save new custom form
@custom_form_bp.route("/api/custom-forms", methods=["POST"])
@jwt_required()
def create_custom_form():
    data = request.get_json()

    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user:
        return jsonify({"error": "User not found"}), 401

    custom_form = CustomForm(
        name=data["name"],
        created_by=user,  # User-Objekt zuordnen
        created_at=datetime.utcnow()
    )

    for section_data in data["sections"]:
        section = CustomSection(
            title=section_data["title"],
            order=section_data["order"],
            form=custom_form
        )

        for q_data in section_data["questions"]:
            question = CustomQuestion(
                variable_name=q_data["variable_name"],
                label=q_data["label"],
                field_type=q_data["field_type"],
                choices=q_data.get("choices"),
                required=q_data.get("required", False),
                validation_type=q_data.get("validation_type"),
                validation_min=q_data.get("validation_min"),
                validation_max=q_data.get("validation_max"),
                identifier=q_data.get("identifier"),
                branching_logic=q_data.get("branching_logic"),
                field_annotation=q_data.get("field_annotation"),
                dependencies=q_data.get("dependencies"),
                field_note=q_data.get("field_note"),
                version=q_data.get("version", "1.0"),
                custom_alignment=q_data.get("custom_alignment"),
                question_number=q_data.get("question_number"),
                matrix_group_name=q_data.get("matrix_group_name"),
                matrix_ranking=q_data.get("matrix_ranking"),
                last_edited_by=user.username,  # hier auch setzen
                last_edited_at=datetime.utcnow(),
                section=section
            )

    db.session.add(custom_form)
    db.session.commit()

    return jsonify({"message": "Custom form created successfully"}), 201


# 📥 Get all custom forms
@custom_form_bp.route("/api/custom-forms", methods=["GET"])
def get_custom_forms():
    forms = CustomForm.query.options(joinedload(CustomForm.created_by)).order_by(CustomForm.created_at.desc()).all()
    result = []

    for form in forms:
        result.append({
            "id": form.id,
            "name": form.name,
            "created_at": form.created_at.isoformat(),
            "created_by": {
    "id": form.created_by.id,
    "username": form.created_by.username
} if form.created_by else None,
            "sections": [
                {
                    "id": s.id,
                    "title": s.title,
                    "order": s.order,
                    "questions": [
                        {
                            "id": q.id,
                            "variable_name": q.variable_name,
                            "label": q.label,
                            "field_type": q.field_type,
                            "choices": q.choices,
                            "required": q.required,
                            "dependencies": q.dependencies,
                            "validation_type": q.validation_type,
                            "validation_min": q.validation_min,
                            "validation_max": q.validation_max,
                            "identifier": q.identifier,
                            "branching_logic": q.branching_logic,
                            "field_note": q.field_note,
                            "custom_alignment": q.custom_alignment,
                            "question_number": q.question_number,
                            "matrix_group_name": q.matrix_group_name,
                            "matrix_ranking": q.matrix_ranking,
                            "field_annotation": q.field_annotation,
                            "version": q.version
                        }
                        for q in s.questions
                    ]
                }
                for s in form.sections
            ]
        })

    return jsonify(result)


# 🗑️ Delete a custom form
@custom_form_bp.route("/api/custom-forms/<int:form_id>", methods=["DELETE"])
def delete_custom_form(form_id):
    form = CustomForm.query.get(form_id)
    if not form:
        return jsonify({"error": "Form not found"}), 404

    for section in CustomSection.query.filter_by(form_id=form.id).all():
        CustomQuestion.query.filter_by(section_id=section.id).delete()
        db.session.delete(section)

    db.session.delete(form)
    db.session.commit()

    return jsonify({"message": "Form deleted"}), 200


# 📥 Export a single custom form as REDCap-compatible CSV
@custom_form_bp.route("/api/custom-forms/<form_id>/export", methods=["GET"])
def export_custom_form(form_id):
    if isinstance(form_id, str) and form_id.startswith("custom_"):
        try:
            integer_id = int(form_id.split("_", 1)[1])
        except ValueError:
            return jsonify({"error": "Invalid form ID"}), 400
    else:
        try:
            integer_id = int(form_id)
        except ValueError:
            return jsonify({"error": "Invalid form ID"}), 400

    form = CustomForm.query.get(integer_id)
    if not form:
        return jsonify({"error": "Form not found"}), 404

    buffer = io.StringIO()
    writer = csv.writer(buffer)

    header = [
        "Variable / Field Name",
        "Form Name",
        "Section Header",
        "Field Type",
        "Field Label",
        "Choices, Calculations, OR Slider Labels",
        "Field Note",
        "Text Validation Type OR Show Slider Number",
        "Text Validation Min",
        "Text Validation Max",
        "Identifier?",
        "Branching Logic (Show field only if...)",
        "Required Field?",
        "Custom Alignment",
        "Question Number (surveys only)",
        "Matrix Group Name",
        "Matrix Ranking?",
        "Field Annotation",
    ]
    writer.writerow(header)

    sections = (
        CustomSection.query
        .filter_by(form_id=form.id)
        .order_by(CustomSection.order.asc(), CustomSection.id.asc())
        .all()
    )

    for section in sections:
        questions = (
            CustomQuestion.query
            .filter_by(section_id=section.id)
            .order_by(CustomQuestion.id.asc())
            .all()
        )
        for q in questions:
            variable_name = q.variable_name or ""
            form_name = form.name or ""
            section_header = section.title or ""
            field_type = q.field_type or ""
            field_label = q.label or ""
            field_note = q.field_note or ""
            validation_type = q.validation_type or ""
            validation_min = q.validation_min or ""
            validation_max = q.validation_max or ""
            identifier = q.identifier or ""
            branching_logic = q.branching_logic or ""
            required_field = "y" if q.required else "n"
            custom_alignment = q.custom_alignment or ""
            question_number = str(q.question_number or "")
            matrix_group_name = q.matrix_group_name or ""
            matrix_ranking = "y" if getattr(q, "matrix_ranking", False) else "n"
            field_annotation = q.field_annotation or ""

            choices_str = ""
            if q.choices is not None:
                try:
                    if isinstance(q.choices, (list, tuple)):
                        pairs = [f"{item['value']}, {item['label']}" for item in q.choices]
                        choices_str = " | ".join(pairs)
                    else:
                        choices_str = str(q.choices)
                except:
                    choices_str = str(q.choices)

            row = [
                variable_name, form_name, section_header, field_type,
                field_label, choices_str, field_note,
                validation_type, validation_min, validation_max,
                identifier, branching_logic, required_field,
                custom_alignment, question_number,
                matrix_group_name, matrix_ranking, field_annotation,
            ]
            writer.writerow(row)

    csv_data = buffer.getvalue()
    buffer.close()

    filename = f"form_{form.id}.csv"
    return Response(
        csv_data,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
