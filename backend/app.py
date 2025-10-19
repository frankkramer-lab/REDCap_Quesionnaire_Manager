from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager

from backend.config import Config
from backend.extensions import db

# App initialisieren
app = Flask(__name__)
app.config.from_object(Config)
CORS(app,
     resources={r"/api/*": {"origins": "http://localhost:3000"}},
     supports_credentials=True,
     expose_headers=["Authorization"])


# Erweiterungen initialisieren
db.init_app(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)  # JWT-Manager hinzufügen

# Routen importieren und registrieren
from backend.routes.question_routes import questions_bp
app.register_blueprint(questions_bp)

from backend.routes.custom_form_routes import custom_form_bp
app.register_blueprint(custom_form_bp)

from backend.routes.form_builder_routes import form_builder_bp
app.register_blueprint(form_builder_bp)

from backend.routes.import_routes import import_bp
app.register_blueprint(import_bp)

from backend.routes.auth_routes import auth_bp
app.register_blueprint(auth_bp)

from backend.routes.protected_routes import protected_bp
app.register_blueprint(protected_bp)

# Test-Route
@app.route("/api/hello")
def hello():
    return {"message": "Backend mit PostgreSQL verbunden!"}

# Startpunkt
if __name__ == "__main__":
    app.run(debug=True)
