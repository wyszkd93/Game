// 멀티플레이 서버 주소(배포한 Cloudflare Worker, wss://...). 비워 두면 서버 없이 '혼자 하기'만 가능합니다. 로컬(localhost)에서는 ws://localhost:8787을 씁니다.
export const PROD_SERVER = "wss://xmas-penguin-server.penguin-games.workers.dev";

export function serverBase() {
  const h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1") {
    const o = new URLSearchParams(location.search).get("server"); // 개발용 주소 덮어쓰기는 로컬에서만 허용
    if (o && /^wss?:\/\/[\w.:-]+$/.test(o)) return o;
    return "ws://localhost:8787";
  }
  return PROD_SERVER;
}
export const httpBase = ws => ws.replace(/^ws/, "http");
