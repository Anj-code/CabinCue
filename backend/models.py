"""
SQLAlchemy ORM models for FacultyConnect.

Entities:
    User             - shared login identity for both students and faculty
    StudentProfile    - student-specific data (registration number)
    FacultyProfile     - faculty-specific data (dept, building, cabin, availability)
    Appointment        - appointment requests between a student and a faculty member
    Notification       - simple in-app notifications for both roles
"""

import enum
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    DateTime,
    Enum,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class RoleEnum(str, enum.Enum):
    student = "student"
    faculty = "faculty"


class AppointmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    RESCHEDULED = "RESCHEDULED"
    CANCELLED = "CANCELLED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(Enum(RoleEnum), nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    student_profile = relationship(
        "StudentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    faculty_profile = relationship(
        "FacultyProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    notifications = relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    registration_number = Column(String, unique=True, index=True, nullable=False)

    user = relationship("User", back_populates="student_profile")


class FacultyProfile(Base):
    __tablename__ = "faculty_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    faculty_id = Column(String, unique=True, index=True, nullable=False)
    department = Column(String, nullable=False)
    building = Column(String, nullable=False)
    cabin = Column(String, nullable=False)
    is_available = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="faculty_profile")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    date = Column(String, nullable=False)  # stored as "YYYY-MM-DD"
    time = Column(String, nullable=False)  # stored as "HH:MM" (24h)
    reason = Column(String, nullable=False)

    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.PENDING, nullable=False)

    # populated only when a reschedule happens, so the student can see what changed
    previous_date = Column(String, nullable=True)
    previous_time = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("User", foreign_keys=[student_id])
    faculty = relationship("User", foreign_keys=[faculty_id])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
