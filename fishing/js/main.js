import * as THREE from "three";
import { SKINS, createPenguin, animatePenguin, makeNameLabel, setViewYaw, rodTip as penguinRodTip } from "../../shared/penguin.js";
import { runLobby } from "../../shared/lobby.js";
import { FISH, TIERS } from "./fish-data.js";

const $ = id => document.getElementById(id);
const G = 18, FIELD = 46, SPEED = 6, TOUCH = matchMedia("(pointer: coarse)").matches;
const POND = { x: 0, z: -17, r: 12 };
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
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

/* ---------- helpers ---------- */
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a2340, side: THREE.BackSide });
function outlined(m, s = 1.07) { const o = new THREE.Mesh(m.geometry, outlineMat); o.scale.setScalar(s); m.add(o); return m; }
const lambert = c => new THREE.MeshLambertMaterial({ color: c });
function mesh(geo, color, x = 0, y = 0, z = 0, s) {
  const m = new THREE.Mesh(geo, lambert(color)); m.position.set(x, y, z);
  if (s !== undefined) outlined(m, s); return m;
}

/* ---------- ground & pond ---------- */
scene.add(new THREE.Mesh(new THREE.CircleGeometry(FIELD + 40, 48).rotateX(-Math.PI / 2), lambert(0xf6faff)));
for (let i = 0; i < 26; i++) {
  const a = Math.random() * Math.PI * 2, r = FIELD + 4 + Math.random() * 30, s = 5 + Math.random() * 8;
  const hill = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xeaf2ff));
  hill.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); scene.add(hill);
}
const iceRim = new THREE.Mesh(new THREE.RingGeometry(POND.r - 0.2, POND.r + 1.3, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xcfe9ff }));
iceRim.position.set(POND.x, 0.015, POND.z); scene.add(iceRim);
const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3f8fd0 }));
water.position.set(POND.x, 0.03, POND.z); scene.add(water);
const inWater = (x, z, m = 0.6) => Math.hypot(x - POND.x, z - POND.z) < POND.r - m;

/* ---------- obstacles ---------- */
const obstacles = [{ x: POND.x, z: POND.z, r: POND.r + 0.3 }];
function pushOut(p, rad) {
  for (const o of obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + rad;
    if (d < min && d > 1e-4) { p.x = o.x + dx / d * min; p.z = o.z + dz / d * min; }
  }
  const d = Math.hypot(p.x, p.z); if (d > FIELD) { p.x *= FIELD / d; p.z *= FIELD / d; }
}
function pine(x, z, scale = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8), 0x7a4b25, 0, 0.4, 0, 1.12));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.ConeGeometry(1.5 - i * 0.35, 1.8, 10), 0x2f8f58, 0, 1.5 + i, 0, 1.05));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.ConeGeometry(0.9 - i * 0.2, 0.35, 10), 0xffffff, 0, 2.05 + i, 0));
  g.position.set(x, 0, z); g.scale.setScalar(scale); scene.add(g); obstacles.push({ x, z, r: 0.7 * scale });
}
function cabin(x, z, ry) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(5, 3, 4), 0xc98f5a, 0, 1.5, 0, 1.03));
  const roof = mesh(new THREE.ConeGeometry(4.2, 1.8, 4), 0xf4f7ff, 0, 3.9, 0, 1.03); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.8); g.add(roof);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffd98a })); win.position.set(-1, 1.7, 2.02); g.add(win);
  g.add(mesh(new THREE.BoxGeometry(1, 1.8, 0.1), 0x6b3f1e, 1.2, 0.9, 2.02));
  g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); obstacles.push({ x, z, r: 3.2 });
}
function snowman(x, z) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.9, 16, 12), 0xffffff, 0, 0.9, 0, 1.06));
  g.add(mesh(new THREE.SphereGeometry(0.65, 16, 12), 0xffffff, 0, 2.05, 0, 1.06));
  g.add(mesh(new THREE.SphereGeometry(0.45, 16, 12), 0xffffff, 0, 2.95, 0, 1.06));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.45, 12), 0x222222, 0, 3.5, 0));
  g.position.set(x, 0, z); scene.add(g); obstacles.push({ x, z, r: 1 });
}
const sparkle = [];
(function smallTree() {
  const x = 12, z = 6, g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.8, 8), 0x7a4b25, 0, 0.4, 0, 1.1));
  for (const [r, h, y] of [[2, 2, 1.6], [1.5, 1.8, 2.8], [1, 1.5, 3.8]]) g.add(mesh(new THREE.ConeGeometry(r, h, 12), 0x2a8a52, 0, y, 0, 1.04));
  const cols = [0xff4d4d, 0xffd24d, 0x4dc3ff, 0xff8fe0];
  for (let i = 0; i < 16; i++) {
    const t = i / 16, a = t * Math.PI * 7, r = 1.9 * (1 - t) + 0.2;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: cols[i % 4] }));
    m.position.set(Math.cos(a) * r, 1.4 + t * 2.7, Math.sin(a) * r); g.add(m); sparkle.push(m);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xffe066 })); star.position.y = 5; g.add(star);
  g.position.set(x, 0, z); scene.add(g); obstacles.push({ x, z, r: 1.4 });
})();
cabin(-22, 4, 0.6); cabin(24, -6, -0.8);
snowman(-8, 9); snowman(22, 14);
for (let i = 0; i < 46; i++) {
  const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * (FIELD - 10);
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (obstacles.every(o => Math.hypot(x - o.x, z - o.z) > o.r + 2.2) && Math.hypot(x, z - 3) > 6) pine(x, z, 0.9 + Math.random() * 0.7);
}

