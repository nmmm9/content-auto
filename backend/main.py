import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import router
from app.api.redirect import router as redirect_router
from app.core.database import engine, Base

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="콘텐츠 자동 업로드 시스템",
    description="유튜브, 네이버 블로그, 페이스북, 인스타그램 자동 업로드",
    version="1.0.0"
)

# CORS 설정
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]
# 환경변수로 추가 origin 허용 (Vercel 등)
extra_origins = os.getenv("CORS_ORIGINS", "")
if extra_origins:
    allowed_origins.extend([o.strip() for o in extra_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(router, prefix="/api")

# 리다이렉트 라우터 (루트에 등록 - /t/{short_code})
app.include_router(redirect_router)

@app.get("/")
def root():
    return {"message": "콘텐츠 자동 업로드 시스템 API", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
