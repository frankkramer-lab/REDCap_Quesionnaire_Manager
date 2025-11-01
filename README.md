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
![Dashboard](https://github.com/frankkramer-lab/REDCap_Quesionnaire_Manager/blob/main/frontend/src/assets/Screenshot%202025-10-13%20185814.png)

**Description:**  
The main entry point of the application.  
Users can navigate between modules, view imported forms, and access profile or questionnaire creation options.

---

### 🔹 Questionnaire Editor
![Questionnaire Editor](https://github.com/frankkramer-lab/REDCap_Quesionnaire_Manager/blob/main/frontend/src/assets/Screenshot%202025-09-19%20160603.png)

**Description:**  
Interface for editing and validating individual questions.  
Users can modify question text, choices, validation rules, and branching logic in real time with input validation.

---

### 🔹 Version History
![Version History](https://github.com/frankkramer-lab/REDCap_Quesionnaire_Manager/blob/main/frontend/src/assets/Screenshot%202025-09-19%20165612.png)

**Description:**  
Displays all available versions of a question or form.  
Users can track changes, compare versions, and revert to previous states while maintaining full provenance metadata.

---

### 🔹 Question Composer
![Question Composer](https://github.com/frankkramer-lab/REDCap_Quesionnaire_Manager/blob/main/frontend/src/assets/Screenshot%202025-09-19%20140220.png)

**Description:**  
Drag-and-drop interface for assembling new questionnaires from existing validated questions and sections.  
Facilitates reuse, consistency, and structured form design.

---

### 🔹 Unified Form View 1/2
![Unified Form View 1](https://github.com/frankkramer-lab/REDCap_Quesionnaire_Manager/blob/main/frontend/src/assets/Screenshot%202025-09-19%20140512.png)

**Description:**  
Displays all imported and custom questionnaires together in a unified view.  
Users can browse, filter, and inspect forms along with their sections and questions.

---

### 🔹 Unified Form View 2/2
![Unified Form View 2](https://github.com/frankkramer-lab/REDCap_Quesionnaire_Manager/blob/main/frontend/src/assets/Screenshot%202025-09-19%20134546.png)

**Description:**  
Extended hierarchical view showing the modular structure of forms, sections, and questions.  
Supports visual grouping and quick navigation through complex questionnaires.

---

### 🔹 Profile Page
![Profile Page](https://github.com/frankkramer-lab/REDCap_Quesionnaire_Manager/blob/main/frontend/src/assets/Screenshot%202025-09-17%20204212.png)

**Description:**  
User profile management area.  
Allows editing account details.

---

**Note:**  
All screenshots were taken from the local development environment using the default layout and styling.  
Displayed data are synthetic and used for demonstration purposes only.


---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | React (Create React App via `npx create-react-app`) |
| **Backend** | Flask (Python) |
| **Database** | PostgreSQL |
| **Authentication** | JWT (JSON Web Token) |
| **Styling** | CSS / Tailwind |

# Installation Guide

## 1. Requirements

Before installation, ensure the following software is installed:

| Component | Recommended Version |
|------------|--------------------|
| Python | 3.10+ |
| Node.js & npm | Node 18+ (includes npm) |
| PostgreSQL | 14+ |
| Git | latest |
| (Optional) PyCharm | 2023+ (Community or Professional) |

Check versions:

```bash
python --version
node --version
npm --version
psql --version
git --version
```

> On macOS/Linux, use `python3` instead of `python`.

---

## 2. Repository Structure

```
.
├─ backend/               # Flask REST API
│  ├─ requirements.txt
│  ├─ alembic.ini
│  └─ src/...             # Flask app (e.g., app/__init__.py)
├─ frontend/              # React (Create React App via npx)
│  ├─ package.json
│  └─ src/...
└─ README.md
```

> Adjust paths as needed for your project.

---

## 3. Database Setup (PostgreSQL)

Create a dedicated database and user:

```sql
CREATE USER app_user WITH PASSWORD 'change_me';
CREATE DATABASE app_db OWNER app_user;
GRANT ALL PRIVILEGES ON DATABASE app_db TO app_user;
```

Keep these credentials for your backend `.env` configuration.

---

## 4. Backend Setup (Flask)

### 4.1 Create a Virtual Environment and Install Dependencies

```bash
cd backend
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
. .\.venv\Scripts\Activate.ps1
# Windows (cmd):
.\.venv\Scripts\activate.bat
# macOS/Linux:
source .venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

---

### 4.2 Configure Environment Variables

Create a `.env` file in `backend/`:

```ini
# Flask
FLASK_APP=src.app:app
FLASK_ENV=development

# Security
JWT_SECRET=change_this_secret

# Database (PostgreSQL)
DATABASE_URL=postgresql+psycopg://app_user:change_me@localhost:5432/app_db

# CORS (React uses port 3000)
CORS_ORIGINS=http://localhost:3000
```

> Ensure `FLASK_APP` matches your Flask app import path (e.g., `src.app:app` or `app:app`).

---

### 4.3 Initialize the Database (Alembic)

```bash
alembic upgrade head
```

> If Alembic is not set up yet, initialize it first:
>
> ```bash
> alembic init alembic
> ```
>
> Configure it to match your SQLAlchemy models, generate a migration:
>
> ```bash
> alembic revision --autogenerate -m "init"
> ```
>
> and apply it:
>
> ```bash
> alembic upgrade head
> ```

---

### 4.4 Start the Flask Server

```bash
flask run --host=0.0.0.0 --port=8000
```

The API will be available at:  
**http://localhost:8000**

---

## 5. Frontend Setup (React)

### 5.1 Install Dependencies

```bash
cd frontend
npm install
```

---

### 5.2 Configure Environment Variables

Create a `.env` file in `frontend/`:

```ini
REACT_APP_API_BASE_URL=http://localhost:8000
```

Your frontend reads this as `process.env.REACT_APP_API_BASE_URL`.

---

### 5.3 Start the Development Server

```bash
npm start
```

The frontend will be available at:  
**http://localhost:3000**

---

## 6. First Run Checklist

1. PostgreSQL is running and `app_db` exists.  
2. Flask backend is running on `http://localhost:8000`.  
3. React frontend is running on `http://localhost:3000`.  
4. Register a new user via the UI or API (`POST /api/register`).  
5. Log in (`POST /api/login`).  
6. Import a REDCap CSV or create a new questionnaire in the web interface.

---

## 7. PyCharm Configuration (Optional)

### Flask (Backend)
- **Run → Edit Configurations → Add New → Flask Server**
  - `FLASK_APP`: `src.app:app`
  - `FLASK_ENV`: `development`
  - Environment variables: use `.env`
  - Host: `0.0.0.0`
  - Port: `8000`
- Interpreter: select project’s `.venv`.

### npm (Frontend)
- **Run → Edit Configurations → Add New → npm**
  - `package.json`: `frontend/package.json`
  - Command: `start`

---

## 8. Docker Setup (Optional)

Create `docker-compose.yml` in your project root:

```yaml
version: "3.9"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: change_me
      POSTGRES_DB: app_db
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app_user -d app_db"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build: ./backend
    env_file: ./backend/.env
    depends_on:
      - db
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    environment:
      - REACT_APP_API_BASE_URL=http://localhost:8000
    ports:
      - "3000:3000"
```

For production:
- Use Gunicorn or uWSGI for Flask.
- Build frontend (`npm run build`) and serve it with Nginx.
- Restrict CORS and use HTTPS via a reverse proxy.

---

## 9. Troubleshooting

| Problem | Possible Fix |
|----------|---------------|
| **Port already in use** | Change ports or stop conflicting process (3000 or 8000). |
| **CORS error** | Ensure `CORS_ORIGINS` matches frontend URL. |
| **Database connection fails** | Verify Postgres is running and `DATABASE_URL` credentials. |
| **Migrations missing tables** | Run `alembic upgrade head`. |
| **Frontend cannot reach API** | Confirm `REACT_APP_API_BASE_URL` is correct. |

---

## 10. Security Notes

- Never commit `.env` or secrets to version control.  
- Use a strong `JWT_SECRET` and secure database passwords.  
- Set `FLASK_ENV=production` for deployment.  
- Limit `CORS_ORIGINS` to trusted domains.  
- Always use HTTPS in production.

---

**End of Installation Guide**


Flask backend uses Blueprints for modularity (auth, import, questions, forms).

Alembic handles database migrations.

All sensitive values (JWT secrets, DB credentials) should be stored in .env.