/* ---------- pond fish shadows ---------- */
const shadows = [];
for (let i = 0; i < 9; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1f5f9a }));
  m.scale.set(1.6, 0.3, 0.6); m.position.y = 0.06; scene.add(m);
  shadows.push({ m, a: Math.random() * 6.28, r: 3 + Math.random() * 7, v: (0.15 + Math.random() * 0.25) * (i % 2 ? 1 : -1) });
}

/* ---------- snowfall ---------- */
const SNOW_N = 700, snowPos = new Float32Array(SNOW_N * 3);
for (let i = 0; i < SNOW_N; i++) { snowPos[i * 3] = (Math.random() - 0.5) * 60; snowPos[i * 3 + 1] = Math.random() * 25; snowPos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, fog: false })); snowPts.frustumCulled = false; scene.add(snowPts);

/* ---------- character ---------- */
function makeChar(color) { const g = createPenguin(color, { rod: true }); scene.add(g); return g; }
const player = { obj: null, pos: new THREE.Vector3(0, 0, -1), facing: Math.PI, target: null, step: 0, side: 1, stride: 0, moving: false, name: "", color: store.get("xmas-skin", 0) };
function setSkin(i) {
  player.color = i; store.set("xmas-skin", i);
  if (player.obj) scene.remove(player.obj);
  player.obj = makeChar(SKINS[i].color);
  if (player.name) player.obj.add(makeNameLabel(player.name, { me: true }));
  player.obj.position.copy(player.pos);
}

/* ---------- 발자국 ---------- */
const prints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.38).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fa6cc, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }), 300);
prints.count = 0; prints.frustumCulled = false; scene.add(prints); let printI = 0;
const dummy = new THREE.Object3D();
function stamp(x, z, ry) {
  dummy.position.set(x, 0.02, z); dummy.rotation.set(0, ry, 0); dummy.updateMatrix();
  prints.setMatrixAt(printI, dummy.matrix); printI = (printI + 1) % 300; prints.count = Math.min(prints.count + 1, 300); prints.instanceMatrix.needsUpdate = true;
}

/* ---------- sound ---------- */
let ac = null, noiseBuf = null, muted = store.get("xmas-muted", false);
function initAudio() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC(); noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function noise(type, f0, f1, dur, vol, q = 1) {
  if (!ac || muted) return;
  const t = ac.currentTime, src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(flt).connect(g).connect(ac.destination); src.start(t); src.stop(t + dur);
}
function tone(freq, dur, vol = 0.2, delay = 0, type = "sine") {
  if (!ac || muted) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
}
const sfx = {
  step() { noise("bandpass", 2200 + Math.random() * 600, 1400, 0.09, 0.12, 1.5); },
  cast() { noise("bandpass", 500, 1800, 0.3, 0.14, 0.8); },
  splash() { noise("lowpass", 1800, 300, 0.35, 0.3); },
  bite() { tone(880, 0.12, 0.25); tone(1320, 0.12, 0.25, 0.1); },
  tick() { noise("highpass", 3000, 2500, 0.04, 0.1); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 0.2, i * 0.1)); },
  lose() { tone(220, 0.3, 0.25, 0, "triangle"); tone(165, 0.4, 0.25, 0.15, "triangle"); },
};
$("mute").textContent = muted ? "🔇" : "🔊";
$("mute").addEventListener("click", () => { muted = !muted; store.set("xmas-muted", muted); $("mute").textContent = muted ? "🔇" : "🔊"; });

