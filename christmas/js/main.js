import * as THREE from "three";

const $ = id => document.getElementById(id);
const SKINS = [
  { name: "빨강", color: 0xe8454b }, { name: "초록", color: 0x3fbf7f },
  { name: "파랑", color: 0x4aa3ff }, { name: "분홍", color: 0xff8fc2 },
];
const NPC_COLORS = [0xffb84a, 0x9b7bff, 0x35c7c0, 0xff7b54];
const G = 18, FIELD = 46, SPEED = 6, TOUCH = matchMedia("(pointer: coarse)").matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

/* ---------- renderer / scene ---------- */
const canvas = $("view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe3ff);
scene.fog = new THREE.Fog(0xcfe3ff, 30, 90);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0xc4d4f0, 2.4));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.2);
sun.position.set(-20, 30, 10);
scene.add(sun);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

/* ---------- helpers ---------- */
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a2340, side: THREE.BackSide });
function outlined(mesh, s = 1.07) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.scale.setScalar(s);
  mesh.add(o);
  return mesh;
}
const lambert = c => new THREE.MeshLambertMaterial({ color: c });
function mesh(geo, color, x = 0, y = 0, z = 0, s) {
  const m = new THREE.Mesh(geo, lambert(color));
  m.position.set(x, y, z);
  if (s !== undefined) outlined(m, s);
  return m;
}

/* ---------- ground ---------- */
const ground = new THREE.Mesh(new THREE.CircleGeometry(FIELD + 40, 48).rotateX(-Math.PI / 2), lambert(0xf6faff));
scene.add(ground);
for (let i = 0; i < 26; i++) { // 눈 언덕(장식)
  const a = Math.random() * Math.PI * 2, r = FIELD + 4 + Math.random() * 30, s = 5 + Math.random() * 8;
  const hill = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xeaf2ff));
  hill.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  scene.add(hill);
}

/* ---------- obstacles ---------- */
const obstacles = []; // {x,z,r}
function addObstacle(x, z, r) { obstacles.push({ x, z, r }); }
function pushOut(p, rad) {
  for (const o of obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + rad;
    if (d < min && d > 1e-4) { p.x = o.x + dx / d * min; p.z = o.z + dz / d * min; }
  }
  const d = Math.hypot(p.x, p.z);
  if (d > FIELD) { p.x *= FIELD / d; p.z *= FIELD / d; }
}

function pine(x, z, scale = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8), 0x7a4b25, 0, 0.4, 0, 1.12));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.ConeGeometry(1.5 - i * 0.35, 1.8, 10), 0x2f8f58, 0, 1.5 + i * 1.0, 0, 1.05));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.ConeGeometry(0.9 - i * 0.2, 0.35, 10), 0xffffff, 0, 2.05 + i * 1.0, 0));
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  scene.add(g);
  addObstacle(x, z, 0.7 * scale);
}
function cabin(x, z, ry) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(5, 3, 4), 0xc98f5a, 0, 1.5, 0, 1.03));
  const roof = mesh(new THREE.ConeGeometry(4.2, 1.8, 4), 0xf4f7ff, 0, 3.9, 0, 1.03);
  roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.8);
  g.add(roof);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
  win.position.set(-1, 1.7, 2.02); g.add(win);
  const door = mesh(new THREE.BoxGeometry(1, 1.8, 0.1), 0x6b3f1e, 1.2, 0.9, 2.02);
  g.add(door);
  g.position.set(x, 0, z); g.rotation.y = ry;
  scene.add(g);
  addObstacle(x, z, 3.2);
}
function snowman(x, z) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.9, 16, 12), 0xffffff, 0, 0.9, 0, 1.06));
  g.add(mesh(new THREE.SphereGeometry(0.65, 16, 12), 0xffffff, 0, 2.05, 0, 1.06));
  g.add(mesh(new THREE.SphereGeometry(0.45, 16, 12), 0xffffff, 0, 2.95, 0, 1.06));
  g.add(mesh(new THREE.ConeGeometry(0.08, 0.5, 8), 0xff8a3d, 0, 2.95, 0.5)).children.at(-1).rotation.x = Math.PI / 2;
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.45, 12), 0x222222, 0, 3.5, 0));
  g.position.set(x, 0, z); scene.add(g);
  addObstacle(x, z, 1);
}

