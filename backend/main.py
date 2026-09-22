"""
FacultyConnect - FastAPI application entry point.

Run with:
    uvicorn main:app --reload

Serves:
    - REST API under /api/*
    - The static frontend (HTML/CSS/JS) at /
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import Base, engine
import models  # noqa: F401  (needed so tables are registered on Base before create_all)
from routers import auth_routes, faculty_routes, student_routes, notification_routes

# Create all tables if they don't already exist.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FacultyConnect API",
    description="Faculty availability + appointment booking system for college campuses.",
    version="1.0.0",
)

# Permissive CORS since this is a local MVP served from the same origin
# as the frontend anyway; kept simple for local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(faculty_routes.router)
app.include_router(student_routes.router)
app.include_router(notification_routes.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# ---------- Serve the frontend ----------

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BACKEND_DIR), "frontend")

if os.path.isdir(FRONTEND_DIR):
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/{page_name}.html")
    def serve_page(page_name: str):
        file_path = os.path.join(FRONTEND_DIR, f"{page_name}.html")
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
