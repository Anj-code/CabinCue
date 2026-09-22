# FacultyConnect

A focused web application that lets faculty broadcast their real-time
walk-in availability and current cabin location, and lets students book
appointments when an immediate visit isn't possible.

live at - https://cabincue.onrender.com

---

## 1. Project Overview

FacultyConnect is a small campus utility, built for a college where two
academic buildings sit roughly 1 km apart, about a 7-minute walk from the
hostels. It removes the guesswork of walking across campus (or calling
repeatedly) to find out whether a faculty member is around.

- Faculty flip a single **AVAILABLE / NOT AVAILABLE** switch and keep their
  building/cabin up to date.
- Students search for a faculty member and instantly see both.
- If a walk-in isn't possible, students request an appointment; faculty can
  accept, reject, or reschedule it.

## 2. Problem Statement

Students routinely waste time walking to a faculty cabin only to find the
professor isn't there, or calling repeatedly just to ask "are you in your
cabin?" Faculty, in turn, get interrupted by students showing up when they
specifically need uninterrupted time. FacultyConnect gives both sides a
single, always-current source of truth — without automating away the
faculty member's judgment about when they're actually free.

## 3. Features

**Faculty**
- Register with name, Faculty ID, department, password, building, cabin
- Large, obvious 🟢 AVAILABLE / 🔴 NOT AVAILABLE toggle — controlled
  manually, never inferred from schedules or logins
- Edit building/cabin at any time
- View, accept, reject, and reschedule appointment requests
- In-app notifications (e.g. "New appointment request from …")

**Student**
- Register with name, registration number, password
- Search faculty by name and see live availability + cabin location
- Request an appointment (date, time, reason) when a walk-in won't work
- Track appointment status: PENDING → CONFIRMED / REJECTED / RESCHEDULED
- In-app notifications when a faculty member responds

**Shared**
- Role-based access control (students and faculty only see/manage their
  own data)
- Server-side validation: no duplicate registration numbers / Faculty IDs,
  no past-dated appointments, no double-booked confirmed slots
- Clean, modern, responsive UI with clear status badges

## 4. Technology Stack

| Layer          | Technology                                  |
|----------------|----------------------------------------------|
| Backend        | Python 3, FastAPI, Uvicorn                   |
| Database ORM   | SQLAlchemy                                   |
| Database       | SQLite (single local file, zero setup)       |
| Auth           | JWT (python-jose) + bcrypt password hashing  |
| Frontend       | Plain HTML5, CSS3, vanilla JavaScript (no build step, no framework) |

No external services, cloud databases, or paid APIs are used. Everything
runs entirely on your machine.

## 5. Architecture

```
Browser (HTML/CSS/JS)
        │  fetch() calls with a JWT bearer token
        ▼
FastAPI app (backend/main.py)
  ├── /api/auth/*           registration & login
  ├── /api/faculty/*        profile, availability, location, appointment actions
  ├── /api/students/*       faculty search, appointment requests
  ├── /api/notifications/*  in-app notifications
  └── static file serving   the entire frontend/ folder
        │
        ▼
SQLAlchemy ORM ──► SQLite (backend/facultyconnect.db, created automatically)
```

The same FastAPI process serves both the REST API and the static frontend
files, so there's only one server to run.

## 6. Database Structure

| Table              | Purpose                                                        |
|---------------------|-----------------------------------------------------------------|
| `users`             | Shared login identity: id, role, name, password_hash            |
| `student_profiles`  | user_id, registration_number (unique)                           |
| `faculty_profiles`  | user_id, faculty_id (unique), department, building, cabin, is_available |
| `appointments`      | student_id, faculty_id, date, time, reason, status, previous_date/time (for reschedules), timestamps |
| `notifications`     | user_id, message, is_read, created_at                           |

`status` is one of `PENDING`, `CONFIRMED`, `REJECTED`, `RESCHEDULED`.

The database file is created automatically on first run — no manual setup
required.

## 7. How to Install

**Requirements:** Python 3.10+ and pip.

