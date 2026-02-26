# Gap Detector Memory

## Project: Auto Upload System
- Backend: FastAPI (Python) at `backend/`
- Frontend: React + React Flow at `frontend/`
- Architecture: Module-level functions preferred over classes in Python services

## Completed Analyses

### gemini-video-pipeline (2026-02-26)
- **Match Rate**: 95% (PASS)
- **Report**: `docs/03-analysis/gemini-video-pipeline.analysis.md`
- **Key Gaps**: Duration limit not enforced in yt-dlp, 404 vs 400 not distinguished
- **Pattern**: Design used class-based Python; impl used module-level functions (acceptable)
- **Model Mismatch**: Design says `gemini-3.1-pro-preview`, impl uses `gemini-2.5-pro-preview-06-05`

## Project Patterns
- Backend services use module-level functions (not classes) with singleton clients
- Config via pydantic-settings `BaseSettings`
- Frontend uses `@xyflow/react` for workflow visualization
- API prefix: `/api/{module}` registered in `app/api/__init__.py`
- Environment: Windows 10, paths use forward slashes in code
