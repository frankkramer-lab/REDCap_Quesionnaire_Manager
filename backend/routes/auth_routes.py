from flask import Blueprint, request, jsonify
from backend.dbmodels.user import User
from backend.extensions import db
from flask_jwt_extended import create_access_token
from datetime import timedelta

auth_bp = Blueprint('auth', __name__)


@auth_bp.route("/api/register", methods=["POST"])
def register():
    data = request.json

    if not data.get("username") or not data.get("email") or not data.get("password"):
        return jsonify({"error": "All fields are required"}), 400

    if User.query.filter((User.email == data["email"]) | (User.username == data["username"])).first():
        return jsonify({"error": "User already exists"}), 409

    user = User(username=data["username"], email=data["email"])
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "User successfully registered"}), 201


@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = request.json
    if not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=data["email"]).first()
    if user and user.check_password(data["password"]):
        token = create_access_token(identity=user.id, expires_delta=timedelta(hours=24))
        return jsonify({"token": token}), 200

    return jsonify({"error": "Invalid login credentials"}), 401