// 중앙 크리스마스 트리
const treeLights = [];
(function xmasTree() {
  const x = 0, z = -9, g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.2, 10), 0x7a4b25, 0, 0.6, 0, 1.08));
  const tiers = [[3.2, 3, 2.2], [2.5, 2.7, 4.0], [1.8, 2.4, 5.6]];
  for (const [r, h, y] of tiers) g.add(mesh(new THREE.ConeGeometry(r, h, 14), 0x2a8a52, 0, y, 0, 1.04));
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  star.position.y = 7.6; g.add(star); g.userData.star = star;
  const cols = [0xff4d4d, 0xffd24d, 0x4dc3ff, 0xff8fe0];
  for (let i = 0; i < 28; i++) {
    const t = i / 28, a = t * Math.PI * 9, y = 1.8 + t * 5, r = 3.1 * (1 - t) + 0.25;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: cols[i % 4] }));
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    g.add(m); treeLights.push(m);
  }
  g.position.set(x, 0, z);
  scene.add(g); treeLights.star = star;
  addObstacle(x, z, 2);
  const gc = [0xe8454b, 0x4aa3ff, 0xffd24d, 0x3fbf7f, 0xff8fe0];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.3, b = new THREE.Group();
    b.add(mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), gc[i % 5], 0, 0.4, 0, 1.08));
    b.add(mesh(new THREE.BoxGeometry(0.15, 0.82, 0.92), 0xffffff, 0, 0.4, 0));
    b.add(mesh(new THREE.BoxGeometry(0.92, 0.82, 0.15), 0xffffff, 0, 0.4, 0));
    b.position.set(x + Math.cos(a) * 3.6, 0, z + Math.sin(a) * 3.6); b.rotation.y = a;
    scene.add(b); addObstacle(b.position.x, b.position.z, 0.6);
  }
})();
cabin(-24, -14, 0.5); cabin(25, -18, -0.6); cabin(-10, -34, 0);
snowman(8, 4); snowman(-14, 12);
for (let i = 0; i < 40; i++) {
  const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * (FIELD - 16);
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (obstacles.every(o => Math.hypot(x - o.x, z - o.z) > o.r + 2.2) && Math.hypot(x, z - 8) > 7) pine(x, z, 0.9 + Math.random() * 0.7);
}

/* ---------- snowfall ---------- */
const SNOW_N = 700, snowPos = new Float32Array(SNOW_N * 3);
for (let i = 0; i < SNOW_N; i++) { snowPos[i * 3] = (Math.random() - 0.5) * 60; snowPos[i * 3 + 1] = Math.random() * 25; snowPos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, fog: false }));
snowPts.frustumCulled = false;
scene.add(snowPts);

/* ---------- characters ---------- */
function makeChar(color) {
  const g = new THREE.Group(), body = new THREE.Group();
  body.add(mesh(new THREE.SphereGeometry(0.55, 16, 12), color, 0, 0.62, 0, 1.08));
  body.add(mesh(new THREE.SphereGeometry(0.4, 16, 12), 0xffe3c9, 0, 1.4, 0, 1.08));
  const hat = mesh(new THREE.ConeGeometry(0.4, 0.7, 12), color, 0, 1.95, 0, 1.08);
  body.add(hat);
  body.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), 0xffffff, 0, 2.35, 0));
  body.add(mesh(new THREE.TorusGeometry(0.4, 0.09, 8, 16), 0xffffff, 0, 1.12, 0)).children.at(-1).rotation.x = Math.PI / 2;
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a2340 });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeM); e.position.set(sx * 0.14, 1.45, 0.36); body.add(e); }
  g.add(body);
  const feet = [-1, 1].map(sx => { const f = mesh(new THREE.BoxGeometry(0.28, 0.16, 0.4), 0x3a3a4a, sx * 0.22, 0.08, 0.05, 1.1); g.add(f); return f; });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5b6f99, transparent: true, opacity: 0.35 }));
  blob.position.y = 0.03; g.add(blob);
  g.userData = { body, feet };
  scene.add(g);
  return g;
}

