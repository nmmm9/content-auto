# Plan: Supabase Integration

## 개요
현재 프론트엔드는 하드코딩된 더미 데이터 + localhost FastAPI(SQLite)를 사용 중.
Supabase(MGM 프로젝트)로 전환하여 클라우드 DB 기반 실서비스 데이터 관리 구현.

## 현재 상태 (As-Is)
- 캘린더: `useState([더미배열])` - DB 미연동
- 대시보드: `fetch('http://localhost:8000/api/...')` - 로컬 FastAPI 의존
- 워크플로우: 프론트엔드 자체 상태 관리
- 링크 분석: 샘플 데이터 fallback

## 목표 상태 (To-Be)
- 모든 데이터를 Supabase에서 조회/저장
- 프론트엔드에서 `@supabase/supabase-js` 클라이언트로 직접 연결
- 배포 환경(Vercel)에서도 데이터 유지

## Supabase 프로젝트 정보
- **Project**: MGM (`hieolsicwhladrmvbaba`)
- **Region**: ap-northeast-2
- **URL**: `https://hieolsicwhladrmvbaba.supabase.co`

## 생성 완료된 테이블
| 테이블 | 용도 |
|--------|------|
| `contents` | 콘텐츠 (제목, 설명, 상태, 예약일 등) |
| `platform_connections` | 플랫폼 연동 상태 (7개 기본 데이터 삽입 완료) |
| `upload_history` | 업로드 이력 (플랫폼별) |
| `tracking_links` | UTM 트래킹 링크 |
| `click_events` | 클릭 이벤트 기록 |

## 구현 범위

### Phase 1: Supabase 클라이언트 설정
- `@supabase/supabase-js` 패키지 설치
- `frontend/src/lib/supabase.ts` 클라이언트 초기화 파일 생성
- 환경 변수 설정 (`.env` - VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

### Phase 2: API 서비스 교체
- `frontend/src/services/api.ts` 전면 수정
  - `fetch('localhost:8000/api/...')` → Supabase client 쿼리로 교체
  - Contents CRUD, Platforms 조회, Upload History, Tracking Analytics

### Phase 3: 캘린더 DB 연동
- `Calendar.tsx`의 `useState([더미])` → `useEffect` + Supabase 쿼리
- `CalendarContent` 타입을 DB 스키마에 맞게 조정
- 더미 데이터 제거

### Phase 4: 대시보드 DB 연동
- `Dashboard.tsx`의 `fetch('localhost:8000/...')` → Supabase 쿼리
- 링크 분석 섹션도 실제 데이터 연동
- 샘플 데이터 fallback 유지 (데이터 없을 때)

### Phase 5: RLS 정책 (선택)
- 현재는 공개 anon key 사용 → 기본 RLS 비활성 상태로 시작
- 추후 인증 추가 시 RLS 정책 설정

## 수정 대상 파일
| 파일 | 변경 내용 |
|------|-----------|
| `frontend/package.json` | `@supabase/supabase-js` 추가 |
| `frontend/src/lib/supabase.ts` | 신규 - 클라이언트 초기화 |
| `frontend/.env` | 신규 - Supabase URL/KEY |
| `frontend/src/services/api.ts` | Supabase 쿼리로 전면 교체 |
| `frontend/src/pages/Calendar.tsx` | 더미 데이터 → DB 조회 |
| `frontend/src/pages/Dashboard.tsx` | localhost fetch → Supabase |
| `frontend/src/types/index.ts` | DB 스키마 맞게 타입 조정 |

## 우선순위
1. Phase 1 (클라이언트 설정) - 필수 선행
2. Phase 2 (API 교체) - 핵심
3. Phase 3 (캘린더 연동) - 사용자 요청 사항
4. Phase 4 (대시보드 연동) - 자연스러운 확장
5. Phase 5 (RLS) - 추후

## 제약사항
- 빌드는 사용자 허락 받고 실행
- FastAPI 백엔드는 당장 제거하지 않음 (워크플로우의 Gemini 분석 등 서버사이드 로직 유지 가능)
- Vercel 환경변수에 Supabase key 등록 필요
