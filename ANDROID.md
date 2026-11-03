# 몽글이 키우기 · 안드로이드 앱 (Google Play) 출시 안내

몽글이는 웹앱(PWA)을 그대로 감싸는 **TWA(Trusted Web Activity)** 방식으로 안드로이드 앱이 됩니다.
Chrome이 `https://mongle-pet.netlify.app`을 주소창 없이 전체 화면으로 띄우는 방식이라

- 게임 코드를 따로 고칠 필요가 없고, 사이트를 고치면 앱도 바로 바뀝니다(스토어 재심사 불필요).
- Google·카카오·이메일 로그인과 클라우드 저장이 웹과 똑같이 동작합니다.

앱 묶음(AAB) 파일은 Microsoft가 만든 무료 도구 **PWABuilder**로 만듭니다.

---

## 0. 준비물

| 항목 | 비용·비고 |
|---|---|
| Google Play 개발자 계정 | 25달러 1회, 본인 인증(신분증) 필요 |
| 개인정보처리방침 URL | `https://mongle-pet.netlify.app/privacy.html` (리포에 포함됨, **문의 이메일은 채워야 함**) |
| 스토어 그래픽 | `store/` 폴더에 준비됨 (아이콘 512, 대표 이미지 1024×500, 스크린샷 4장) |
| 스토어 문구 | `store/listing.md` |

> **새 개인 개발자 계정 규칙**: 2023년 11월 이후 만든 개인 계정은 정식 출시 전에
> **비공개 테스트에 테스터 12명 이상이 14일 연속 참여**해야 프로덕션 출시 권한이 생깁니다.
> (정책은 바뀔 수 있으니 Play Console 안내를 따르세요.)

---

## 1. PWABuilder로 앱 묶음 만들기

1. https://www.pwabuilder.com 에서 `https://mongle-pet.netlify.app` 입력 → **Start**
2. 점검 결과(매니페스트, 서비스 워커, 아이콘)가 나오면 **Package For Stores**
3. **Android → Generate Package**, 옵션은 아래처럼 (나머지는 기본값)

   | 항목 | 값 |
   |---|---|
   | Package ID | `app.netlify.mongle_pet.twa` (기본 제안값, **한 번 정하면 못 바꿈**) |
   | App name | `몽글이 키우기` |
   | Launcher name | `몽글이` |
   | Theme / Background / Nav color | `#1B2236` |
   | Display mode | Standalone |
   | Signing key | **Create new** (이름·회사 등은 본인 정보) |

4. **Download** → zip 파일 안에
   - `*.aab` : Play Console에 올릴 파일
   - `*.apk` : 내 폰에 바로 깔아 보는 테스트용
   - `signing.keystore`, `signing-key-info.txt` : **서명 키. 잃어버리면 앱 업데이트 불가.** 안전한 곳(USB, 비밀번호 관리자)에 백업하고, 리포나 채팅에 올리지 마세요.
   - `assetlinks.json` : 2단계에서 사용

## 2. 사이트와 앱 연결하기 (assetlinks.json)

이 파일이 사이트에 없으면 앱 위쪽에 **주소창이 보입니다**(앱처럼 안 보임).

1. zip 안의 `assetlinks.json` 내용을 그대로 보내 주세요. 패키지 이름과 **공개** 지문(SHA-256)만 들어 있어서 공유해도 됩니다.
2. 리포의 `mongle/.well-known/assetlinks.json`으로 추가 → 머지하면
   `https://mongle-pet.netlify.app/.well-known/assetlinks.json` 에서 열립니다.
3. **Play 앱 서명 사용 시 지문 추가 (중요)**: Play Console에 올리면 Google이 앱을 다시 서명합니다.
   **Play Console → 앱 → 테스트 및 출시 → 설정 → 앱 무결성 → 앱 서명** 의
   **"앱 서명 키 인증서" SHA-256 지문**도 assetlinks.json에 추가해야 Play에서 받은 앱에 주소창이 안 보입니다.

## 3. Play Console 등록

1. https://play.google.com/console → **앱 만들기** (이름 `몽글이 키우기`, 게임, 무료)
2. **대시보드의 '앱 설정' 항목 채우기**
   - 개인정보처리방침: `https://mongle-pet.netlify.app/privacy.html`
   - 앱 액세스: 모든 기능을 로그인 없이 사용 가능 (로그인은 선택)
   - 광고: 없음
   - 콘텐츠 등급: 설문 작성 (폭력·도박 등 없음 → 전체이용가 예상)
   - 타겟층: 만 13세 이상 권장 (만 13세 미만을 포함하면 가족 정책 추가 심사)
   - **데이터 보안**: `store/listing.md`의 표 참고
   - 계정 삭제 URL: `https://mongle-pet.netlify.app/privacy.html` (4번 항목에 삭제 방법 안내)
3. **스토어 등록정보**: `store/listing.md` 문구, `store/` 그래픽 업로드
4. **테스트 → 비공개 테스트**에 트랙 만들고 `.aab` 업로드, 테스터 이메일 등록
5. 테스트 기간이 끝나면 **프로덕션**으로 출시 신청

## 4. 출시 후 업데이트

- 게임을 고치려면 지금처럼 PR을 머지하면 됩니다. Netlify가 배포하면 앱도 다음 실행 때 바로 반영됩니다.
- 아이콘·앱 이름·패키지 설정을 바꿀 때만 PWABuilder로 다시 묶어서 **같은 서명 키**로 올립니다.

## 5. 확인할 것 (실기기)

- [ ] 설치 후 주소창 없이 전체 화면으로 열리는지 (안 되면 2단계 지문 확인)
- [ ] 카카오 로그인 → 돌아와서 로그인 상태
- [ ] Google 로그인 (TWA 안에서 팝업/이동 방식이 동작하는지)
- [ ] 비행기 모드에서 실행 → 게임이 열리는지
- [ ] 설정 → 계정 삭제 동작