/* ---------- effects: puffs, ripples ---------- */
const puffs = [], ripples = [];
const puffGeo = new THREE.SphereGeometry(0.1, 6, 5);
function splash(p, n = 10, color = 0xdff0ff) {
  const mat = new THREE.MeshBasicMaterial({ color });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(puffGeo, mat); m.position.copy(p); scene.add(m);
    puffs.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4), life: 0.6 });
  }
}
function ripple(p) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
  m.position.set(p.x, 0.05, p.z); scene.add(m); ripples.push({ m, life: 1 });
}

/* ---------- fishing ---------- */
const bobber = new THREE.Group();
bobber.add(mesh(new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xe8454b, 0, 0, 0, 1.15));
bobber.add(mesh(new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xffffff, 0, 0, 0, 1.15));
bobber.visible = false; scene.add(bobber);
const LINE_N = 14, linePos = new Float32Array(LINE_N * 3);
const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x1a2340 })); line.frustumCulled = false; line.visible = false; scene.add(line);

const fs = { st: "idle", hold: 0, power: 0, v: new THREE.Vector3(), land: new THREE.Vector3(), biteT: 0, window: 0, fish: null, prog: 0, tens: 0, strug: false, strT: 0, reelT: 0, tickT: 0, resT: 0, bob: 0 };
const bank = { pts: store.get("xmas-fish-pts", 0), cnt: 0, dex: store.get("xmas-fish-dex", {}) };
const hudP = $("pts"), hudC = $("cnt");
hudP.textContent = bank.pts;
let held = false;

