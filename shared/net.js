import { serverBase, httpBase } from "./config.js";

/** 서버 목록과 접속자 수. 실패하면 null */
export async function fetchServers() {
  const base = serverBase();
  if (!base) return null;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(httpBase(base) + "/servers", { signal: ctl.signal, cache: "no-store" });
    if (!r.ok) return null;
    const list = await r.json();
    return Array.isArray(list) ? list : null;
  } catch { return null; } finally { clearTimeout(t); }
}

/** WebSocket 접속. welcome 메시지를 받으면 resolve, 가득 차거나 실패하면 reject(Error("full"|"fail")) */
export class Net {
  constructor() { this.ws = null; this.id = null; this.onmessage = null; this.onclose = null; this.alive = false; }
  connect(serverId, { name, skin }) {
    return new Promise((resolve, reject) => {
      let done = false;
      const fail = reason => { if (!done) { done = true; try { this.ws && this.ws.close(); } catch {} reject(new Error(reason)); } };
      let ws;
      try { ws = new WebSocket(`${serverBase()}/ws/${serverId}`); } catch { return fail("fail"); }
      this.ws = ws;
      const timer = setTimeout(() => fail("fail"), 6000);
      ws.onopen = () => ws.send(JSON.stringify({ t: "join", name, skin }));
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (!done) {
          if (m.t === "welcome") { done = true; clearTimeout(timer); this.id = m.id; this.alive = true; resolve(m); }
          else if (m.t === "full") { clearTimeout(timer); fail("full"); }
          return;
        }
        if (this.onmessage) this.onmessage(m);
      };
      ws.onerror = () => { clearTimeout(timer); fail("fail"); };
      ws.onclose = () => { clearTimeout(timer); if (!done) fail("fail"); else { this.alive = false; if (this.onclose) this.onclose(); } };
    });
  }
  send(obj) { if (this.alive && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  close() { this.alive = false; try { this.ws.close(); } catch {} }
}
