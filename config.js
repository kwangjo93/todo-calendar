// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar API 설정
// 아래 단계를 따라 Client ID를 발급받으세요:
//
// 1. https://console.cloud.google.com 접속
// 2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
// 3. 왼쪽 메뉴 → API 및 서비스 → 라이브러리
//    → "Google Calendar API" 검색 후 활성화
// 4. 왼쪽 메뉴 → API 및 서비스 → 사용자 인증 정보
//    → "사용자 인증 정보 만들기" → "OAuth 2.0 클라이언트 ID"
//    → 애플리케이션 유형: "웹 애플리케이션"
//    → 승인된 자바스크립트 원본에 추가:
//       http://localhost:8080  (또는 사용하는 포트)
//       http://127.0.0.1:8080
// 5. 생성된 클라이언트 ID를 아래에 붙여넣기
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  CLIENT_ID: '620323473420-jdvn4sgkil9lh6sl1e1qf4k7l6flgetp.apps.googleusercontent.com',
  API_KEY: '',
  SCOPES: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ].join(' '),
  DISCOVERY_DOCS: [
    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
  ],
};
