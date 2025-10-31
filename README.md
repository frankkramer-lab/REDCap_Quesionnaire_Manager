# REDCap_Manager
A web application for structured management, version control, and reuse of REDCap-compatible electronic case report forms (eCRFs). Built with Flask, React, and PostgreSQL, the system enables validated editing, semantic consistency, and transparent provenance tracking of questionnaires while preserving full REDCap CSV compatibility.


## Features

- Import of REDCap CSV Data Dictionaries  
- Normalized relational schema (`Form → Section → Question`)  
- Versioning and provenance tracking for questions  
- Questionnaire composition using existing forms and sections  
- REDCap-compatible CSV export  
- JWT-based authentication and user profiles

## Screenshots

### 🔹 Dashboard

<img width="1397" height="630" alt="Screenshot 2025-10-13 185814" src="https://github.com/user-attachments/assets/868b537f-9c42-446d-9783-6910a9bc17d2" />

### 🔹 Questionnaire Editor

<img width="676" height="971" alt="Screenshot 2025-09-19 160548" src="https://github.com/user-attachments/assets/cd1aa304-2263-49c2-a152-cd5ab289ffe2" />

### 🔹 Version History

<img width="869" height="890" alt="Screenshot 2025-09-19 164320" src="https://github.com/user-attachments/assets/ec981b93-5ad7-4978-bf8f-a83e285f51fe" />

### 🔹 Question Composer

<img width="948" height="910" alt="Screenshot 2025-09-19 140220" src="https://github.com/user-attachments/assets/04f9e75d-3f6e-4f7c-b704-45a9aa2a9438" />

### 🔹 Unified Form View 1/2

<img width="950" height="696" alt="Screenshot 2025-09-19 140512" src="https://github.com/user-attachments/assets/104af83f-f62b-4997-8a16-a45bdac8d679" />

### 🔹 Unified Form View 2/2

<img width="948" height="993" alt="Screenshot 2025-09-19 134516" src="https://github.com/user-attachments/assets/82abd55c-cf12-4226-9b9d-e8fb0827a7a0" />

### 🔹 Profile Page

<img width="1285" height="946" alt="Screenshot 2025-09-17 204212" src="https://github.com/user-attachments/assets/93f0b0ca-b936-4277-bf30-d35da43c59ac" />


## Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | React (Create React App via `npx create-react-app`) |
| **Backend** | Flask (Python) |
| **Database** | PostgreSQL |
| **Authentication** | JWT (JSON Web Token) |
| **Styling** | CSS / Tailwind |

## Prerequisites

Before installation, ensure the following software is installed:

Component	Minimum Version
Python	3.10
Node.js / npm	18+
PostgreSQL	14+
Git	latest#

## Installation

Clone the repository:

git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>


The repository is structured as:

.
├── backend/        # Flask REST API
├── frontend/       # React frontend
└── README.md

### 🔹 1. Backend Setup (Flask)

Navigate into the backend folder and create a virtual environment:

cd backend
python3 -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate


Install dependencies:

pip install -r requirements.txt


Create a .env file in the backend directory:

FLASK_APP=backend.app:app
FLASK_ENV=development
JWT_SECRET=change_this_secret
DATABASE_URL=postgresql+psycopg://app_user:password@localhost:5432/app_db
CORS_ORIGINS=http://localhost:5173


Initialize the database:

alembic upgrade head


Start the backend server:

flask run --host=0.0.0.0 --port=8000


The API will be available at:
http://localhost:8000

### 🔹 2. Frontend Setup (React)

In a new terminal:

cd frontend
npm install


Create a .env file:

VITE_API_BASE_URL=http://localhost:8000


Start the development server:

npm run dev


The frontend runs at:
http://localhost:5173

## Database Setup (PostgreSQL)

In PostgreSQL (psql or pgAdmin):

CREATE USER app_user WITH PASSWORD 'password';
CREATE DATABASE app_db OWNER app_user;
GRANT ALL PRIVILEGES ON DATABASE app_db TO app_user;

## Authentication

Users can register and log in via the web interface or API endpoints:

POST /api/register
POST /api/login


JWT tokens are issued upon login and attached to all subsequent requests in the Authorization header:

Authorization: Bearer <token>

## API Overview (selected)
Endpoint	Method	Description
/api/import-csv	POST	Import REDCap data dictionary
/api/all-forms	GET	List all forms
/api/questions/all	GET	Retrieve all questions
/api/custom-forms	POST	Create custom form
/api/export-csv/:id	GET	Export REDCap-compatible CSV

## Development Tips

React frontend hot-reloads automatically on file changes.

Flask backend uses Blueprints for modularity (auth, import, questions, forms).

Alembic handles database migrations.

All sensitive values (JWT secrets, DB credentials) should be stored in .env.
