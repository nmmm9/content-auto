from fastapi import APIRouter
from app.api import platforms, upload, ai, workflow

router = APIRouter()

router.include_router(platforms.router, prefix="/platforms", tags=["Platforms"])
router.include_router(upload.router, prefix="/upload", tags=["Upload"])
router.include_router(ai.router, prefix="/ai", tags=["AI Transform"])
router.include_router(workflow.router, prefix="/workflow", tags=["Workflow"])
