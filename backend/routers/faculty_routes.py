"""
Faculty-only routes:
    - view/update own profile (building, cabin)
    - toggle availability
    - view incoming appointment requests
    - accept / reject / reschedule appointments
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth import require_faculty
from utils import create_notification, appointment_to_out

router = APIRouter(prefix="/api/faculty", tags=["faculty"])


def _get_profile(db: Session, user: models.User) -> models.FacultyProfile:
    profile = (
        db.query(models.FacultyProfile)
        .filter(models.FacultyProfile.user_id == user.id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Faculty profile not found")
    return profile


@router.get("/me", response_model=schemas.FacultyProfileOut)
def get_my_profile(
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    profile = _get_profile(db, current_user)
    return schemas.FacultyProfileOut(
        user_id=current_user.id,
        faculty_id=profile.faculty_id,
        name=current_user.name,
        department=profile.department,
        building=profile.building,
        cabin=profile.cabin,
        is_available=profile.is_available,
    )


@router.put("/location", response_model=schemas.FacultyProfileOut)
def update_location(
    payload: schemas.FacultyUpdateLocation,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    profile = _get_profile(db, current_user)
    profile.building = payload.building
    profile.cabin = payload.cabin
    db.commit()
    db.refresh(profile)
    return schemas.FacultyProfileOut(
        user_id=current_user.id,
        faculty_id=profile.faculty_id,
        name=current_user.name,
        department=profile.department,
        building=profile.building,
        cabin=profile.cabin,
        is_available=profile.is_available,
    )


@router.put("/availability", response_model=schemas.FacultyProfileOut)
def update_availability(
    payload: schemas.AvailabilityUpdate,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    """
    Faculty manually flips this switch. The system never infers availability
    on its own — this is the ONLY way is_available changes.
    """
    profile = _get_profile(db, current_user)
    profile.is_available = payload.is_available
    db.commit()
    db.refresh(profile)
    return schemas.FacultyProfileOut(
        user_id=current_user.id,
        faculty_id=profile.faculty_id,
        name=current_user.name,
        department=profile.department,
        building=profile.building,
        cabin=profile.cabin,
        is_available=profile.is_available,
    )


@router.get("/appointments", response_model=list[schemas.AppointmentOut])
def list_appointments(
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    appts = (
        db.query(models.Appointment)
        .filter(models.Appointment.faculty_id == current_user.id)
        .order_by(models.Appointment.date, models.Appointment.time)
        .all()
    )
    return [appointment_to_out(db, a) for a in appts]


@router.put("/appointments/{appointment_id}/accept", response_model=schemas.AppointmentOut)
def accept_appointment(
    appointment_id: int,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    appt = _get_own_appointment(db, appointment_id, current_user)

    if appt.status not in (models.AppointmentStatus.PENDING,):
        raise HTTPException(
            status_code=400, detail="Only pending appointments can be accepted"
        )

    # Conflict check: faculty should not have two CONFIRMED appointments at
    # the exact same date & time.
    conflict = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.faculty_id == current_user.id,
            models.Appointment.date == appt.date,
            models.Appointment.time == appt.time,
            models.Appointment.status == models.AppointmentStatus.CONFIRMED,
            models.Appointment.id != appt.id,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=409,
            detail="You already have a confirmed appointment at this exact date and time",
        )

    appt.status = models.AppointmentStatus.CONFIRMED
    create_notification(
        db,
        appt.student_id,
        f"Your appointment with {current_user.name} on {appt.date} at {appt.time} was confirmed.",
    )
    db.commit()
    db.refresh(appt)
    return appointment_to_out(db, appt)


@router.put("/appointments/{appointment_id}/reject", response_model=schemas.AppointmentOut)
def reject_appointment(
    appointment_id: int,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    appt = _get_own_appointment(db, appointment_id, current_user)

    if appt.status not in (models.AppointmentStatus.PENDING, models.AppointmentStatus.CONFIRMED, models.AppointmentStatus.RESCHEDULED):
        raise HTTPException(status_code=400, detail="This appointment cannot be rejected")

    appt.status = models.AppointmentStatus.REJECTED
    create_notification(
        db,
        appt.student_id,
        f"Your appointment with {current_user.name} on {appt.date} at {appt.time} was rejected.",
    )
    db.commit()
    db.refresh(appt)
    return appointment_to_out(db, appt)


@router.put("/appointments/{appointment_id}/reschedule", response_model=schemas.AppointmentOut)
def reschedule_appointment(
    appointment_id: int,
    payload: schemas.AppointmentReschedule,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    appt = _get_own_appointment(db, appointment_id, current_user)

    if appt.status not in (models.AppointmentStatus.CONFIRMED, models.AppointmentStatus.PENDING, models.AppointmentStatus.RESCHEDULED):
        raise HTTPException(status_code=400, detail="This appointment cannot be rescheduled")

    new_dt = datetime.strptime(f"{payload.date} {payload.time}", "%Y-%m-%d %H:%M")
    if new_dt < datetime.now():
        raise HTTPException(status_code=400, detail="Cannot reschedule to a time in the past")

    conflict = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.faculty_id == current_user.id,
            models.Appointment.date == payload.date,
            models.Appointment.time == payload.time,
            models.Appointment.status == models.AppointmentStatus.CONFIRMED,
            models.Appointment.id != appt.id,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=409,
            detail="You already have a confirmed appointment at this exact date and time",
        )

    old_date, old_time = appt.date, appt.time
    appt.previous_date = old_date
    appt.previous_time = old_time
    appt.date = payload.date
    appt.time = payload.time
    appt.status = models.AppointmentStatus.RESCHEDULED

    create_notification(
        db,
        appt.student_id,
        f"Your appointment with {current_user.name} was rescheduled from "
        f"{old_date} {old_time} to {payload.date} {payload.time}.",
    )
    db.commit()
    db.refresh(appt)
    return appointment_to_out(db, appt)


def _get_own_appointment(db: Session, appointment_id: int, faculty_user: models.User) -> models.Appointment:
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.faculty_id != faculty_user.id:
        raise HTTPException(status_code=403, detail="You can only manage your own appointments")
    return appt
