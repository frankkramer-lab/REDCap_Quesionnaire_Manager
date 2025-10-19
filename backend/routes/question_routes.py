from flask import Blueprint, request, jsonify
from backend.extensions import db
from backend.dbmodels.form_models import Form, Section, Question
from backend.dbmodels.user import User
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
import logging

logging.basicConfig(level=logging.DEBUG)
questions_bp = Blueprint("questions_bp", __name__)


@questions_bp.route("/api/questions/all", methods=["GET"])
def get_all_questions_grouped():
    results = []
    forms = Form.query.order_by(Form.created_at.desc()).all()
    for form in forms:
        sections = Section.query.filter_by(form_id=form.id).all()
        structured_sections = []

        for section in sections:
            questions = Question.query.filter_by(section_id=section.id).order_by(
                Question.variable_name.asc(), Question.version.desc()
            ).all()

            grouped = {}
            for q in questions:
                if q.variable_name not in grouped:
                    grouped[q.variable_name] = []
                grouped[q.variable_name].append({
                    "id": q.id,
                    "source": "versioned",
                    "form_id": form.id,
                    "section_id": section.id,
                    "section": section.title,
                    "question_text": q.label,
                    "variable_name": q.variable_name,
                    "type": q.field_type,
                    "choices": q.choices,
                    "required": q.required,
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
                    "matrix_ranking": q.matrix_ranking,
                    "version": q.version,
                    "last_edited_by": q.modified_by,
                    "last_edited_at": q.last_modified.isoformat() if q.last_modified else None,
                    "change_type": q.change_type or "changed",
                    "change_annotation": q.change_annotation,
                })

            structured_sections.append({
                "section_name": section.title,
                "questions": [
                    {
                        "variable_name": varname,
                        "versions": versions
                    }
                    for varname, versions in grouped.items()
                ]
            })

        results.append({
            "form_id": f"form_{form.id}",
            "form_name": form.name,
            "source": "versioned",
            "created_at": form.created_at.isoformat(),
            "imported_by": {
                "id": form.imported_by.id,
                "username": form.imported_by.username
            } if form.imported_by else None,

            "sections": structured_sections
        })

    return jsonify(results)


@questions_bp.route("/api/questions/<int:question_id>", methods=["PUT"])
@jwt_required()
def update_question(question_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 401

    data = request.get_json()
    new_data = data.get("new_data")
    if not new_data:
        return jsonify({"error": "No new data provided"}), 400

    old_question = Question.query.get(question_id)
    if not old_question:
        return jsonify({"error": "Question not found"}), 404

    original_var = old_question.variable_name
    new_var = new_data.get("variable_name", original_var)



    try:
        main_version = int(float(old_question.version)) + 1
    except ValueError:
        main_version = 1

    like_pattern = f"{main_version}.%"
    existing_versions = Question.query.filter(
        Question.section_id == old_question.section_id,
        Question.variable_name == old_question.variable_name,
        or_(
            Question.version.like(like_pattern),
            Question.version == str(main_version)
        )
    ).all()

    existing_subs = [
        int(v.version.split(".")[1]) for v in existing_versions
        if v.version.count(".") == 1 and v.version.split(".")[1].isdigit()
    ]
    next_sub = max(existing_subs, default=-1) + 1
    new_version_str = f"{main_version}.{next_sub}"

    new_version = Question(
        variable_name=new_var,
        label=new_data.get("label", old_question.label),
        field_type=new_data.get("field_type", old_question.field_type),
        choices=new_data.get("choices", old_question.choices),
        required=new_data.get("required", old_question.required),
        dependencies=new_data.get("dependencies", old_question.dependencies),
        validation_type=new_data.get("validation_type", old_question.validation_type),
        validation_min=new_data.get("validation_min", old_question.validation_min),
        validation_max=new_data.get("validation_max", old_question.validation_max),
        identifier=new_data.get("identifier", old_question.identifier),
        branching_logic=new_data.get("branching_logic", old_question.branching_logic),
        field_annotation=new_data.get("field_annotation", old_question.field_annotation),
        version=new_version_str,
        last_modified=datetime.utcnow(),
        modified_by=user.username,
        section_id=old_question.section_id,
        field_note=new_data.get("field_note", old_question.field_note),
        custom_alignment=new_data.get("custom_alignment", old_question.custom_alignment),
        question_number=new_data.get("question_number", old_question.question_number),
        matrix_group_name=new_data.get("matrix_group_name", old_question.matrix_group_name),
        matrix_ranking=new_data.get("matrix_ranking", old_question.matrix_ranking),
        change_type=new_data.get("change_type", "changed"),
        change_annotation=new_data.get("change_annotation", ""),
    )

    db.session.add(new_version)
    db.session.commit()

    all_versions = Question.query.filter_by(
        variable_name=new_version.variable_name,
        section_id=new_version.section_id
    ).order_by(Question.version.desc()).all()

    versions_serialized = []
    for q in all_versions:
        versions_serialized.append({
            "id": q.id,
            "source": "versioned",
            "form_id": q.section.form.id,
            "section_id": q.section_id,
            "section": q.section.title,
            "question_text": q.label,
            "variable_name": q.variable_name,
            "type": q.field_type,
            "choices": q.choices,
            "required": q.required,
            "validation_type": q.validation_type,
            "validation_min": q.validation_min,
            "validation_max": q.validation_max,
            "identifier": q.identifier,
            "branching_logic": q.branching_logic,
            "field_annotation": q.field_annotation,
            "version": q.version,
            "last_edited_by": q.modified_by,
            "last_edited_at": q.last_modified.isoformat() if q.last_modified else None,
            "field_note": q.field_note,
            "custom_alignment": q.custom_alignment,
            "question_number": q.question_number,
            "matrix_group_name": q.matrix_group_name,
            "matrix_ranking": q.matrix_ranking,
            "change_type": q.change_type or "changed",
            "change_annotation": q.change_annotation
        })

    return jsonify({
        "message": "New version saved",
        "new_id": new_version.id,
        "variable_name": new_version.variable_name,
        "section_id": new_version.section_id,
        "all_versions": versions_serialized
    }), 200


@questions_bp.route("/api/questions/<int:question_id>", methods=["DELETE"])
@jwt_required()
def delete_question_version(question_id):
    logging.debug(f"DELETE route reached: Deleting question version with ID {question_id}")
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 401

    q = Question.query.get(question_id)
    if not q:
        return jsonify({"error": "Question version not found"}), 404

    if q.modified_by != user.username:
        return jsonify({"error": "You can only delete your own versions"}), 403

    try:
        db.session.delete(q)
        db.session.commit()
        return jsonify({"message": f"Version {question_id} deleted successfully"}), 200
    except Exception as e:
        logging.error(f"Error deleting question version {question_id}: {e}")
        db.session.rollback()
        return jsonify({"error": "Error deleting the question version"}), 500

