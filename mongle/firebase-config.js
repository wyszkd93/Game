// Firebase 웹 앱 설정.
// Firebase 콘솔 → 프로젝트 설정(톱니바퀴) → 일반 → 내 앱 → 웹 앱 → "SDK 설정 및 구성" → "구성"에 나오는 값을 붙여 넣는다.
// 이 값들은 비밀번호가 아니라 공개돼도 되는 식별자다. 보안은 Firestore 보안 규칙(firestore.rules)과
// Authentication의 승인된 도메인이 담당한다.
// 값이 null이면 로그인·클라우드 저장 메뉴가 숨겨지고 게임은 이 기기에만 저장된다.
window.MONGLE_FIREBASE = null;
/* 예시
window.MONGLE_FIREBASE = {
  apiKey: "AIza...",
  authDomain: "my-project.firebaseapp.com",
  projectId: "my-project",
  appId: "1:1234567890:web:abcdef",
};
*/