const player = { obj: null, pos: new THREE.Vector3(0, 0, 8), facing: 0, target: null, stride: 0, step: 0, wobble: 0, cd: 0, color: store.get("xmas-skin", 0) };
const npcs = [];
let hits = 0, got = 0;

function setPlayerSkin(i) {
  player.color = i; store.set("xmas-skin", i);
  if (player.obj) scene.remove(player.obj);
  player.obj = makeChar(SKINS[i].color);
  player.obj.position.copy(player.pos);
}
NPC_COLORS.forEach((c, i) => {
  const o = makeChar(c);
  const a = i / NPC_COLORS.length * Math.PI * 2 + 0.7;
  const n = { obj: o, pos: new THREE.Vector3(Math.cos(a) * 14, 0, Math.sin(a) * 14 - 4), facing: 0, goal: null, wait: Math.random() * 2, throwT: 2 + Math.random() * 3, wobble: 0, stride: 0 };
  o.position.copy(n.pos); npcs.push(n);
});

/* ---------- 발자국 / 눈 자국 (InstancedMesh 링 버퍼) ---------- */
function ring(max, geo, color, opacity) {
  const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, polygonOffset: true, polygonOffsetFactor: -2 }), max);
  m.count = 0; m.frustumCulled = false; m.userData = { i: 0, max };
  scene.add(m); return m;
}
const prints = ring(300, new THREE.PlaneGeometry(0.22, 0.38).rotateX(-Math.PI / 2), 0x8fa6cc, 0.85);
const splats = ring(80, new THREE.CircleGeometry(0.45, 12).rotateX(-Math.PI / 2), 0xb8cbe8, 0.7);
const dummy = new THREE.Object3D();
function stamp(r, x, z, ry, s = 1) {
  const u = r.userData;
  dummy.position.set(x, 0.02, z); dummy.rotation.set(0, ry, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
  r.setMatrixAt(u.i, dummy.matrix); u.i = (u.i + 1) % u.max;
  r.count = Math.min(r.count + 1, u.max); r.instanceMatrix.needsUpdate = true;
}

/* ---------- sound ---------- */
let ac = null, noiseBuf = null, muted = store.get("xmas-muted", false);
function initAudio() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function noise(type, f0, f1, dur, vol, q = 1) {
  if (!ac || muted) return;
  const t = ac.currentTime, src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(flt).connect(g).connect(ac.destination); src.start(t); src.stop(t + dur);
}
const sfx = {
  step() { noise("bandpass", 2200 + Math.random() * 600, 1400, 0.09, 0.12, 1.5); },
  throw() { noise("bandpass", 500, 1600, 0.25, 0.12, 0.8); },
  splat() { noise("lowpass", 1200, 300, 0.18, 0.25); },
  hit() {
    noise("lowpass", 900, 200, 0.25, 0.4);
    if (!ac || muted) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.2);
  },
};
$("mute").textContent = muted ? "🔇" : "🔊";
$("mute").addEventListener("click", e => { e.stopPropagation(); muted = !muted; store.set("xmas-muted", muted); $("mute").textContent = muted ? "🔇" : "🔊"; });
$("mute").addEventListener("pointerdown", e => e.stopPropagation());

