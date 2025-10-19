from flask import Blueprint, request, jsonify, send_file
from backend.extensions import db
from backend.dbmodels.imported_csv import ImportedCSV
from backend.dbmodels.form_models import Form, Section, Question
from backend.dbmodels.custom_form import CustomForm, CustomSection, CustomQuestion
import csv
import io
import json
from flask_jwt_extended import get_jwt_identity, jwt_required
from backend.dbmodels.user import User

import_bp = Blueprint("import", __name__)


def make_unique_variable_name(base_name, existing_names):
    """Generates a unique variable name by appending _1, _2, etc."""
    if base_name not in existing_names:
        return base_name
    i = 1
    while f"{base_name}_{i}" in existing_names:
        i += 1
    return f"{base_name}_{i}"


def str_to_bool(val):
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ('y', 'yes', 'true', '1')
    return False


def parse_choices(raw):
    """Converts REDCap choice string into a dictionary."""
    if not raw:
        return None
    result = {}
    for entry in raw.split("|"):
        parts = entry.strip().split(",", 1)
        if len(parts) == 2:
            key, value = parts
            result[key.strip()] = value.strip()
    return result


def import_csv_to_db(form_name, content, imported_csv):
    if not content:
        return

    form = Form(name=form_name, import_source_id=imported_csv.id,imported_by=imported_csv.imported_by,created_at=datetime.utcnow())
    db.session.add(form)
    db.session.flush()

    section_map = {}
    seen = set()
    existing_names = set(q.variable_name for q in Question.query.with_entities(Question.variable_name).all())

    for row in content:
        section_title = row.get("Section Header", "General").strip() or "General"

        if section_title not in section_map:
            section = Section(title=section_title, form_id=form.id)
            db.session.add(section)
            db.session.flush()
            section_map[section_title] = section
        else:
            section = section_map[section_title]

        base_var_name = row.get("Variable / Field Name", "").strip()
        variable_name = make_unique_variable_name(base_var_name, existing_names)
        existing_names.add(variable_name)

        question = Question(
            variable_name=variable_name,
            label=row.get("Field Label", ""),
            field_type=row.get("Field Type", ""),
            choices=parse_choices(row.get("Choices, Calculations, OR Slider Labels", "")),
            required=str_to_bool(row.get("Required Field?")),
            dependencies=None,
            section_id=section.id,
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
            matrix_ranking=str_to_bool(row.get("Matrix Ranking?"))
        )

        key = (question.variable_name, section.id)
        if key in seen:
            print(f"⚠️ Duplicate skipped: {key}")
            continue
        seen.add(key)

        db.session.add(question)

    db.session.commit()


