from flask import Blueprint, request, jsonify
from backend.dbmodels.user import User
from backend.extensions import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash

protected_bp = Blueprint('protected', __name__)


@protected_bp.route("/api/user/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    return jsonify({
        "user_id": user.id,
        "username": user.username,
        "email": user.email
    })


@protected_bp.route("/api/user/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    data = request.json

    if data.get("email") and data["email"] != user.email:
        if User.query.filter_by(email=data["email"]).first():
            return jsonify({"error": "Email is already in use"}), 409

    user.username = data.get("username", user.username)
    user.email = data.get("email", user.email)
    db.session.commit()
    return jsonify({"message": "Profile updated successfully"}), 200


@protected_bp.route("/api/user/password", methods=["PUT"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    data = request.json

    if not check_password_hash(user.password_hash, data["currentPassword"]):
        return jsonify({"error": "Current password is incorrect"}), 403

    user.password_hash = generate_password_hash(data["newPassword"])
    db.session.commit()
    return jsonify({"message": "Password changed successfully"}), 200


@protected_bp.route("/api/user", methods=["DELETE"])
@jwt_required()
def delete_account():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Account deleted successfully"}), 200
