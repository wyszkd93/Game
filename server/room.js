// 플랫폼과 무관한 방 로직. conn은 { send(str), close() }를 가진 소켓 객체이면 됩니다.
// (Node의 ws 소켓, Cloudflare Workers의 WebSocket 모두 해당)
const LIMIT = 60;            // 좌표 허용 범위 (게임 필드 ±46)
const MAX_MSG = 1024;        // 메시지 최대 바이트 수
const MIN_STATE_MS = 40;     // 위치 메시지 최소 간격
const MIN_THROW_MS = 200;    // 눈덩이 던지기 최소 간격
const MIN_HIT_MS = 250;
const MAX_MSG_PER_SEC = 60;

const num = (v, lim = LIMIT) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : null);
export function cleanName(raw) {
  // 제어문자·꺾쇠 제거, 앞뒤 공백 제거, 최대 10자(코드포인트 기준)
  const s = String(raw ?? "").replace(/[\u0000-\u001f\u007f-\u009f<>&"'`​-‏‪-‮⁦-⁩]/g, "").replace(/\s+/g, " ").trim();
  return [...s].slice(0, 10).join("");
}

export class Room {
  constructor({ id, name, max = 20 }) {
    this.id = id; this.name = name; this.max = max;
    this.players = new Map(); // conn -> player
    this.nextId = 1;
  }
  get count() { return this.players.size; }

  open(conn) { conn.__bucket = { t: Date.now(), n: 0 }; }

  message(conn, raw) {
    if (typeof raw !== "string" || raw.length > MAX_MSG) return;
    const now = Date.now(), b = conn.__bucket || (conn.__bucket = { t: now, n: 0 });
    if (now - b.t > 1000) { b.t = now; b.n = 0; }
    if (++b.n > MAX_MSG_PER_SEC) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== "object") return;
    const p = this.players.get(conn);
    if (m.t === "join") return this.join(conn, p, m);
    if (!p) return;
    switch (m.t) {
      case "s": return this.state(p, m, now);
      case "throw": return this.thrown(p, m, now);
      case "hit": return this.hit(p, m, now);
      case "score": return this.score(p, m);
      case "ev": return this.ev(p, m, now);
    }
  }

  join(conn, existing, m) {
    if (existing) return;
    if (this.players.size >= this.max) { this.send(conn, { t: "full" }); try { conn.close(); } catch {} return; }
    const id = this.nextId++;
    const name = cleanName(m.name) || "펭귄" + id;
    const skin = Number.isInteger(m.skin) && m.skin >= 0 && m.skin < 4 ? m.skin : 0;
    const p = { id, name, skin, x: 0, z: 8, f: 0, mv: 0, b: null, hits: 0, lastS: 0, lastT: 0, lastH: 0, conn };
    this.players.set(conn, p);
    this.send(conn, { t: "welcome", id, server: { id: this.id, name: this.name, max: this.max }, players: [...this.players.values()].map(pub) });
    this.broadcast({ t: "join", p: pub(p) }, conn);
  }

  state(p, m, now) {
    if (now - p.lastS < MIN_STATE_MS) return;
    const x = num(m.x), z = num(m.z), f = num(m.f, 10);
    if (x === null || z === null || f === null) return;
    p.lastS = now; p.x = x; p.z = z; p.f = f; p.mv = m.mv ? 1 : 0;
    p.b = Array.isArray(m.b) && m.b.length === 2 && num(m.b[0]) !== null && num(m.b[1]) !== null ? [num(m.b[0]), num(m.b[1])] : null;
    this.broadcast({ t: "s", id: p.id, x, z, f, mv: p.mv, b: p.b }, p.conn);
  }

  thrown(p, m, now) {
    if (now - p.lastT < MIN_THROW_MS) return;
    const v = [m.sx, m.sy, m.sz, m.vx, m.vy, m.vz].map(n => num(n, 100));
    if (v.some(n => n === null)) return;
    if (Math.hypot(v[3], v[4], v[5]) > 60) return; // 비정상적으로 빠른 눈덩이 거부
    p.lastT = now;
    this.broadcast({ t: "throw", id: p.id, sx: v[0], sy: v[1], sz: v[2], vx: v[3], vy: v[4], vz: v[5] }, p.conn);
  }

  // 맞은 쪽이 신고하고 서버가 맞힌 사람의 점수를 올립니다 (친구끼리 노는 게임이라 클라이언트 판정을 믿습니다).
  hit(victim, m, now) {
    if (now - victim.lastH < MIN_HIT_MS) return;
    const shooter = [...this.players.values()].find(q => q.id === m.by);
    if (!shooter || shooter === victim) return;
    victim.lastH = now; shooter.hits++;
    this.broadcast({ t: "hit", from: shooter.id, to: victim.id, hits: shooter.hits });
  }

  // 낚시 등 점수제 게임: 한 번에 올릴 수 있는 점수는 제한(친구끼리 노는 게임이라 클라이언트 값을 믿되 터무니없는 값은 거부)
  score(p, m) {
    const v = m.v;
    if (!Number.isInteger(v) || v < p.hits || v - p.hits > 200 || v > 1e6) return;
    p.hits = v;
    this.broadcast({ t: "score", id: p.id, v });
  }

  // 짧은 알림 이벤트(예: 희귀 물고기를 낚았어요). 종류 k와 값 v는 짧은 영문/숫자 코드만 허용
  ev(p, m, now) {
    if (now - (p.lastE || 0) < 500) return;
    if (typeof m.k !== "string" || typeof m.v !== "string" || !/^[\w-]{1,12}$/.test(m.k) || !/^[\w-]{1,24}$/.test(m.v)) return;
    p.lastE = now;
    this.broadcast({ t: "ev", id: p.id, k: m.k, v: m.v }, p.conn);
  }

  close(conn) {
    const p = this.players.get(conn);
    if (!p) return;
    this.players.delete(conn);
    this.broadcast({ t: "leave", id: p.id });
  }

  send(conn, obj) { try { conn.send(JSON.stringify(obj)); } catch {} }
  broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const c of this.players.keys()) if (c !== except) { try { c.send(s); } catch {} }
  }
}
const pub = p => ({ id: p.id, name: p.name, skin: p.skin, x: p.x, z: p.z, f: p.f, mv: p.mv, b: p.b, hits: p.hits });