@import_bp.route("/api/import-csv", methods=["POST"])
@jwt_required()
def import_csv():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    try:
        raw = file.read()
        try:
            decoded = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            decoded = raw.decode("latin1")

        stream = io.StringIO(decoded)
        reader = csv.DictReader(stream)
        data = list(reader)

        imported = ImportedCSV(
            filename=file.filename,
            content=data,
            imported_by=user
        )
        db.session.add(imported)
        db.session.commit()

        form_name = data[0].get("Form Name", file.filename)
        import_csv_to_db(form_name, data, imported)

        return jsonify({"message": "CSV imported successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@import_bp.route("/api/imported-csvs", methods=["GET"])
def get_imported_csvs():
    csvs = ImportedCSV.query.order_by(ImportedCSV.created_at.desc()).all()
    return jsonify([
        {
            "id": csv.id,
            "filename": csv.filename,
            "content": csv.content,
            "created_at": csv.created_at.isoformat(),
            "imported_by": csv.imported_by.username if csv.imported_by else "Unknown",
            "imported_by_id": csv.imported_by_id

        }
        for csv in csvs
    ])


@import_bp.route("/api/imported-csvs/<int:csv_id>", methods=["DELETE"])
@jwt_required()
def delete_imported_csv(csv_id):
    user_id = get_jwt_identity()

    csv = ImportedCSV.query.get(csv_id)
    if not csv:
        return {"error": "File not found"}, 404

    if csv.imported_by_id != user_id:
        return {"error": "Not authorized to delete this file"}, 403

    forms = Form.query.filter_by(import_source_id=csv_id).all()
    for form in forms:
        db.session.delete(form)

    db.session.delete(csv)
    db.session.commit()

    return {"message": "File and associated data successfully deleted"}


@import_bp.route("/api/export-csv/<int:csv_id>", methods=["GET"])
def export_csv(csv_id):
    import unicodedata

    def safe_filename(name):
        return unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")

    csv_file = ImportedCSV.query.get(csv_id)
    if not csv_file:
        return jsonify({"error": "File not found"}), 404

    try:
        output = io.StringIO(newline='')
        writer = csv.DictWriter(output, fieldnames=csv_file.content[0].keys(), extrasaction='ignore')
        writer.writeheader()
        writer.writerows(csv_file.content)

        mem = io.BytesIO()
        mem.write(output.getvalue().encode("utf-8-sig"))
        mem.seek(0)

        filename = safe_filename(csv_file.filename or "export.csv")

        return send_file(mem, as_attachment=True, download_name=filename, mimetype='text/csv')
    except Exception as e:
        return jsonify({"error": f"Export error: {str(e)}"}), 500


@import_bp.route("/api/imported-forms", methods=["GET"])
def get_imported_forms_structured():
    csvs = ImportedCSV.query.order_by(ImportedCSV.created_at.desc()).all()
    results = []

    for csv_file in csvs:
        try:
            raw_data = csv_file.content
            form_structure = {}

            for row in raw_data:
                form_name = row.get("Form Name", "Unknown Form")
                section_name = row.get("Section Header", "General")

                form_structure.setdefault(form_name, {})
                form_structure[form_name].setdefault(section_name, [])

                question_data = {
                    "variable_name": row.get("Variable / Field Name", ""),
                    "question_text": row.get("Field Label", ""),
                    "type": row.get("Field Type", ""),
                    "choices": row.get("Choices, Calculations, OR Slider Labels", ""),
                    "required": row.get("Required Field?", ""),
                    "validation_type": row.get("Text Validation Type OR Show Slider Number", ""),
                    "validation_min": row.get("Text Validation Min", ""),
                    "validation_max": row.get("Text Validation Max", ""),
                    "identifier": row.get("Identifier?", ""),
                    "branching_logic": row.get("Branching Logic (Show field only if...)", ""),
                    "field_annotation": row.get("Field Annotation", ""),
                    "custom_alignment": row.get("Custom Alignment", ""),
                    "question_number": row.get("Question Number (surveys only)", ""),
                    "matrix_group_name": row.get("Matrix Group Name", ""),
                    "matrix_ranking": row.get("Matrix Ranking?", ""),
                }

                form_structure[form_name][section_name].append(question_data)

            structured_form = {
                "id": csv_file.id,
                "filename": csv_file.filename,
                "created_at": csv_file.created_at.isoformat(),
                "imported_by": {
                    "id": csv_file.imported_by.id,
                    "username": csv_file.imported_by.username
                } if csv_file.imported_by else None,

                "form_name": list(form_structure.keys())[0],
                "sections": [
                    {
                        "section_name": sec_name,
                        "questions": questions
                    }
                    for sec_name, questions in form_structure[list(form_structure.keys())[0]].items()
                ]
            }

            results.append(structured_form)

        except Exception as e:
            print(f"Error processing CSV {csv_file.filename}: {e}")

    return jsonify(results)


@import_bp.route("/api/all-forms", methods=["GET"])
def get_all_forms_combined():
    results = []

    imported_csvs = ImportedCSV.query.order_by(ImportedCSV.created_at.desc()).all()
    for csv_file in imported_csvs:
        try:
            raw_data = csv_file.content
            form_structure = {}

            for row in raw_data:
                form_name = row.get("Form Name", "Unknown Form")
                section_name = row.get("Section Header", "General")

                form_structure.setdefault(form_name, {})
                form_structure[form_name].setdefault(section_name, [])

                question_data = {
                    "variable_name": row.get("Variable / Field Name", ""),
                    "question_text": row.get("Field Label", ""),
                    "type": row.get("Field Type", ""),
                    "choices": row.get("Choices, Calculations, OR Slider Labels", ""),
                    "required": row.get("Required Field?", ""),
                    "field_note": row.get("Field Note", ""),
                    "validation_type": row.get("Text Validation Type OR Show Slider Number", ""),
                    "validation_min": row.get("Text Validation Min", ""),
                    "validation_max": row.get("Text Validation Max", ""),
                    "identifier": row.get("Identifier?", ""),
                    "branching_logic": row.get("Branching Logic (Show field only if...)", ""),
                    "field_annotation": row.get("Field Annotation", ""),
                    "custom_alignment": row.get("Custom Alignment", ""),
                    "question_number": row.get("Question Number (surveys only)", ""),
                    "matrix_group_name": row.get("Matrix Group Name", ""),
                    "matrix_ranking": row.get("Matrix Ranking?", ""),
                }

                form_structure[form_name][section_name].append(question_data)

            results.append({
                "id": f"imported_{csv_file.id}",
                "source": "imported",
                "filename": csv_file.filename,
                "created_at": csv_file.created_at.isoformat(),
                "form_name": list(form_structure.keys())[0],
                "imported_by": {
    "id": csv_file.imported_by.id,
    "username": csv_file.imported_by.username
} if csv_file.imported_by else None,



                "sections": [
                    {
                        "section_name": sec,
                        "questions": qs
                    }
                    for sec, qs in form_structure[list(form_structure.keys())[0]].items()
                ]
            })


        except Exception as e:
            print(f"Error processing {csv_file.filename}: {e}")

    custom_forms = CustomForm.query.order_by(CustomForm.created_at.desc()).all()
    for form in custom_forms:
        sections = CustomSection.query.filter_by(form_id=form.id).all()
        structured_sections = []

        for section in sections:
            questions = CustomQuestion.query.filter_by(section_id=section.id).all()
            structured_sections.append({
                "section_name": section.title,
                "questions": [
                    {
                        "variable_name": q.variable_name,
                        "question_text": q.label,
                        "type": q.field_type,
                        "choices": q.choices,
                        "required": q.required,
                        "validation_type": q.validation_type,
                        "validation_min": q.validation_min,
                        "validation_max": q.validation_max,
                        "identifier": q.identifier,
                        "branching_logic": q.branching_logic,
                        "field_annotation": q.field_annotation,
                        "dependencies": q.dependencies,
                        "field_note": q.field_note,
                        "custom_alignment": q.custom_alignment,
                        "question_number": q.question_number,
                        "matrix_group_name": q.matrix_group_name,
                        "matrix_ranking": q.matrix_ranking
                    }
                    for q in questions
                ]
            })

        results.append({
            "id": f"custom_{form.id}",
            "source": "custom",
            "filename": form.name,
            "created_at": form.created_at.isoformat(),
            "form_name": form.name,
            "sections": structured_sections
        })

    return jsonify(results)


from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.extensions import db
from backend.dbmodels.form_models import Form, Section, Question
from backend.dbmodels.user import User
from datetime import datetime

@import_bp.route("/api/import-forms", methods=["POST"])
@jwt_required()
def import_forms():
    data = request.get_json()

    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user:
        return jsonify({"error": "User not found"}), 401

    imported_form = Form(
        name=data["name"],
        imported_by=user,  # Nutzer automatisch als Importeur setzen
        created_at=datetime.utcnow()
    )

    for section_data in data["sections"]:
        section = Section(
            title=section_data["title"],
            order=section_data["order"],
            form=imported_form
        )

        for q_data in section_data["questions"]:
            question = Question(
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
                modified_by=user.username,  # setzen
                last_modified=datetime.utcnow(),
                section=section
            )

    db.session.add(imported_form)
    db.session.commit()

    return jsonify({"message": "Imported form created successfully"}), 201