function toast(msg, ms = 1800) {
  const t = $("toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), ms);
}
function setHint(s) { $("hint").textContent = s; }
function rodTip(out) { return penguinRodTip(out, player.pos, player.facing); }
function pickFish() {
  const total = FISH.reduce((s, f) => s + f.w, 0); let r = Math.random() * total;
  for (const f of FISH) { r -= f.w; if (r <= 0) return f; }
  return FISH[0];
}
function aimDir() {
  let tx, tz;
  if (mouseSeen && aim) { tx = aim.x - player.pos.x; tz = aim.z - player.pos.z; }
  else { tx = POND.x - player.pos.x; tz = POND.z - player.pos.z; }
  const l = Math.hypot(tx, tz) || 1; return { x: tx / l, z: tz / l };
}

function actionDown() {
  if (!started) return;
  initAudio(); held = true; $("act").classList.add("down");
  if (fs.st === "idle") { fs.st = "charging"; fs.hold = 0; $("power").classList.remove("hidden"); const d = aimDir(); player.facing = Math.atan2(d.x, d.z); player.target = null; setHint("놓으면 던져요"); }
  else if (fs.st === "waiting") { retract("낚싯줄을 감았어요"); }
  else if (fs.st === "bite") { hook(); }
}
function actionUp() {
  held = false; $("act").classList.remove("down");
  if (fs.st === "charging") cast();
}
function cast() {
  $("power").classList.add("hidden");
  const power = Math.min(1, fs.hold / 1.1), dist = 5 + power * 13, d = aimDir();
  const tx = player.pos.x + d.x * dist, tz = player.pos.z + d.z * dist;
  player.facing = Math.atan2(d.x, d.z);
  if (!inWater(tx, tz)) { fs.st = "idle"; toast("물 위로 던져야 해요"); setHint(idleHint()); return; }
  const s = rodTip(new THREE.Vector3()), to = new THREE.Vector3(tx, 0.1, tz), dd = to.clone().sub(s);
  const t = Math.min(1.2, Math.max(0.5, Math.hypot(dd.x, dd.z) / 12));
  fs.v.set(dd.x / t, (dd.y + 0.5 * G * t * t) / t, dd.z / t); // vy = (Δy + ½·g·t²)/t
  fs.land.copy(to); bobber.position.copy(s); bobber.visible = line.visible = true; fs.st = "flying";
  sfx.cast(); setHint("...");
}
function landed() {
  fs.st = "waiting"; fs.biteT = 2 + Math.random() * 5; fs.bob = 0;
  splash(bobber.position, 10); ripple(bobber.position); sfx.splash(); setHint("찌를 지켜보세요 (버튼: 줄 감기)");
}
function retract(msg) { fs.st = "idle"; bobber.visible = line.visible = false; $("reel").classList.add("hidden"); if (msg) toast(msg); setHint(idleHint()); }
function bite() {
  fs.st = "bite"; fs.window = 1.1; fs.fish = pickFish(); new Image().src = fs.fish.img; // 결과 카드 그림을 미리 받아 둠 sfx.bite(); ripple(bobber.position); toast("입질! 지금 눌러요!", 1100); setHint("지금!");
}
function hook() {
  fs.st = "reeling"; fs.prog = 0.18; fs.tens = 0.15; fs.strug = false; fs.strT = 0.8; fs.reelT = 0;
  $("reel").classList.remove("hidden"); $("reel").classList.remove("struggle"); setHint("누르고 있으면 감겨요"); toast("걸렸다!");
}
function finish(ok, reason) {
  $("reel").classList.add("hidden"); bobber.visible = line.visible = false;
  const f = fs.fish; fs.st = "result"; fs.resT = 2.2;
  if (ok) {
    const isNew = !bank.dex[f.id];
    bank.pts += f.pts; bank.cnt++; bank.dex[f.id] = (bank.dex[f.id] || 0) + 1;
    store.set("xmas-fish-pts", bank.pts); store.set("xmas-fish-dex", bank.dex);
    hudP.textContent = bank.pts; hudC.textContent = bank.cnt;
    sessionPts += f.pts; if (net) { net.send({ t: "score", v: sessionPts }); net.send({ t: "ev", k: "catch", v: f.id }); renderPlayers(); }
    const img = $("rimg"); img.src = f.img; img.alt = f.name; $("rname").textContent = f.name; $("rpts").textContent = f.pts ? "+" + f.pts + "점" : "쓸모는 없어요...";
    const tier = $("rtier"); tier.textContent = f.tierLabel; tier.style.background = f.tierCss; $("rnew").classList.toggle("hidden", !isNew); $("result").style.borderColor = f.tierCss;
    $("result").classList.remove("hidden"); sfx.win(); splash(new THREE.Vector3(player.pos.x, 1, player.pos.z).addScaledVector(new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing)), 1.5), 14, f.col);
  } else { toast(reason); sfx.lose(); fs.resT = 0.8; }
  setHint("");
}
function idleHint() { return TOUCH ? "탭해서 이동 · 🎣 길게 눌러 던지기" : "Space(길게)로 던지기 · 클릭으로 이동"; }

