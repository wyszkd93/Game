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
- 진행 상황은 브라우저 localStorage에 저장되고, 창을 닫은 시간도 최대 4시간까지 반영
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