/* ---------- snowballs / puffs ---------- */
const ballGeo = new THREE.SphereGeometry(0.22, 10, 8);
const balls = [], puffs = [];
const puffGeo = new THREE.SphereGeometry(0.1, 6, 5), puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
function puff(p, n = 8) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(puffGeo, puffMat);
    m.position.copy(p);
    scene.add(m);
    puffs.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4), life: 0.5 });
  }
}
function throwBall(from, to, owner) {
  const start = new THREE.Vector3(from.x, 1.6, from.z), d = new THREE.Vector3().subVectors(to, start);
  const dist = Math.hypot(d.x, d.z), t = Math.min(1.3, Math.max(0.45, dist / 14));
  const v = new THREE.Vector3(d.x / t, (d.y + 0.5 * G * t * t) / t, d.z / t); // vy = (Δy + ½·g·t²)/t
  const m = outlined(new THREE.Mesh(ballGeo, lambert(0xffffff)), 1.15);
  m.position.copy(start); scene.add(m);
  balls.push({ m, v, owner });
}

/* ---------- input ---------- */
const keys = {};
let yaw = 0, pitch = 0.75, dist = 13, aim = null, mouseSeen = false;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function groundAt(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(plane, p) ? p : null;
}
let drag = null, started = false;
canvas.addEventListener("pointerdown", e => {
  if (!started) return;
  initAudio();
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => {
  if (e.pointerType === "mouse") { mouseSeen = true; const p = groundAt(e.clientX, e.clientY); if (p) aim = p; }
  if (!drag || e.pointerId !== drag.id) return;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
  if (drag.moved) {
    yaw -= (e.clientX - drag.x) * 0.006;
    pitch = Math.min(1.3, Math.max(0.15, pitch + (e.clientY - drag.y) * 0.005));
  }
  drag.x = e.clientX; drag.y = e.clientY;
});
canvas.addEventListener("pointerup", e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && performance.now() - drag.t < 450) {
    const p = groundAt(e.clientX, e.clientY);
    if (p) { player.target = p; if (e.pointerType !== "mouse") aim = null; }
  }
  drag = null;
});
canvas.addEventListener("pointercancel", () => { drag = null; });
canvas.addEventListener("wheel", e => { dist = Math.min(24, Math.max(6, dist + Math.sign(e.deltaY) * 1.2)); e.preventDefault(); }, { passive: false });
canvas.addEventListener("contextmenu", e => e.preventDefault());
addEventListener("keydown", e => {
  if (!started) return;
  initAudio();
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === " " || k === "f") { e.preventDefault(); doThrow(); }
});
addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
$("throw").addEventListener("pointerdown", e => { e.stopPropagation(); initAudio(); doThrow(); });

function doThrow() {
  if (player.cd > 0 || !started) return;
  player.cd = 0.35;
  let target = null;
  if (mouseSeen && aim) target = aim.clone();
  else {
    let best = 24;
    for (const n of npcs) { const d = n.pos.distanceTo(player.pos); if (d < best) { best = d; target = new THREE.Vector3(n.pos.x, 1.0, n.pos.z); } }
    if (!target) target = new THREE.Vector3(player.pos.x + Math.sin(player.facing) * 10, 0, player.pos.z + Math.cos(player.facing) * 10);
  }
  player.facing = Math.atan2(target.x - player.pos.x, target.z - player.pos.z);
  throwBall(player.pos, target, "player");
  sfx.throw();
}

