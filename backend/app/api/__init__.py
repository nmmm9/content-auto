from fastapi import APIRouter
from app.api import contents, templates, platforms, upload, ai, workflow

router = APIRouter()

router.include_router(contents.router, prefix="/contents", tags=["Contents"])
router.include_router(templates.router, prefix="/templates", tags=["Templates"])
router.include_router(platforms.router, prefix="/platforms", tags=["Platforms"])
router.include_router(upload.router, prefix="/upload", tags=["Upload"])
router.include_router(ai.router, prefix="/ai", tags=["AI Transform"])
router.include_router(workflow.router, prefix="/workflow", tags=["Workflow"])