function updateFishing(dt, t) {
  const tip = rodTip(new THREE.Vector3());
  if (fs.st === "charging") {
    fs.hold += dt; $("power").firstElementChild.style.width = Math.min(100, fs.hold / 1.1 * 100) + "%";
    if (!held) cast();
  } else if (fs.st === "flying") {
    fs.v.y -= G * dt; bobber.position.addScaledVector(fs.v, dt);
    if (bobber.position.y <= 0.08 && fs.v.y < 0) { bobber.position.y = 0.08; landed(); }
  } else if (fs.st === "waiting") {
    fs.bob += dt; bobber.position.y = 0.08 + Math.sin(fs.bob * 3) * 0.03;
    fs.biteT -= dt; if (fs.biteT <= 0) bite();
  } else if (fs.st === "bite") {
    bobber.position.y = 0.08 - 0.12 * Math.abs(Math.sin(t * 25));
    fs.window -= dt; if (fs.window <= 0) { retract(); toast("놓쳤어요..."); sfx.lose(); }
  } else if (fs.st === "reeling") {
    const f = fs.fish; fs.reelT += dt; fs.strT -= dt;
    if (fs.strT <= 0) { fs.strug = Math.random() < 0.5; fs.strT = 0.5 + Math.random() * 0.7; $("reel").classList.toggle("struggle", fs.strug); }
    if (held) {
      fs.prog += (fs.strug ? 0.04 : 0.2 / Math.sqrt(f.str)) * dt;
      fs.tens += (fs.strug ? 0.9 * f.str : 0.15) * dt;
      fs.tickT -= dt; if (fs.tickT <= 0) { sfx.tick(); fs.tickT = 0.1; }
    } else { fs.tens -= 0.7 * dt; fs.prog -= 0.05 * dt; }
    fs.tens = Math.max(0, fs.tens); fs.prog = Math.max(0, fs.prog);
    $("prog").style.width = Math.min(100, fs.prog * 100) + "%";
    $("tens").style.width = Math.min(100, fs.tens * 100) + "%"; $("tens").classList.toggle("hot", fs.tens > 0.75);
    $("reellabel").textContent = fs.strug ? "버텨요! 손을 떼요!" : "천천히 감아요";
    // 찌를 끌어당김 + 물고기 요동
    const k = Math.min(1, fs.prog);
    bobber.position.x = fs.land.x + (player.pos.x - fs.land.x) * k * 0.85 + (fs.strug ? Math.sin(t * 30) * 0.15 : 0);
    bobber.position.z = fs.land.z + (player.pos.z - fs.land.z) * k * 0.85;
    bobber.position.y = 0.08;
    if (fs.tens >= 1) finish(false, "줄이 끊어졌어요!");
    else if (fs.prog >= 1) finish(true);
    else if (fs.reelT > 22 + f.str * 10) finish(false, "물고기가 도망갔어요"); // 센 물고기일수록 오래 버틸 시간을 줌
  } else if (fs.st === "result") {
    fs.resT -= dt; if (fs.resT <= 0) { fs.st = "idle"; $("result").classList.add("hidden"); setHint(idleHint()); }
  }
  if (line.visible) { // 살짝 처진 낚싯줄
    const b = bobber.position;
    for (let i = 0; i < LINE_N; i++) {
      const u = i / (LINE_N - 1), sag = (fs.st === "reeling" && held ? 0.05 : 0.6) * Math.sin(u * Math.PI);
      linePos[i * 3] = tip.x + (b.x - tip.x) * u; linePos[i * 3 + 1] = tip.y + (b.y - tip.y) * u - sag; linePos[i * 3 + 2] = tip.z + (b.z - tip.z) * u;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }
}

/* ---------- 멀티플레이: 다른 유저(펭귄) ---------- */
let net = null, sessionPts = 0;
const remotes = new Map(), hudPlayers = $("players");
function makeBobberMesh() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xe8454b, 0, 0, 0, 1.15));
  g.add(mesh(new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xffffff, 0, 0, 0, 1.15));
  g.visible = false; scene.add(g); return g;
}
function renderPlayers() {
  hudPlayers.textContent = "";
  if (!net) { hudPlayers.classList.add("hidden"); return; }
  hudPlayers.classList.remove("hidden");
  const rows = [{ name: player.name, score: sessionPts, me: true }, ...[...remotes.values()].map(r => ({ name: r.name, score: r.score }))].sort((a, b) => b.score - a.score);
  const head = document.createElement("div"); head.textContent = (net.serverName || "서버") + " · " + (remotes.size + 1) + "명"; head.style.fontWeight = "700"; hudPlayers.append(head);
  rows.slice(0, 6).forEach(r => { const d = document.createElement("div"); if (r.me) d.className = "me"; d.textContent = r.name + "  " + r.score + "점"; hudPlayers.append(d); });
}
function addRemote(p) {
  if (remotes.has(p.id)) return;
  const obj = createPenguin(SKINS[p.skin % 4].color, { rod: true }); obj.add(makeNameLabel(p.name)); scene.add(obj);
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x1a2340 })); ln.frustumCulled = false; ln.visible = false; scene.add(ln);
  const r = { id: p.id, name: p.name, score: p.hits || 0, obj, pos: new THREE.Vector3(p.x, 0, p.z), tx: p.x, tz: p.z, facing: p.f, tf: p.f, moving: !!p.mv, b: p.b, bob: makeBobberMesh(), ln };
  obj.position.copy(r.pos); remotes.set(p.id, r); renderPlayers();
}
function removeRemote(id) { const r = remotes.get(id); if (r) { scene.remove(r.obj, r.bob, r.ln); remotes.delete(id); renderPlayers(); } }
function clearRemotes() { [...remotes.keys()].forEach(removeRemote); }
const tipV = new THREE.Vector3(), angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function updateRemotes(dt) {
  for (const r of remotes.values()) {
    const k = Math.min(1, dt * 12);
    r.pos.x += (r.tx - r.pos.x) * k; r.pos.z += (r.tz - r.pos.z) * k; r.facing += angDiff(r.tf, r.facing) * k;
    r.obj.position.copy(r.pos);
    animatePenguin(r.obj, { moving: r.moving || Math.hypot(r.tx - r.pos.x, r.tz - r.pos.z) > 0.15, dt, facing: r.facing });
    if (r.b) {
      r.bob.visible = r.ln.visible = true;
      r.bob.position.x += (r.b[0] - r.bob.position.x) * k; r.bob.position.z += (r.b[1] - r.bob.position.z) * k;
      r.bob.position.y = 0.08 + Math.sin(performance.now() / 330 + r.id) * 0.03;
      const a = r.ln.geometry.attributes.position.array;
      penguinRodTip(tipV, r.pos, r.facing); a[0] = tipV.x; a[1] = tipV.y; a[2] = tipV.z;
      a[3] = r.bob.position.x; a[4] = r.bob.position.y; a[5] = r.bob.position.z;
      r.ln.geometry.attributes.position.needsUpdate = true;
    } else { r.bob.visible = r.ln.visible = false; }
  }
}
function onNet(m) {
  switch (m.t) {
    case "join": addRemote(m.p); toast(m.p.name + " 님이 입장했어요", 1800); break;
    case "leave": { const r = remotes.get(m.id); if (r) toast(r.name + " 님이 나갔어요", 1800); removeRemote(m.id); break; }
    case "s": { const r = remotes.get(m.id); if (r) {
      r.tx = m.x; r.tz = m.z; r.tf = m.f; r.moving = !!m.mv;
      if (m.b && !r.b) r.bob.position.set(m.b[0], 0.08, m.b[1]);
      r.b = m.b; } break; }
    case "score": { const r = remotes.get(m.id); if (r) { r.score = m.v; renderPlayers(); } break; }
    case "ev": {
      const r = remotes.get(m.id), f = FISH.find(x => x.id === m.v);
      if (r && m.k === "catch" && f) { toast(`${r.name} 님이 [${f.tierLabel}] ${f.name}을(를) 낚았어요!`, 2200); splash(r.bob.position, 8); }
      break;
    }
  }
}
let netT = 0;
function netTick(dt) {
  if (!net) return;
  netT += dt; if (netT < 0.1) return; netT = 0;
  net.send({ t: "s", x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), f: +player.facing.toFixed(2), mv: player.moving ? 1 : 0, b: bobber.visible ? [+bobber.position.x.toFixed(2), +bobber.position.z.toFixed(2)] : null });
}

