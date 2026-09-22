"""
Small shared helpers used across routers.
"""

from sqlalchemy.orm import Session

import models
import schemas


def create_notification(db: Session, user_id: int, message: str) -> None:
    notification = models.Notification(user_id=user_id, message=message)
    db.add(notification)


def appointment_to_out(db: Session, appt: models.Appointment) -> schemas.AppointmentOut:
    student = db.query(models.User).filter(models.User.id == appt.student_id).first()
    faculty = db.query(models.User).filter(models.User.id == appt.faculty_id).first()
    faculty_profile = (
        db.query(models.FacultyProfile)
        .filter(models.FacultyProfile.user_id == appt.faculty_id)
        .first()
    )

    return schemas.AppointmentOut(
        id=appt.id,
        student_id=appt.student_id,
        student_name=student.name if student else "Unknown",
        faculty_id=appt.faculty_id,
        faculty_name=faculty.name if faculty else "Unknown",
        department=faculty_profile.department if faculty_profile else None,
        building=faculty_profile.building if faculty_profile else None,
        cabin=faculty_profile.cabin if faculty_profile else None,
        date=appt.date,
        time=appt.time,
        reason=appt.reason,
        status=appt.status.value,
        previous_date=appt.previous_date,
        previous_time=appt.previous_time,
        created_at=appt.created_at,
        updated_at=appt.updated_at,
    )
