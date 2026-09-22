"""
Authentication routes: registration and login for students and faculty.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register/student", response_model=schemas.TokenResponse, status_code=201)
def register_student(payload: schemas.StudentRegister, db: Session = Depends(get_db)):
    existing = (
        db.query(models.StudentProfile)
        .filter(models.StudentProfile.registration_number == payload.registration_number)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A student with this registration number already exists",
        )

    user = models.User(
        role=models.RoleEnum.student,
        name=payload.name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()  # get user.id before commit

    profile = models.StudentProfile(
        user_id=user.id,
        registration_number=payload.registration_number,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.role.value)
    return schemas.TokenResponse(
        access_token=token, role=user.role.value, name=user.name, user_id=user.id
    )


@router.post("/register/faculty", response_model=schemas.TokenResponse, status_code=201)
def register_faculty(payload: schemas.FacultyRegister, db: Session = Depends(get_db)):
    existing = (
        db.query(models.FacultyProfile)
        .filter(models.FacultyProfile.faculty_id == payload.faculty_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A faculty member with this Faculty ID already exists",
        )

    user = models.User(
        role=models.RoleEnum.faculty,
        name=payload.name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()

    profile = models.FacultyProfile(
        user_id=user.id,
        faculty_id=payload.faculty_id,
        department=payload.department,
        building=payload.building,
        cabin=payload.cabin,
        is_available=False,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.role.value)
    return schemas.TokenResponse(
        access_token=token, role=user.role.value, name=user.name, user_id=user.id
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    role = payload.role.strip().lower()

    if role == "student":
        profile = (
            db.query(models.StudentProfile)
            .filter(models.StudentProfile.registration_number == payload.identifier.strip())
            .first()
        )
        user = profile.user if profile else None
    elif role == "faculty":
        profile = (
            db.query(models.FacultyProfile)
            .filter(models.FacultyProfile.faculty_id == payload.identifier.strip())
            .first()
        )
        user = profile.user if profile else None
    else:
        raise HTTPException(status_code=400, detail="Role must be 'student' or 'faculty'")

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_access_token(user.id, user.role.value)
    return schemas.TokenResponse(
        access_token=token, role=user.role.value, name=user.name, user_id=user.id
    )


@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "user_id": current_user.id,
        "name": current_user.name,
        "role": current_user.role.value,
    }
