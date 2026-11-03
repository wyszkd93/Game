# Game.git

## 몽글이 키우기 (`mongle/index.html`)

휴대폰 앱처럼 쓰는 도트 가상 펫 육성 게임입니다. 하단 탭(돌보기·상점·도감·일지·설정), 도트 아이콘 버튼, 시간대에 따라 창밖이 바뀌는 방 화면으로 구성돼 있습니다.

- 알 → 아기 → 어린이 → 청소년 → 어른으로 성장
- 밥 / 간식 / 별 받기(미니게임) / 씻기 / 재우기 / 약, 화면을 눌러 쓰다듬기
- 별 받기: 떨어지는 별은 받고 돌은 피하기, 받은 별만큼 코인
- 코인 상점(케이크·비타민·에너지 젤리·리본·왕관)과 펫의 소원 들어주기
- 처음 시작할 때 친구 고르기: 고양이·강아지·곰·여우·판다·너구리 중 하나를 고르고 이름 짓기
- 표정(웃음·슬픔·아픔·졸림)과 밥 먹기·씻기·싫다고 고개 젓기 같은 반응 애니메이션
- 키운 방식에 따라 종류별 5가지 어른 모습으로 진화(예: 반짝냥·반짝멍·반짝곰), 종류별 도감에 수집(전체 30종)
- 배부름·행복·청결·체력·건강 수치, 똥·병·돌봄 실수·죽음
- 진행 상황은 브라우저 localStorage에 저장되고, 앱을 닫아 둔 시간은 최대 3일까지 '안심 모드'로 반영
- 설정에서 시간 ×20으로 바꾸면 성장을 빨리 볼 수 있음

## 휴대폰 앱으로 설치하기 (PWA)

몽글이는 홈 화면에 설치하는 웹 앱(PWA)입니다. 설치하면 아이콘으로 실행되고, 전체 화면으로 열리며, 인터넷 없이도 동작합니다.

### 1. 웹 주소 열기 (리포 관리자가 한 번만)

1. GitHub에서 이 리포의 **Settings → Pages**로 이동
2. **Build and deployment → Source**를 `Deploy from a branch`로, **Branch**를 `main` / `/ (root)`로 두고 **Save**
3. 1~2분 뒤 `https://wyszkd93.github.io/Game/` 주소가 열림 (자동으로 `mongle/`로 이동)

### 1-2. Netlify로 공유하기 (GitHub Pages 대신 또는 함께)

`netlify.toml`이 들어 있어서 빌드 설정 없이 바로 배포됩니다. `mongle/` 폴더가 사이트 루트가 되어 `https://<사이트이름>.netlify.app/`에서 바로 게임이 열립니다.

1. https://app.netlify.com 에 GitHub 계정으로 가입/로그인
2. **Add new site → Import an existing project → GitHub** 선택, 이 리포(`wyszkd93/Game`) 접근 허용
3. Branch는 `main`, Build command·Publish directory는 비워 두거나 자동으로 채워진 값(`mongle`) 그대로 두고 **Deploy**
4. **Site configuration → Change site name**에서 주소를 원하는 이름으로 변경 (예: `mongle-pet`)
5. 이후 `main`에 머지할 때마다 자동으로 다시 배포됨

### 2. 휴대폰에 설치

- **아이폰(Safari)**: 주소를 연 뒤 공유 버튼 → **홈 화면에 추가**
- **안드로이드(Chrome)**: 주소를 연 뒤 메뉴(⋮) → **앱 설치** 또는 **홈 화면에 추가**

### 참고

- 진행 상황은 기기마다 따로 저장됩니다. 아이폰은 Safari와 홈 화면 앱의 저장소도 서로 다릅니다.
- 게임 파일을 고치면 `mongle/sw.js`의 `VERSION` 값을 올려야 설치된 앱이 새 파일을 받습니다.

### 파일

- `mongle/manifest.webmanifest`: 앱 이름, 아이콘, 전체 화면 설정
- `mongle/sw.js`: 오프라인 캐시(서비스 워커)
- `mongle/icons/`: 앱 아이콘
- `index.html`: 리포 첫 화면에서 게임으로 이동
- `mongle/fonts/`: 도트 폰트 Galmuri11 (OFL-1.1, 라이선스 전문은 `mongle/fonts/LICENSE.txt`)

## 로그인 · 클라우드 저장 (Firebase)

설정 탭의 **계정 · 클라우드 저장**에서 Google 또는 이메일로 로그인하면 기록이 Firestore에 저장되고, 다른 기기에서 로그인해도 이어서 키울 수 있습니다. 새 기기에서는 친구 고르기 화면의 **로그인해서 이어 하기**로 불러옵니다. 양쪽 기록이 다르면 어느 쪽을 쓸지 고르고, 도감은 합쳐집니다. `mongle/firebase-config.js`가 비어 있으면 이 메뉴는 숨겨지고 기기 안에만 저장됩니다.

### Firebase 콘솔에서 한 번 설정하기