/* ---------- input ---------- */
const keys = {};
let yaw = Math.PI, pitch = 0.55, dist = 12, aim = null, mouseSeen = false, started = false;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function groundAt(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3(); return ray.ray.intersectPlane(plane, p) ? p : null;
}
let drag = null;
canvas.addEventListener("pointerdown", e => {
  if (!started) return; initAudio();
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => {
  if (e.pointerType === "mouse") { mouseSeen = true; const p = groundAt(e.clientX, e.clientY); if (p) aim = p; }
  if (!drag || e.pointerId !== drag.id) return;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
  if (drag.moved) { yaw -= (e.clientX - drag.x) * 0.006; pitch = Math.min(1.3, Math.max(0.15, pitch + (e.clientY - drag.y) * 0.005)); camLock = 2; }
  drag.x = e.clientX; drag.y = e.clientY;
});
canvas.addEventListener("pointerup", e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && performance.now() - drag.t < 450 && fs.st === "idle") { const p = groundAt(e.clientX, e.clientY); if (p) player.target = p; }
  drag = null;
});
canvas.addEventListener("pointercancel", () => { drag = null; });
canvas.addEventListener("wheel", e => { dist = Math.min(24, Math.max(6, dist + Math.sign(e.deltaY) * 1.2)); e.preventDefault(); }, { passive: false });
canvas.addEventListener("contextmenu", e => e.preventDefault());
addEventListener("keydown", e => {
  if (!started) return; initAudio();
  const k = e.key.toLowerCase();
  if (k === " " || k === "f") { e.preventDefault(); if (!e.repeat) actionDown(); return; }
  keys[k] = true;
});
addEventListener("keyup", e => { const k = e.key.toLowerCase(); if (k === " " || k === "f") actionUp(); keys[k] = false; });
const act = $("act");
act.addEventListener("pointerdown", e => { e.preventDefault(); act.setPointerCapture(e.pointerId); actionDown(); });
act.addEventListener("pointerup", actionUp);
act.addEventListener("pointercancel", actionUp);
addEventListener("blur", () => { if (held) actionUp(); });

