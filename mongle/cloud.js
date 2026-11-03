// 몽글이 클라우드 저장: Firebase Authentication(Google·이메일) + Firestore(lite).
// 사용자마다 users/{uid} 문서 하나에 게임 기록 전체와 도감을 저장한다.
import { initializeApp } from "./vendor/firebase/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, connectAuthEmulator,
} from "./vendor/firebase/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp, connectFirestoreEmulator,
} from "./vendor/firebase/firebase-firestore-lite.js";

const ERRORS = {
  "auth/invalid-email": "이메일 형식이 올바르지 않아요.",
  "auth/missing-password": "비밀번호를 입력해 주세요.",
  "auth/weak-password": "비밀번호는 6자 이상이어야 해요.",
  "auth/email-already-in-use": "이미 가입된 이메일이에요. 로그인해 주세요.",
  "auth/invalid-credential": "이메일 또는 비밀번호가 맞지 않아요.",
  "auth/wrong-password": "이메일 또는 비밀번호가 맞지 않아요.",
  "auth/user-not-found": "가입되지 않은 이메일이에요.",
  "auth/too-many-requests": "시도가 너무 많아요. 잠시 후 다시 해 주세요.",
  "auth/network-request-failed": "인터넷 연결을 확인해 주세요.",
  "auth/popup-closed-by-user": "로그인 창이 닫혔어요. 계속 닫히면 이메일로 로그인해 주세요.",
  "auth/popup-blocked": "팝업이 차단됐어요. 주소창의 팝업 차단을 풀어 주세요.",
  "auth/internal-error": "로그인 중 문제가 생겼어요. 잠시 후 다시 해 주세요.",
  "auth/cancelled-popup-request": "로그인 창이 닫혔어요.",
  "auth/unauthorized-domain": "이 주소는 Firebase에 승인된 도메인이 아니에요. 콘솔에서 도메인을 추가해 주세요.",
  "auth/operation-not-allowed": "이 로그인 방식이 Firebase 콘솔에서 꺼져 있어요.",
  "permission-denied": "저장 권한이 없어요. Firestore 보안 규칙을 확인해 주세요.",
  "unavailable": "인터넷 연결을 확인해 주세요.",
};
export const friendlyError = (e) => ERRORS[e && e.code] || (e && e.message) || "알 수 없는 오류가 났어요.";

export function createCloud(config, { emulator = null } = {}) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  auth.languageCode = "ko";
  const db = getFirestore(app);
  if (emulator) {
    connectAuthEmulator(auth, `http://${emulator.host}:${emulator.authPort}`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulator.host, emulator.firestorePort);
  }
  // 페이지 이동 방식 로그인의 결과(실패 이유 포함)를 화면에 알려 주기 위해 보관
  let redirectError = null, onRedirectError = null;
  getRedirectResult(auth).catch((e) => { redirectError = e; if (onRedirectError) onRedirectError(e); });
  const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  const userDoc = () => doc(db, "users", auth.currentUser.uid);

  return {
    onUser(cb) { return onAuthStateChanged(auth, cb); },
    get user() { return auth.currentUser; },
    onRedirectError(cb) { onRedirectError = cb; if (redirectError) cb(redirectError); },
    async google() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      // 홈 화면 앱에서는 팝업이 막히거나 결과를 못 받는 경우가 많아 페이지 이동 방식으로 로그인
      if (standalone()) return signInWithRedirect(auth, provider);
      try { await signInWithPopup(auth, provider); }
      catch (e) {
        // 팝업이 막히는 환경(일부 홈 화면 앱)에서는 페이지 이동 방식으로 다시 시도
        if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
          await signInWithRedirect(auth, provider);
        } else throw e;
      }
    },
    emailSignIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
    emailSignUp: (email, pw) => createUserWithEmailAndPassword(auth, email, pw),
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    logout: () => signOut(auth),
    async load() {
      const snap = await getDoc(userDoc());
      if (!snap.exists()) return null;
      const d = snap.data();
      let save = null;
      try { save = JSON.parse(d.save); } catch { save = null; }
      return { save, dex: Array.isArray(d.dex) ? d.dex : [], savedAt: Number(d.savedAt) || 0 };
    },
    async save(state, dex) {
      await setDoc(userDoc(), {
        v: 1,
        save: JSON.stringify(state),
        dex: dex.slice(0, 200),
        savedAt: state.savedAt,
        name: String(state.name || "").slice(0, 8),
        species: state.species || "cat",
        stage: state.stage || "egg",
        updatedAt: serverTimestamp(),
      });
    },
  };
}