1. **프로젝트 만들기** (이미 있으면 그 프로젝트 사용)
2. **Authentication → 시작하기 → 로그인 방법**에서 `Google`과 `이메일/비밀번호` 사용 설정
3. **Authentication → 설정 → 승인된 도메인**에 Netlify 주소 추가 (예: `mongle-pet.netlify.app`)
4. **Firestore Database → 데이터베이스 만들기** (프로덕션 모드, 서울 `asia-northeast3` 권장)
5. **Firestore Database → 규칙**에 리포의 `firestore.rules` 내용을 붙여 넣고 **게시**
6. **프로젝트 설정 → 일반 → 내 앱 → 웹 앱 추가(`</>`)** 후 나오는 `firebaseConfig` 값을 `mongle/firebase-config.js`에 넣기
   (apiKey 등은 비밀 값이 아니라 공개돼도 됩니다. 보안은 5번의 규칙과 3번의 승인된 도메인이 담당합니다.)

### 저장 구조

- 컬렉션 `users`, 문서 id = 로그인 사용자 uid, 필드: `save`(게임 기록 JSON 문자열), `dex`, `savedAt`, `name`, `species`, `stage`, `updatedAt`, `v`
- 열려 있는 동안 2분마다, 앱을 내릴 때, **지금 저장**을 누를 때 저장 (무료 사용량 안에서 쓰도록 횟수 제한)

### 로컬 테스트 (Firebase 에뮬레이터)

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-mongle
```

에뮬레이터를 켠 뒤 `firebase-config.js`에 아무 값(`projectId: "demo-mongle"`)을 넣고 `http://127.0.0.1:<포트>/?emulator=1`로 열면 실제 Firebase 대신 에뮬레이터에 저장됩니다.

### 포함된 라이브러리

- `mongle/vendor/firebase/`: Firebase JS SDK 12.19.0 (Apache-2.0, `NOTICE.txt` 참고). CDN 대신 직접 넣어 오프라인 캐시가 되도록 함

## 난이도와 '안심 모드'

- 켜 둔 상태 기준으로 배고픔은 약 6시간, 행복은 약 7.5시간, 체력은 약 6시간, 청결은 약 10시간에 걸쳐 줄어듭니다.
- **앱을 닫아 두었거나, 켜 둔 채 10분 동안 조작이 없으면 '안심 모드'**: 줄어드는 속도는 절반이고, 배고픔·행복·청결은 20 아래로 내려가지 않으며, 병에 걸리거나 죽지 않고, 소원도 멈춥니다. 최대 3일까지 반영됩니다.
- 성장: 알 20초 → 아기 10분 → 어린이 1시간 → 청소년 3시간 → 어른. 이미 자란 펫은 단계가 뒤로 가지 않습니다.

## 카카오 로그인

카카오 인증 → Netlify 서버 함수(`netlify/functions/kakao-auth.mjs`)가 카카오에 사용자를 확인하고 Firebase 로그인 토큰을 발급 → 게임이 그 토큰으로 Firebase에 로그인합니다. 사용자 id는 `kakao:카카오회원번호`이고, 클라우드 저장은 Google·이메일 로그인과 똑같이 동작합니다. 외부 패키지 없이 Node 기본 모듈만 씁니다.

### 1. 카카오 디벨로퍼스 (https://developers.kakao.com)

1. **내 애플리케이션 → 애플리케이션 추가하기** (앱 이름 `몽글이`)
2. **앱 설정 → 플랫폼 → Web 플랫폼 등록**: 사이트 도메인 `https://mongle-pet.netlify.app`
3. **제품 설정 → 카카오 로그인 → 활성화 설정 ON**, **Redirect URI**에 `https://mongle-pet.netlify.app/` (끝의 `/` 포함)
4. **카카오 로그인 → 동의항목**: `닉네임` 사용(필수 또는 선택)
5. **앱 설정 → 앱 키**의 **REST API 키**를 `mongle/firebase-config.js`의 `window.MONGLE_KAKAO = { restKey: "..." }`에 넣기
6. (선택) **카카오 로그인 → 보안 → Client Secret**을 '사용함'으로 켰다면 그 값을 아래 Netlify 환경 변수 `KAKAO_CLIENT_SECRET`에 넣기

### 2. Firebase 서비스 계정 키

Firebase 콘솔 → **프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성**으로 JSON 파일을 받습니다. **이 파일은 비밀입니다. 리포나 채팅에 올리지 말고** 아래 환경 변수에만 넣으세요.

### 3. Netlify 환경 변수 (Site configuration → Environment variables, Scope: Functions 포함)

| 이름 | 값 |
|---|---|
| `KAKAO_REST_KEY` | 카카오 REST API 키 |
| `KAKAO_CLIENT_SECRET` | (Client Secret을 켠 경우만) |
| `FIREBASE_CLIENT_EMAIL` | 서비스 계정 JSON의 `client_email` |
| `FIREBASE_PRIVATE_KEY` | 서비스 계정 JSON의 `private_key` 전체 (`-----BEGIN PRIVATE KEY-----`부터 `-----END PRIVATE KEY-----\n`까지) |

환경 변수를 바꾼 뒤에는 **Deploys → Trigger deploy → Deploy site**로 다시 배포해야 반영됩니다.
