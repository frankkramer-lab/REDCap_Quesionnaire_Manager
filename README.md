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
