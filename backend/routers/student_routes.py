"""
Student-only routes:
    - search for faculty members
    - view own appointments
    - request a new appointment
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth import require_student
from utils import create_notification, appointment_to_out

router = APIRouter(prefix="/api/students", tags=["students"])


@router.get("/search", response_model=list[schemas.FacultyProfileOut])
def search_faculty(
    name: Optional[str] = Query(default=None, description="Faculty name to search for"),
    current_user: models.User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """
    Searches faculty by (partial, case-insensitive) name. If no name is
    given, returns all faculty members so students can browse.
    """
    query = db.query(models.FacultyProfile).join(models.User, models.FacultyProfile.user_id == models.User.id)

    if name and name.strip():
        query = query.filter(models.User.name.ilike(f"%{name.strip()}%"))

    profiles = query.all()

    results = []
    for profile in profiles:
        results.append(
            schemas.FacultyProfileOut(
                user_id=profile.user_id,
                faculty_id=profile.faculty_id,
                name=profile.user.name,
                department=profile.department,
                building=profile.building,
                cabin=profile.cabin,
                is_available=profile.is_available,
            )
        )
    return results


@router.get("/me/appointments", response_model=list[schemas.AppointmentOut])
def my_appointments(
    current_user: models.User = Depends(require_student),
    db: Session = Depends(get_db),
):
    appts = (
        db.query(models.Appointment)
        .filter(models.Appointment.student_id == current_user.id)
        .order_by(models.Appointment.date, models.Appointment.time)
        .all()
    )
    return [appointment_to_out(db, a) for a in appts]


@router.post("/appointments", response_model=schemas.AppointmentOut, status_code=201)
def create_appointment(
    payload: schemas.AppointmentCreate,
    current_user: models.User = Depends(require_student),
    db: Session = Depends(get_db),
):
    faculty_profile = (
        db.query(models.FacultyProfile)
        .filter(models.FacultyProfile.user_id == payload.faculty_id)
        .first()
    )
    if not faculty_profile:
        raise HTTPException(status_code=404, detail="Faculty member not found")

    # Cannot request an appointment in the past
    requested_dt = datetime.strptime(f"{payload.date} {payload.time}", "%Y-%m-%d %H:%M")
    if requested_dt < datetime.now():
        raise HTTPException(status_code=400, detail="Cannot request an appointment in the past")

    # Faculty should not have conflicting CONFIRMED appointments at the exact same time
    conflict = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.faculty_id == payload.faculty_id,
            models.Appointment.date == payload.date,
            models.Appointment.time == payload.time,
            models.Appointment.status == models.AppointmentStatus.CONFIRMED,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=409,
            detail="This faculty member already has a confirmed appointment at that exact time. Please choose another time.",
        )

    appt = models.Appointment(
        student_id=current_user.id,
        faculty_id=payload.faculty_id,
        date=payload.date,
        time=payload.time,
        reason=payload.reason,
        status=models.AppointmentStatus.PENDING,
    )
    db.add(appt)
    db.flush()

    create_notification(
        db,
        payload.faculty_id,
        f"New appointment request from {current_user.name} for {payload.date} at {payload.time}.",
    )

    db.commit()
    db.refresh(appt)
    return appointment_to_out(db, appt)
