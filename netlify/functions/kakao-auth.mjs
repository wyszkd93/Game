// 카카오 로그인 → Firebase 로그인 토큰(custom token) 교환용 Netlify 서버 함수.
// POST /.netlify/functions/kakao-auth  { code }  →  { token, nickname }
//
// 필요한 환경 변수 (Netlify → Site configuration → Environment variables, 값은 절대 리포에 넣지 않는다)
//   KAKAO_REST_KEY          카카오 앱의 REST API 키
//   KAKAO_CLIENT_SECRET     (선택) 카카오 로그인 Client Secret을 '사용'으로 켠 경우
//   KAKAO_REDIRECT_URI      (선택) 기본값 https://mongle-pet.netlify.app/
//   FIREBASE_CLIENT_EMAIL   Firebase 서비스 계정 JSON의 client_email
//   FIREBASE_PRIVATE_KEY    Firebase 서비스 계정 JSON의 private_key (-----BEGIN PRIVATE KEY----- 포함 전체)
import { createSign } from "node:crypto";

const AUD = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

// Firebase custom token: 서비스 계정 키로 RS256 서명한 JWT (유효 1시간)
export function makeCustomToken({ clientEmail, privateKey, uid, claims, now = Math.floor(Date.now() / 1000) }) {
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iss: clientEmail, sub: clientEmail, aud: AUD, iat: now, exp: now + 3600, uid, claims };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `${unsigned}.${b64url(sig)}`;
}

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export default async function handler(req) {
  if (req.method !== "POST") return json(405, { error: "POST만 받아요." });
  const env = (k) => (process.env[k] || "").trim();
  const restKey = env("KAKAO_REST_KEY");
  const clientEmail = env("FIREBASE_CLIENT_EMAIL");
  const privateKey = env("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"); // 한 줄로 붙여 넣은 경우의 \n 복원
  const redirectUri = env("KAKAO_REDIRECT_URI") || "https://mongle-pet.netlify.app/";
  if (!restKey || !clientEmail || !privateKey) return json(500, { error: "서버 설정(환경 변수)이 아직 없어요." });

  let code;
  try { ({ code } = await req.json()); } catch { return json(400, { error: "요청 형식이 올바르지 않아요." }); }
  if (typeof code !== "string" || !code || code.length > 1000) return json(400, { error: "인증 코드가 없어요." });

  // 1) 인증 코드 → 카카오 액세스 토큰
  const form = new URLSearchParams({ grant_type: "authorization_code", client_id: restKey, redirect_uri: redirectUri, code });
  const secret = env("KAKAO_CLIENT_SECRET");
  if (secret) form.set("client_secret", secret);
  const tokRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" }, body: form,
  });
  const tok = await tokRes.json().catch(() => ({}));
  if (!tokRes.ok || !tok.access_token) {
    return json(401, { error: "카카오 인증에 실패했어요.", detail: tok.error_description || tok.error || tokRes.status });
  }

  // 2) 카카오 사용자 정보 (회원번호, 닉네임)
  const meRes = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { authorization: `Bearer ${tok.access_token}` } });
  const me = await meRes.json().catch(() => ({}));
  if (!meRes.ok || !me.id) return json(401, { error: "카카오 사용자 정보를 가져오지 못했어요." });
  const nickname = (me.kakao_account && me.kakao_account.profile && me.kakao_account.profile.nickname)
    || (me.properties && me.properties.nickname) || "";

  // 3) Firebase 로그인 토큰 발급 (uid = kakao:회원번호)
  try {
    const token = makeCustomToken({ clientEmail, privateKey, uid: `kakao:${me.id}`, claims: { provider: "kakao" } });
    return json(200, { token, nickname: String(nickname).slice(0, 20) });
  } catch {
    return json(500, { error: "로그인 토큰을 만들지 못했어요. 서비스 계정 키를 확인해 주세요." });
  }
}