/* ---------- update ---------- */
const tmp = new THREE.Vector3();
let camLock = 0;
function updatePlayer(dt) {
  let mx = 0, mz = 0;
  if (fs.st === "idle") {
    const f = (keys["w"] || keys["arrowup"] ? 1 : 0) - (keys["s"] || keys["arrowdown"] ? 1 : 0);
    const r = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
    if (f || r) { player.target = null; mx = -Math.sin(yaw) * f + Math.cos(yaw) * r; mz = -Math.cos(yaw) * f - Math.sin(yaw) * r; }
    else if (player.target) {
      const dx = player.target.x - player.pos.x, dz = player.target.z - player.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.2) player.target = null; else { mx = dx / d; mz = dz / d; }
    }
  }
  const len = Math.hypot(mx, mz), moving = len > 0.01;
  if (moving) {
    mx /= len; mz /= len; const before = player.pos.clone();
    player.pos.x += mx * SPEED * dt; player.pos.z += mz * SPEED * dt; pushOut(player.pos, 0.45);
    if (before.distanceTo(player.pos) < SPEED * dt * 0.2) player.target = null;
    player.facing = Math.atan2(mx, mz); player.step += before.distanceTo(player.pos);
    if (player.step > 0.55) { player.step = 0; player.side = -player.side; stamp(player.pos.x + Math.cos(player.facing) * 0.2 * player.side, player.pos.z - Math.sin(player.facing) * 0.2 * player.side, player.facing); sfx.step(); }
  }
  player.moving = moving;
  player.obj.position.copy(player.pos);
  animatePenguin(player.obj, { moving, dt, facing: player.facing });
}
function updateCamera(dt) {
  camLock = Math.max(0, camLock - dt);
  if (fs.st !== "idle" && camLock <= 0) { // 낚시 중에는 호수가 보이도록 캐릭터 뒤로 회전
    const target = player.facing + Math.PI; let d = target - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * Math.min(1, dt * 3);
  }
  const cp = Math.cos(pitch), tx = player.pos.x, ty = 1.3, tz = player.pos.z;
  tmp.set(tx + Math.sin(yaw) * cp * dist, ty + Math.sin(pitch) * dist, tz + Math.cos(yaw) * cp * dist);
  camera.position.lerp(tmp, 0.2); camera.lookAt(tx, ty, tz);
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
  setViewYaw(yaw); // 보는 각도에 맞는 펭귄 그림을 고르기 위해 카메라 방향을 알려 줌
  if (started) { updatePlayer(dt); updateFishing(dt, t); updateRemotes(dt); netTick(dt); } else { yaw += dt * 0.15; animatePenguin(player.obj, { moving: false, dt, facing: t }); }
  for (const s of shadows) { s.a += s.v * dt; s.m.position.x = POND.x + Math.cos(s.a) * s.r; s.m.position.z = POND.z + Math.sin(s.a) * s.r; s.m.rotation.y = -s.a + (s.v > 0 ? -Math.PI / 2 : Math.PI / 2); }
  for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i]; q.life -= dt; q.v.y -= 10 * dt; q.m.position.addScaledVector(q.v, dt); q.m.scale.setScalar(Math.max(0.01, q.life * 1.8)); if (q.life <= 0) { scene.remove(q.m); puffs.splice(i, 1); } }
  for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.life -= dt * 1.2; const s = 0.3 + (1 - r.life) * 2.2; r.m.scale.set(s, 1, s); r.m.material.opacity = Math.max(0, r.life) * 0.8; if (r.life <= 0) { scene.remove(r.m); ripples.splice(i, 1); } }
  const a = snowGeo.attributes.position.array;
  for (let i = 0; i < SNOW_N; i++) {
    const k = i * 3; a[k + 1] -= (1.5 + (i % 5) * 0.4) * dt; a[k] += Math.sin(a[k + 1] + i) * 0.3 * dt;
    if (a[k + 1] < 0) a[k + 1] = 25;
    if (a[k] - player.pos.x > 30) a[k] -= 60; else if (a[k] - player.pos.x < -30) a[k] += 60;
    if (a[k + 2] - player.pos.z > 30) a[k + 2] -= 60; else if (a[k + 2] - player.pos.z < -30) a[k + 2] += 60;
  }
  snowGeo.attributes.position.needsUpdate = true;
  sparkle.forEach((m, i) => m.scale.setScalar(0.8 + 0.4 * (0.5 + 0.5 * Math.sin(t * 3 + i))));
  updateCamera(dt); renderer.render(scene, camera); requestAnimationFrame(frame);
}