/* ---------- update ---------- */
const forward = new THREE.Vector3(), tmp = new THREE.Vector3();
function walkAnim(ch, moving, dt, t) {
  const { body, feet } = ch.obj.userData;
  if (moving) ch.stride += dt * 12;
  const s = Math.sin(ch.stride);
  body.position.y = moving ? Math.abs(s) * 0.08 : 0;
  feet[0].position.z = 0.05 + (moving ? s * 0.18 : 0);
  feet[1].position.z = 0.05 + (moving ? -s * 0.18 : 0);
  ch.wobble = Math.max(0, ch.wobble - dt);
  body.rotation.z = ch.wobble > 0 ? Math.sin(ch.wobble * 40) * 0.35 * (ch.wobble / 0.5) : 0;
  ch.obj.rotation.y = ch.facing;
}
function updatePlayer(dt, t) {
  player.cd -= dt;
  let mx = 0, mz = 0;
  const f = (keys["w"] || keys["arrowup"] ? 1 : 0) - (keys["s"] || keys["arrowdown"] ? 1 : 0);
  const r = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
  if (f || r) {
    player.target = null;
    mx = -Math.sin(yaw) * f + Math.cos(yaw) * r;
    mz = -Math.cos(yaw) * f - Math.sin(yaw) * r;
  } else if (player.target) {
    const dx = player.target.x - player.pos.x, dz = player.target.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.2) player.target = null; else { mx = dx / d; mz = dz / d; }
  }
  const len = Math.hypot(mx, mz), moving = len > 0.01;
  if (moving) {
    mx /= len; mz /= len;
    const before = player.pos.clone();
    player.pos.x += mx * SPEED * dt; player.pos.z += mz * SPEED * dt;
    pushOut(player.pos, 0.45);
    if (before.distanceTo(player.pos) < SPEED * dt * 0.2) player.target = null; // 막히면 멈춤
    player.facing = Math.atan2(mx, mz);
    player.step += before.distanceTo(player.pos);
    if (player.step > 0.55) {
      player.step = 0;
      const side = player.stepSide = !player.stepSide ? 1 : -1;
      stamp(prints, player.pos.x + Math.cos(player.facing) * 0.2 * side, player.pos.z - Math.sin(player.facing) * 0.2 * side, player.facing);
      sfx.step();
    }
  }
  player.obj.position.copy(player.pos);
  walkAnim(player, moving, dt, t);
}
function updateNpcs(dt, t) {
  for (const n of npcs) {
    n.wait -= dt;
    let moving = false;
    if (n.goal) {
      const dx = n.goal.x - n.pos.x, dz = n.goal.z - n.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.4) { n.goal = null; n.wait = 1 + Math.random() * 2.5; }
      else {
        moving = true; n.facing = Math.atan2(dx, dz);
        n.pos.x += dx / d * 2.6 * dt; n.pos.z += dz / d * 2.6 * dt; pushOut(n.pos, 0.45);
        n.stepAcc = (n.stepAcc || 0) + 2.6 * dt;
        if (n.stepAcc > 0.6) { n.stepAcc = 0; n.side = -(n.side || 1); stamp(prints, n.pos.x + Math.cos(n.facing) * 0.2 * n.side, n.pos.z - Math.sin(n.facing) * 0.2 * n.side, n.facing); }
      }
    } else if (n.wait <= 0) {
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 16;
      n.goal = new THREE.Vector3(Math.max(-FIELD + 3, Math.min(FIELD - 3, n.pos.x + Math.cos(a) * r)), 0, Math.max(-FIELD + 3, Math.min(FIELD - 3, n.pos.z + Math.sin(a) * r)));
    }
    n.throwT -= dt;
    const dp = n.pos.distanceTo(player.pos);
    if (n.throwT <= 0 && started) {
      n.throwT = 2.5 + Math.random() * 3.5;
      if (dp < 22) {
        n.facing = Math.atan2(player.pos.x - n.pos.x, player.pos.z - n.pos.z);
        throwBall(n.pos, new THREE.Vector3(player.pos.x + (Math.random() - 0.5) * 3, 1.0, player.pos.z + (Math.random() - 0.5) * 3), n);
        if (dp < 14) sfx.throw();
      }
    }
    n.obj.position.copy(n.pos);
    walkAnim(n, moving, dt, t);
  }
}
const hudHits = $("hits"), hudGot = $("got");
function updateBalls(dt) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    b.v.y -= G * dt;
    b.m.position.addScaledVector(b.v, dt);
    const p = b.m.position;
    let dead = false;
    const targets = b.owner === "player" ? npcs : [player];
    for (const c of targets) {
      if (Math.hypot(p.x - c.pos.x, p.z - c.pos.z) < 0.7 && p.y > 0.1 && p.y < 2.3) {
        c.wobble = 0.5; dead = true; puff(p, 10); sfx.hit();
        if (c === player) { got++; hudGot.textContent = got; } else { hits++; hudHits.textContent = hits; store.set("xmas-hits", Math.max(store.get("xmas-hits", 0), hits)); }
        break;
      }
    }
    if (!dead && p.y <= 0.2) {
      dead = true; puff(p, 6); stamp(splats, p.x, p.z, Math.random() * 6, 0.6 + Math.random() * 0.5);
      if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 18) sfx.splat();
    }
    if (!dead && obstacles.some(o => Math.hypot(p.x - o.x, p.z - o.z) < o.r && p.y < 3)) { dead = true; puff(p, 6); }
    if (dead) { scene.remove(b.m); balls.splice(i, 1); }
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const q = puffs[i];
    q.life -= dt; q.v.y -= 10 * dt; q.m.position.addScaledVector(q.v, dt); q.m.scale.setScalar(Math.max(0.01, q.life * 2));
    if (q.life <= 0) { scene.remove(q.m); puffs.splice(i, 1); }
  }
}
function updateSnow(dt) {
  const a = snowGeo.attributes.position.array;
  for (let i = 0; i < SNOW_N; i++) {
    const k = i * 3;
    a[k + 1] -= (1.5 + (i % 5) * 0.4) * dt;
    a[k] += Math.sin(a[k + 1] + i) * 0.3 * dt;
    if (a[k + 1] < 0) a[k + 1] = 25;
    if (a[k] - player.pos.x > 30) a[k] -= 60; else if (a[k] - player.pos.x < -30) a[k] += 60;
    if (a[k + 2] - player.pos.z > 30) a[k + 2] -= 60; else if (a[k + 2] - player.pos.z < -30) a[k + 2] += 60;
  }
  snowGeo.attributes.position.needsUpdate = true;
}
function updateCamera() {
  const cp = Math.cos(pitch);
  const tx = player.pos.x, ty = 1.3, tz = player.pos.z;
  tmp.set(tx + Math.sin(yaw) * cp * dist, ty + Math.sin(pitch) * dist, tz + Math.cos(yaw) * cp * dist);
  camera.position.lerp(tmp, 0.2);
  camera.lookAt(tx, ty, tz);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
  if (started) { updatePlayer(dt, t); updateNpcs(dt, t); updateBalls(dt); }
  else { yaw += dt * 0.15; player.obj.rotation.y = t; }
  updateSnow(dt);
  treeLights.forEach((m, i) => m.scale.setScalar(0.8 + 0.4 * (0.5 + 0.5 * Math.sin(t * 3 + i))));
  treeLights.star.rotation.y = t;
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------- UI ---------- */
const skinBox = $("skins");
SKINS.forEach((s, i) => {
  const b = document.createElement("button");
  b.setAttribute("role", "radio"); b.setAttribute("aria-label", s.name);
  b.style.background = "#" + s.color.toString(16).padStart(6, "0");
  b.addEventListener("click", () => { setPlayerSkin(i); [...skinBox.children].forEach((c, j) => c.setAttribute("aria-checked", j === i)); });
  skinBox.appendChild(b);
});
setPlayerSkin(player.color);
[...skinBox.children].forEach((c, j) => c.setAttribute("aria-checked", j === player.color));
$("howto").textContent = TOUCH
  ? "탭: 이동 · 드래그: 카메라 회전 · ❄️ 버튼: 눈덩이 던지기"
  : "클릭: 이동 · 드래그: 카메라 · WASD: 걷기 · 마우스 조준 후 Space/F: 던지기 · 휠: 확대";
$("hint").textContent = TOUCH ? "탭해서 이동 · ❄️로 던지기" : "Space 또는 F로 눈덩이 던지기";
camera.position.set(0, 10, 20);
$("go").addEventListener("click", () => {
  initAudio(); started = true; yaw = 0; pitch = 0.75;
  $("start").classList.add("hidden"); $("hud").classList.remove("hidden");
});
requestAnimationFrame(frame);
window.__xmas = { state: () => ({ started, hits, got, pos: player.pos.toArray(), balls: balls.length, prints: prints.count }) };
