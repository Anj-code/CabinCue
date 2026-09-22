"""
Pydantic schemas used for request validation and response shaping.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


# ---------- Auth ----------

class StudentRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    registration_number: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=4, max_length=100)

    @field_validator("name", "registration_number", "password")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class FacultyRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    faculty_id: str = Field(..., min_length=2, max_length=50)
    department: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=4, max_length=100)
    building: str = Field(..., min_length=1, max_length=50)
    cabin: str = Field(..., min_length=1, max_length=50)

    @field_validator("name", "faculty_id", "department", "password", "building", "cabin")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class LoginRequest(BaseModel):
    role: str  # "student" or "faculty"
    identifier: str  # registration_number for student, faculty_id for faculty
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    user_id: int


# ---------- Faculty ----------

class FacultyProfileOut(BaseModel):
    user_id: int
    faculty_id: str
    name: str
    department: str
    building: str
    cabin: str
    is_available: bool

    class Config:
        from_attributes = True


class FacultyUpdateLocation(BaseModel):
    building: str = Field(..., min_length=1, max_length=50)
    cabin: str = Field(..., min_length=1, max_length=50)

    @field_validator("building", "cabin")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class AvailabilityUpdate(BaseModel):
    is_available: bool


# ---------- Appointments ----------

class AppointmentCreate(BaseModel):
    faculty_id: int  # user_id of the faculty member
    date: str  # "YYYY-MM-DD"
    time: str  # "HH:MM"
    reason: str = Field(..., min_length=2, max_length=300)

    @field_validator("reason")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Reason cannot be blank")
        return v.strip()

    @field_validator("date")
    @classmethod
    def valid_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Date must be in YYYY-MM-DD format")
        return v

    @field_validator("time")
    @classmethod
    def valid_time(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%H:%M")
        except ValueError:
            raise ValueError("Time must be in HH:MM (24-hour) format")
        return v


class AppointmentReschedule(BaseModel):
    date: str
    time: str

    @field_validator("date")
    @classmethod
    def valid_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Date must be in YYYY-MM-DD format")
        return v

    @field_validator("time")
    @classmethod
    def valid_time(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%H:%M")
        except ValueError:
            raise ValueError("Time must be in HH:MM (24-hour) format")
        return v


class AppointmentOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    faculty_id: int
    faculty_name: str
    department: Optional[str] = None
    building: Optional[str] = None
    cabin: Optional[str] = None
    date: str
    time: str
    reason: str
    status: str
    previous_date: Optional[str] = None
    previous_time: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- Notifications ----------

class NotificationOut(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
