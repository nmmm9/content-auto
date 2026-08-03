# metrics-agent — 네이버 블로그 · LinkedIn 로컬 수집 에이전트

API가 없거나 제한된 플랫폼(네이버 블로그, LinkedIn)의 수치를
이 PC의 로그인 세션으로 수집해서 성과 대시보드에 합류시킨다.

## 동작

매 실행마다:
1. **네이버 RSS**(`rss.blog.naver.com/{id}.xml`)에서 새 글 감지 → 자동 등록
2. 등록된 네이버 글의 공개 모바일 페이지에서 **공감·댓글** 수집 (로그인 불필요)
3. 등록된 LinkedIn 게시물 페이지에서 **반응·댓글(·노출)** 수집 (로그인 세션 필요)
4. `/api/posts/metrics`로 전송 → 대시보드·성과 페이지에 표시

## 최초 설정 (1회)

```bat
cd scripts\metrics-agent
npm install
```

1. `config.json`의 `naver_blog_id`에 블로그 아이디 입력
   (블로그 주소가 `blog.naver.com/abcd`라면 `abcd`)
2. `node login.mjs` → 뜨는 크롬 창에서 네이버·링크드인 로그인 → 창 닫기
3. LinkedIn 게시물은 **성과 페이지에서 URL 등록** 필요 (자동 감지 없음)
4. 테스트: `node scrape.mjs`
5. 매일 자동 실행 등록: `install-schedule.bat` 더블클릭 (기본 06:30)

## 주의

- **PC가 켜져 있는 시간대로 스케줄**을 잡을 것 (꺼져 있으면 그 날은 건너뜀)
- **LinkedIn**: 자동화는 약관 위반이라 계정 제한 리스크가 있음.
  하루 1회, 등록된 게시물만 천천히 읽는 수준으로 최소화되어 있지만 감안할 것.
- 네이버 **조회수**는 공개 페이지에 없어서 v1은 공감·댓글만 수집.
  조회수는 크리에이터 어드바이저 로그인 화면 기준으로 추후 확장 예정 (현재는 수동 입력 병행).
- 수치 패턴 검출 실패 시 `debug/` 폴더에 페이지 텍스트가 저장됨 — 그 파일을 보면 셀렉터를 보정할 수 있다.
- 로그: `agent.log`

## 파일

- `login.mjs` — 로그인 세션 저장 (최초 1회)
- `scrape.mjs` — 수집 본체
- `run.bat` — 스케줄러가 부르는 실행 래퍼 (로그 적재)
- `install-schedule.bat` — Windows 작업 스케줄러 등록
- `profile/` — 크롬 프로필(로그인 세션). **커밋 금지** (.gitignore 처리됨)
