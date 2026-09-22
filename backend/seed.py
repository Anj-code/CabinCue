"""
Seed script that creates demo accounts so the app can be explored
immediately without manual registration.

Run with:
    python seed.py

Safe to re-run: it skips creating records that already exist.
"""

from database import Base, engine, SessionLocal
import models
from auth import hash_password

Base.metadata.create_all(bind=engine)

DEMO_STUDENTS = [
    {"name": "Anjali Verma", "registration_number": "23BCS001", "password": "demo123"},
    {"name": "Rohan Mehta", "registration_number": "23BCS002", "password": "demo123"},
]

DEMO_FACULTY = [
    {
        "name": "Dr. Rajesh Kumar",
        "faculty_id": "FAC001",
        "department": "Computer Science & Engineering",
        "building": "AB-2",
        "cabin": "214",
        "password": "demo123",
        "is_available": True,
    },
    {
        "name": "Dr. Sunita Rao",
        "faculty_id": "FAC002",
        "department": "Electronics & Communication",
        "building": "AB-1",
        "cabin": "108",
        "password": "demo123",
        "is_available": False,
    },
]


def seed():
    db = SessionLocal()
    try:
        created = {"students": 0, "faculty": 0}

        for s in DEMO_STUDENTS:
            existing = (
                db.query(models.StudentProfile)
                .filter(models.StudentProfile.registration_number == s["registration_number"])
                .first()
            )
            if existing:
                continue
            user = models.User(
                role=models.RoleEnum.student,
                name=s["name"],
                password_hash=hash_password(s["password"]),
            )
            db.add(user)
            db.flush()
            db.add(
                models.StudentProfile(
                    user_id=user.id, registration_number=s["registration_number"]
                )
            )
            created["students"] += 1

        for f in DEMO_FACULTY:
            existing = (
                db.query(models.FacultyProfile)
                .filter(models.FacultyProfile.faculty_id == f["faculty_id"])
                .first()
            )
            if existing:
                continue
            user = models.User(
                role=models.RoleEnum.faculty,
                name=f["name"],
                password_hash=hash_password(f["password"]),
            )
            db.add(user)
            db.flush()
            db.add(
                models.FacultyProfile(
                    user_id=user.id,
                    faculty_id=f["faculty_id"],
                    department=f["department"],
                    building=f["building"],
                    cabin=f["cabin"],
                    is_available=f["is_available"],
                )
            )
            created["faculty"] += 1

        db.commit()
        print(f"Seed complete. Created {created['students']} student(s) and {created['faculty']} faculty member(s).")
        print("(Existing accounts with matching IDs were left untouched.)")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
