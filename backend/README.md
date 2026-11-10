# VOICEGUARD - Backend REST API (Phase 5)

Lightweight Python Flask REST API for emergency SOS alert ingestion, alert persistence, health checks, and contact validation.

## Prerequisites
- Python 3.10+
- Dependencies listed in `requirements.txt` (`flask>=3.0.0`, `flask-cors>=4.0.0`)

## Quickstart

### 1. Using the Virtual Environment (Recommended)
```bash
# From the project root (VOICEGUARD/)
.\.venv\Scripts\python.exe backend/app.py
```

### 2. Using the Python Launcher (`py`) or `python`
```bash
py backend/app.py
# or
python backend/app.py
```

## Running Unit Tests
```bash
.\.venv\Scripts\python.exe backend/test_api.py
# or
py backend/test_api.py
```

## REST Endpoints
- `GET  /api/health` - Check backend availability and alert count
- `POST /api/alerts` - Record emergency SOS alert
- `GET  /api/alerts` - List recorded emergency alerts
- `POST /api/contacts/validate` - Validate contact input fields
