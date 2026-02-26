from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import router
from app.core.database import engine, Base

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="콘텐츠 자동 업로드 시스템",
    description="유튜브, 네이버 블로그, 페이스북, 인스타그램 자동 업로드",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(router, prefix="/api")

@app.get("/")
def root():
    return {"message": "콘텐츠 자동 업로드 시스템 API", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
