// Cloudflare Workers + Durable Objects 배포용 (서버 하나 = Durable Object 하나)
import { Room } from "./room.js";
import { SERVERS } from "./servers.js";

export class GameRoom {
  constructor(state, env) { this.env = env; this.room = null; }
  async fetch(request) {
    const url = new URL(request.url), cfg = SERVERS.find(s => s.id === Number(url.searchParams.get("id")));
    if (!cfg) return new Response("no such room", { status: 404 });
    if (!this.room) this.room = new Room(cfg);
    if (url.pathname === "/count") return Response.json({ count: this.room.count });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    this.room.open(server);
    server.addEventListener("message", e => this.room.message(server, typeof e.data === "string" ? e.data : ""));
    server.addEventListener("close", () => this.room.close(server));
    server.addEventListener("error", () => this.room.close(server));
    return new Response(null, { status: 101, webSocket: client });
  }
}

function allowed(env, origin) {
  const list = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  return !list.length || (origin && list.includes(origin));
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get("Origin");
    const cors = { "Access-Control-Allow-Origin": allowed(env, origin) ? (origin || "*") : "null", "Vary": "Origin" };
    if (url.pathname === "/servers") {
      const list = await Promise.all(SERVERS.map(async s => {
        const stub = env.ROOMS.get(env.ROOMS.idFromName("room-" + s.id));
        const { count } = await (await stub.fetch(`https://room/count?id=${s.id}`)).json();
        return { ...s, count };
      }));
      return Response.json(list, { headers: { ...cors, "Cache-Control": "no-store" } });
    }
    const m = /^\/ws\/(\d+)$/.exec(url.pathname);
    if (m && SERVERS.some(s => s.id === Number(m[1]))) {
      if (!allowed(env, origin)) return new Response("forbidden", { status: 403 });
      const u = new URL(request.url); u.pathname = "/ws"; u.searchParams.set("id", m[1]);
      return env.ROOMS.get(env.ROOMS.idFromName("room-" + m[1])).fetch(new Request(u, request));
    }
    return new Response("not found", { status: 404 });
  },
};
