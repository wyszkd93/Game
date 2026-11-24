import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import WebSocket from "ws";
import { cleanName } from "./room.js";

const PORT = 18787, base = `ws://localhost:${PORT}`;
const srv = spawn("node", ["node-server.js"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitUp() { for (let i = 0; i < 50; i++) { try { await fetch(`http://localhost:${PORT}/servers`); return; } catch { await sleep(100); } } throw new Error("server did not start"); }
function client(room, name, skin = 0) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`${base}/ws/${room}`), msgs = [];
    ws.on("message", d => { const m = JSON.parse(d); msgs.push(m); if (m.t === "welcome") res({ ws, msgs, id: m.id, welcome: m }); });
    ws.on("open", () => ws.send(JSON.stringify({ t: "join", name, skin })));
    ws.on("close", () => { if (!msgs.length) rej(new Error("closed")); });
    ws.on("error", rej);
    ws.msgs = msgs;
  });
}
const send = (c, o) => c.ws.send(JSON.stringify(o));
let pass = 0; const ok = (n) => { pass++; console.log("ok -", n); };

try {
  assert.equal(cleanName("  <b>안녕</b>\u0007  하이  "), "b안녕/b 하이".slice(0, 10)); ok("cleanName strips markup/control");
  assert.equal(cleanName("가".repeat(30)).length, 10); ok("cleanName max length");
  assert.equal(cleanName("   "), ""); ok("cleanName blank");
  await waitUp();
  let list = await (await fetch(`http://localhost:${PORT}/servers`)).json();
  assert.equal(list.length, 3); assert.ok(list.every(s => s.count === 0 && s.max === 20)); ok("3 servers listed");

  const a = await client(1, "알파", 1), b = await client(1, "알파", 2);   // 같은 닉네임 허용
  assert.notEqual(a.id, b.id); assert.equal(b.welcome.players.length, 2); ok("join + duplicate nickname ok");
  await sleep(50); assert.ok(a.msgs.some(m => m.t === "join" && m.p.id === b.id)); ok("join broadcast");
  const c = await client(2, "다른방");
  list = await (await fetch(`http://localhost:${PORT}/servers`)).json();
  assert.deepEqual(list.map(s => s.count), [2, 1, 0]); ok("per-server counts");
  assert.equal(c.welcome.players.length, 1); ok("rooms are isolated");

  send(a, { t: "s", x: 3, z: -4, f: 1, mv: 1, b: [1, 2] }); await sleep(100);
  const st = b.msgs.find(m => m.t === "s" && m.id === a.id); assert.ok(st && st.x === 3 && st.z === -4 && st.b[0] === 1); ok("state relayed");
  assert.ok(!a.msgs.some(m => m.t === "s" && m.id === a.id)); ok("no echo to sender");
  send(a, { t: "s", x: 1e9, z: 0, f: 0 }); await sleep(100); send(a, { t: "s", x: "x", z: 0, f: 0 }); await sleep(100);
  assert.ok(!b.msgs.some(m => m.t === "s" && m.x > 100)); ok("out-of-range/invalid state rejected");

  send(a, { t: "throw", sx: 0, sy: 1.6, sz: 0, vx: 5, vy: 8, vz: -5 }); await sleep(100);
  assert.ok(b.msgs.some(m => m.t === "throw" && m.id === a.id && m.vz === -5)); ok("throw relayed");
  await sleep(250); send(a, { t: "throw", sx: 0, sy: 0, sz: 0, vx: 500, vy: 0, vz: 0 }); await sleep(100);
  assert.equal(b.msgs.filter(m => m.t === "throw").length, 1); ok("too-fast throw rejected");

  send(b, { t: "hit", by: a.id }); await sleep(100);
  const h = a.msgs.find(m => m.t === "hit"); assert.ok(h && h.from === a.id && h.to === b.id && h.hits === 1); ok("hit credits shooter");
  send(b, { t: "hit", by: b.id }); send(b, { t: "hit", by: 9999 }); await sleep(100);
  assert.equal(a.msgs.filter(m => m.t === "hit").length, 1); ok("self/unknown hit ignored");

  send(a, { t: "score", v: 40 }); await sleep(80); send(a, { t: "score", v: 9999 }); send(a, { t: "score", v: 10 }); await sleep(100);
  const sc = c.msgs.filter(m => m.t === "score"); assert.equal(sc.length, 0); // 다른 방에는 전달되지 않음
  assert.deepEqual(a.msgs.filter(m => m.t === "score").map(m => m.v), [40]); ok("score accepted only within limits, broadcast to own room");
  send(a, { t: "ev", k: "catch", v: "salmon" }); send(a, { t: "ev", k: "<x>", v: "y" }); await sleep(100);
  assert.deepEqual(c.msgs.filter(m => m.t === "ev"), []);
  const evs = b.msgs.filter(m => m.t === "ev"); assert.equal(evs.length, 1); assert.equal(evs[0].v, "salmon"); ok("valid event relayed to room, invalid/other-room ignored");
  a.ws.send("not json"); a.ws.send("[1,2]"); a.ws.send(JSON.stringify({ t: "zzz" })); await sleep(100); assert.equal(a.ws.readyState, WebSocket.OPEN); ok("garbage input ignored");
  const big = await client(2, "큰메시지"); big.ws.send("x".repeat(5000)); await sleep(150); assert.equal(big.ws.readyState, WebSocket.CLOSED); ok("oversized frame closes connection");
  b.ws.close(); await sleep(100);
  assert.ok(a.msgs.some(m => m.t === "leave" && m.id === b.id)); ok("leave broadcast");

  const many = []; for (let i = 0; i < 20; i++) many.push(await client(3, "p" + i));
  const full = await new Promise(r => { const ws = new WebSocket(`${base}/ws/3`); ws.on("open", () => ws.send(JSON.stringify({ t: "join", name: "x" }))); ws.on("message", d => { if (JSON.parse(d).t === "full") r(true); }); });
  assert.ok(full); ok("room full at 20");
  const bad = await new Promise(r => { const ws = new WebSocket(`${base}/ws/99`); ws.on("error", () => r(true)); ws.on("close", () => r(true)); });
  assert.ok(bad); ok("unknown room refused");
  console.log(`\nALL ${pass} PASSED`);
} catch (e) { console.error("FAIL:", e); process.exitCode = 1; } finally { srv.kill(); setTimeout(() => process.exit(process.exitCode || 0), 100); }
