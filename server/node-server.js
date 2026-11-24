// 로컬 개발·테스트용 서버: node server/node-server.js  (기본 포트 8787)
// 배포용은 worker.js(Cloudflare Workers + Durable Objects)이며 같은 room.js를 씁니다.
import http from "node:http";
import { WebSocketServer } from "ws";
import { Room } from "./room.js";
import { SERVERS } from "./servers.js";

const PORT = Number(process.env.PORT || 8787);
const ALLOWED = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean); // 비우면 모두 허용(개발용)
const rooms = new Map(SERVERS.map(s => [s.id, new Room(s)]));
const originOk = o => !ALLOWED.length || (o && ALLOWED.includes(o));
const cors = o => ({ "Access-Control-Allow-Origin": originOk(o) ? (o || "*") : "null", "Vary": "Origin" });

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (req.url === "/servers") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(origin) });
    return res.end(JSON.stringify(SERVERS.map(s => ({ ...s, count: rooms.get(s.id).count }))));
  }
  res.writeHead(404); res.end("not found");
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
server.on("upgrade", (req, socket, head) => {
  const m = /^\/ws\/(\d+)$/.exec(req.url || "");
  const room = m && rooms.get(Number(m[1]));
  if (!room || !originOk(req.headers.origin)) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    room.open(ws);
    ws.on("message", d => room.message(ws, d.toString()));
    ws.on("close", () => room.close(ws));
    ws.on("error", () => room.close(ws));
  });
});
server.listen(PORT, () => console.log(`game server on :${PORT} (${SERVERS.length} rooms)`));
export { server };