/* ---------- 도감 UI ---------- */
function renderDex() {
  const ul = $("dexlist"); ul.textContent = "";
  let got = 0;
  for (const f of FISH) {
    const n = bank.dex[f.id] || 0; if (n) got++;
    const li = document.createElement("li"); li.className = n ? "got" : "unk"; li.style.setProperty("--tier", f.tierCss);
    const im = document.createElement("img"); im.src = f.img; im.alt = n ? f.name : "미발견"; im.loading = "lazy"; im.width = 80; im.height = 64;
    const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = n ? f.name : "???";
    const meta = document.createElement("span"); meta.className = "meta"; meta.textContent = n ? `${f.tierLabel} · ${f.pts}점 · ×${n}` : f.tierLabel;
    li.append(im, nm, meta); ul.appendChild(li);
  }
  $("dextitle").textContent = `📖 물고기 도감 ${got}/${FISH.length}`;
}
$("dexbtn").addEventListener("click", () => { renderDex(); $("dex").classList.remove("hidden"); });
$("dexclose").addEventListener("click", () => $("dex").classList.add("hidden"));

/* ---------- 시작 화면(닉네임·서버 선택) ---------- */
camera.position.set(0, 8, 14);
setSkin(player.color); // 로비 뒤에서 미리보기
runLobby({
  root: $("start"), title: "🎣 겨울 호수 낚시", subtitle: "펭귄이 되어 크리스마스 물고기를 잡아요.",
  howto: TOUCH ? "탭: 이동 · 드래그: 카메라 · 🎣 길게 눌러 던지기 → 입질에 탭 → 누르고 감기" : "클릭/WASD: 이동 · 드래그: 카메라 · Space(길게): 던지기 → 입질에 Space → 누르고 감기",
  onSkin: i => setSkin(i),
}).then(sess => {
  player.name = sess.name; setSkin(sess.skin);
  player.pos.set((Math.random() - 0.5) * 10, 0, -1 + Math.random() * 3); player.obj.position.copy(player.pos);
  initAudio(); started = true; yaw = Math.PI; pitch = 0.55;
  $("hud").classList.remove("hidden"); setHint(idleHint());
  net = sess.net;
  if (net) {
    net.serverName = sess.welcome.server.name; net.onmessage = onNet;
    net.onclose = () => { toast("서버와 연결이 끊겼어요. 혼자 계속해요."); clearRemotes(); net = null; renderPlayers(); };
    sess.welcome.players.filter(p => p.id !== net.id).forEach(addRemote);
    toast(net.serverName + "에 입장했어요", 2500);
  } else toast("호수를 향해 낚싯줄을 던져요", 2500);
  renderPlayers();
});
requestAnimationFrame(frame);
window.__fish = { remote: id => { const r = remotes.get(id); return r && { b: r.b, bobVisible: r.bob.visible, score: r.score }; }, state: () => ({ started, online: !!net, remotes: remotes.size, name: player.name, id: net && net.id, st: fs.st, pts: bank.pts, cnt: bank.cnt, fish: fs.fish && fs.fish.id, prog: fs.prog, tens: fs.tens, prints: prints.count }), fastBite: () => { if (fs.st === "waiting") fs.biteT = 0.05; }, setFish: id => { const f = FISH.find(x => x.id === id); if (f) { fs.fish = f; new Image().src = f.img; } }, count: FISH.length };