```bash
# 1. Unzip the project and move into it
cd FacultyConnect

# 2. (Recommended) create a virtual environment
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# 3. Install backend dependencies
pip install -r requirements.txt
```

## 8. How to Run

```bash
cd backend

# Optional but recommended: create demo accounts (see section 9)
python seed.py

# Start the server
uvicorn main:app --reload
```

Then open **http://127.0.0.1:8000** in your browser. The FastAPI backend
serves the frontend directly, so there is nothing else to start.

Interactive API docs (Swagger UI) are available at
**http://127.0.0.1:8000/docs** if you want to inspect or test the API
directly.

To stop the server, press `Ctrl+C`. Your data persists in
`backend/facultyconnect.db` between runs — delete that file if you want a
completely fresh database.

## 9. Demo Credentials

Running `python seed.py` (from inside `backend/`) creates these accounts.
They are demo data only — you can also register brand-new accounts from
the sign-up page at any time; the seed data does not limit who can use the
app.

**Faculty**

| Name              | Faculty ID | Department                  | Building | Cabin | Password | Starting availability |
|-------------------|------------|------------------------------|----------|-------|----------|------------------------|
| Dr. Rajesh Kumar  | FAC001     | Computer Science & Engineering | AB-2   | 214   | demo123  | 🟢 Available |
| Dr. Sunita Rao    | FAC002     | Electronics & Communication   | AB-1   | 108   | demo123  | 🔴 Not available |

**Students**

| Name          | Registration Number | Password |
|---------------|----------------------|----------|
| Anjali Verma  | 23BCS001             | demo123  |
| Rohan Mehta   | 23BCS002             | demo123  |

## 10. Example Workflow

1. Log in as **Anjali Verma** (student) and search "Rajesh". You'll see
   Dr. Kumar is 🟢 AVAILABLE in AB-2, Cabin 214 — no appointment needed,
   she can just walk over.
2. Log in as **Dr. Sunita Rao** (faculty, currently 🔴 NOT AVAILABLE). As
   a student, requesting to meet her instead requires an appointment:
   search "Sunita", click **Request Appointment**, pick a date/time and a
   reason, and submit.
3. Log in as **Dr. Sunita Rao** and open **Appointment Requests** — accept,
   reject, or leave it pending.
4. Log back in as the student to see the updated status, or open the 🔔
   notification bell for a summary.
5. As Dr. Rao, use **Reschedule** on a confirmed appointment to move it —
   the student's dashboard will show both the old and new time.
6. Try the availability toggle: switch Dr. Kumar to 🔴 NOT AVAILABLE and
   search again as a student — the cabin location still shows, but the
   badge updates immediately.

## 11. Future Improvements

These were intentionally left out of this MVP to keep it focused and
fast to ship, but would be natural next steps:

- Push/email notifications instead of in-app only
- A lightweight admin view for managing faculty/department lists
- Recurring "office hours" that pre-fill availability (while still
  letting faculty manually override it)
- Appointment reminders shortly before the scheduled time
- Search filters by department/building

---

## Project Structure

```
FacultyConnect/
├── backend/
│   ├── main.py              # FastAPI app entry point + static file serving
│   ├── database.py          # SQLite/SQLAlchemy setup
│   ├── models.py            # ORM models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── auth.py              # Password hashing, JWT, role dependencies
│   ├── utils.py             # Shared helpers (notifications, serialization)
│   ├── seed.py               # Demo data seed script
│   └── routers/
│       ├── auth_routes.py
│       ├── faculty_routes.py
│       ├── student_routes.py
│       └── notification_routes.py
├── frontend/
│   ├── index.html            # Landing page
│   ├── login.html
│   ├── register.html
│   ├── student-dashboard.html
│   ├── faculty-dashboard.html
│   ├── css/style.css
│   └── js/
│       ├── api.js            # fetch wrapper + shared UI helpers
│       ├── notifications.js  # notification bell widget
│       ├── login.js
│       ├── register.js
│       ├── student-dashboard.js
│       └── faculty-dashboard.js
├── requirements.txt
├── .gitignore
└── README.md
```

No placeholder or "TODO" logic is included — every endpoint and every
button in the UI is fully wired and functional.
