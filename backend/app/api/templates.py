from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.template import Template
from app.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse

router = APIRouter()

@router.get("/", response_model=List[TemplateResponse])
def get_templates(
    platform: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Template)
    if platform:
        query = query.filter(Template.platform == platform)
    return query.all()

@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.post("/", response_model=TemplateResponse)
def create_template(template: TemplateCreate, db: Session = Depends(get_db)):
    # If setting as default, unset other defaults for same platform
    if template.is_default:
        db.query(Template).filter(
            Template.platform == template.platform,
            Template.is_default == True
        ).update({"is_default": False})

    db_template = Template(**template.model_dump())
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

@router.patch("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    template_update: TemplateUpdate,
    db: Session = Depends(get_db)
):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = template_update.model_dump(exclude_unset=True)

    # If setting as default, unset other defaults for same platform
    if update_data.get("is_default"):
        db.query(Template).filter(
            Template.platform == template.platform,
            Template.is_default == True,
            Template.id != template_id
        ).update({"is_default": False})

    for key, value in update_data.items():
        setattr(template, key, value)

    db.commit()
    db.refresh(template)
    return template

@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(template)
    db.commit()
    return {"message": "Template deleted"}
