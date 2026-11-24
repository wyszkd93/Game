// 펭귄 캐릭터 (기본 도형으로 조립) · 이름표 · 걷기 애니메이션. 'three'는 각 페이지의 importmap으로 연결됩니다.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export const SKINS = [
  { name: "빨강", color: 0xd0303e }, { name: "초록", color: 0x3e9a4a },
  { name: "파랑", color: 0x4a93d8 }, { name: "분홍", color: 0xf07fa8 },
];

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x191c44, side: THREE.BackSide });
// 만화풍(셀) 음영: 밝기를 3단계로 끊어 평평한 일러스트 느낌을 냅니다
const toonGradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([170, 170, 170, 255, 225, 225, 225, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const lambert = c => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGradient });
function part(geo, color, x = 0, y = 0, z = 0, outline = 1.06) {
  const m = new THREE.Mesh(geo, lambert(color));
  m.position.set(x, y, z);
  if (outline) { const o = new THREE.Mesh(geo, outlineMat); o.scale.setScalar(outline); m.add(o); }
  return m;
}

/* ---------- 3D 모델(.glb) 지원 ----------
 * shared/assets/penguin.glb 가 있으면 모든 펭귄이 그 모델을 쓰고, 없거나 읽기 실패하면 아래 도형 펭귄으로 대체됩니다.
 * 규칙은 shared/assets/README.md 참고. (앞쪽은 +Z, 발은 y=0 근처, 크기는 자동 보정)
 */
const MODEL_URL = new URL("./assets/penguin.glb", import.meta.url).href;
const MODEL_HEIGHT = 2.3;   // 게임 안에서의 키(모자 포함)
const MODEL_YAW = 0;        // 모델이 뒤를 보고 있으면 Math.PI 로 바꾸세요
const TINT_RE = /hat|scarf|santa|cap|muffler|모자|목도리/i;
let template = null;
try {
  const head = await fetch(MODEL_URL, { method: "HEAD" });
  if (head.ok) template = await new GLTFLoader().loadAsync(MODEL_URL);
} catch (e) { console.info("penguin.glb 없음 또는 읽기 실패 → 기본 펭귄을 사용합니다", e && e.message); }
export const usingModel = !!template;

function outlineMaterial(width) {
  const m = new THREE.MeshBasicMaterial({ color: 0x1a2340, side: THREE.BackSide });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n transformed += normalize(normal) * ${width.toFixed(5)};`); };
  return m;
}

function createFromModel(color, { rod }) {
  const g = new THREE.Group(), body = new THREE.Group();
  const root = SkeletonUtils.clone(template.scene);
  root.rotation.y = MODEL_YAW;
  // 크기·위치 보정: 키를 맞추고, 발을 y=0, 가운데를 원점에
  let box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  const s = MODEL_HEIGHT / Math.max(size.y, 1e-4);
  root.scale.multiplyScalar(s);
  box = new THREE.Box3().setFromObject(root);
  root.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const ow = outlineMaterial(0.035 / s), hulls = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map(m => { // 색 입히기용으로 재질 복제
      const c = m.clone(); if (TINT_RE.test(m.name || "") || TINT_RE.test(o.name || "")) c.color.set(color); return c;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
    if (o.isSkinnedMesh) { const h = new THREE.SkinnedMesh(o.geometry, ow); h.bind(o.skeleton, o.bindMatrix); h.position.copy(o.position); h.quaternion.copy(o.quaternion); h.scale.copy(o.scale); hulls.push([o.parent, h]); }
    else hulls.push([o, new THREE.Mesh(o.geometry, ow)]);
  });
  hulls.forEach(([parent, h]) => parent.add(h));
  body.add(root);
  if (rod) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 2.4, 6), lambert(0x6b3f1e));
    r.position.set(0.6, 1.0, 0.8); r.rotation.x = Math.PI / 2 - 0.55; body.add(r);
  }
  g.add(body);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5b6f99, transparent: true, opacity: 0.35 }));
  blob.position.y = 0.03; g.add(blob);
  g.userData = { body, feet: [], flippers: [], stride: 0, wobble: 0 };
  const clips = template.animations || [];
  if (clips.length) { // walk/idle 클립이 있으면 재생
    const mixer = new THREE.AnimationMixer(root), find = re => clips.find(c => re.test(c.name));
    const walk = find(/walk|run|waddle/i) || clips[0], idle = find(/idle|stand|breath/i) || null;
    const actions = { walk: mixer.clipAction(walk), idle: idle && idle !== walk ? mixer.clipAction(idle) : null };
    (actions.idle || actions.walk).play();
    Object.assign(g.userData, { mixer, actions, current: actions.idle ? "idle" : "walk" });
  }
  return g;
}

/** 산타 모자와 목도리(skin 색)를 두른 펭귄. .glb 모델이 있으면 그것을, 없으면 도형 펭귄을 만듭니다. */
export function createPenguin(color, opts = {}) {
  return template ? createFromModel(color, { rod: !!opts.rod }) : createProceduralPenguin(color, opts);
}

function createProceduralPenguin(color, { rod = false } = {}) {
  // 시안(둥근 2등신 아기 펭귄): 큰 머리, 하트형 흰 얼굴, 큰 흰 배, 한쪽으로 처진 산타 모자, 꼬리 달린 목도리
  const g = new THREE.Group(), body = new THREE.Group();
  const navy = 0x3c4469, orange = 0xff9f43, S = (m, x, y, z) => { m.scale.set(x, y, z); return m; };
  const basic = c => new THREE.MeshBasicMaterial({ color: c });
  const flat = (geo, c, x, y, z) => { const m = new THREE.Mesh(geo, lambert(c)); m.position.set(x, y, z); return m; }; // 외곽선 없는 부품

  // 몸통 + 머리 (머리가 몸보다 살짝 넓음)
  body.add(S(part(new THREE.SphereGeometry(0.72, 24, 18), navy, 0, 0.78, 0, 1.05), 1.0, 1.0, 0.95));
  body.add(S(part(new THREE.SphereGeometry(0.72, 24, 18), navy, 0, 1.62, 0, 1.05), 1.12, 0.98, 1.0));
  // 배
  body.add(S(flat(new THREE.SphereGeometry(0.5, 20, 16), 0xffffff, 0, 0.7, 0.36), 1.0, 1.1, 0.8));
  body.add(S(flat(new THREE.SphereGeometry(0.46, 20, 12), 0xdbe6f5, 0, 0.3, 0.24), 1.0, 0.45, 0.8)); // 배 아래 연한 그늘
  // 하트형 흰 얼굴 (왼쪽·오른쪽 두 덩어리)
  for (const sx of [-1, 1]) body.add(S(flat(new THREE.SphereGeometry(0.4, 22, 16), 0xffffff, sx * 0.29, 1.52, 0.5), 1.0, 1.05, 0.55));
  body.add(S(flat(new THREE.SphereGeometry(0.3, 18, 12), 0xffffff, 0, 1.36, 0.56), 1.25, 0.75, 0.5)); // 두 덩어리 아래를 이어 하트 모양으로
  // 눈(점 + 하이라이트), 부리, 볼터치
  const eyeB = basic(0x10132e), hi = basic(0xffffff);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), eyeB); e.position.set(sx * 0.3, 1.58, 0.7); e.scale.set(1, 1.1, 0.6); body.add(e);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), hi); h.position.set(sx * 0.3 + 0.025, 1.62, 0.735); body.add(h);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), basic(0xffb6b6)); b.position.set(sx * 0.52, 1.38, 0.62); b.scale.set(1.2, 0.75, 0.3); b.rotation.y = sx * 0.55; body.add(b);
  }
  const beak = part(new THREE.SphereGeometry(0.15, 14, 10), orange, 0, 1.47, 0.71, 1.12); beak.scale.set(1.2, 0.62, 0.75); body.add(beak);

  // 목도리 (두툼한 띠 + 앞쪽으로 늘어진 꼬리)
  const scarf = S(part(new THREE.TorusGeometry(0.67, 0.17, 12, 28), color, 0, 1.05, 0.02, 1.07), 1.08, 0.95, 1); scarf.rotation.x = Math.PI / 2; body.add(scarf);
  const tail = part(new THREE.BoxGeometry(0.26, 0.58, 0.14), color, 0.3, 0.74, 0.74, 1.12); tail.rotation.z = 0.1; body.add(tail);

  // 산타 모자: 흰 챙 + 둥근 모자 + 옆으로 처진 끝 + 폼폼
  const brim = S(part(new THREE.TorusGeometry(0.68, 0.16, 12, 28), 0xffffff, 0, 2.13, 0, 1.07), 1.08, 1, 0.98); brim.rotation.x = Math.PI / 2 - 0.12; body.add(brim);
  const dome = S(part(new THREE.SphereGeometry(0.66, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), color, 0, 2.16, 0, 1.06), 1.05, 0.98, 1.0); body.add(dome);
  [[0.2, 2.62, 0.42], [0.44, 2.6, 0.35], [0.65, 2.52, 0.28], [0.83, 2.42, 0.22]].forEach(([x, y, r]) => body.add(part(new THREE.SphereGeometry(r, 16, 12), color, x, y, 0, 1.08))); // 옆으로 처지는 모자 끝
  body.add(part(new THREE.SphereGeometry(0.2, 14, 12), 0xffffff, 0.98, 2.34, 0, 1.12));

  // 날개(어깨 축으로 회전) · 발
  const flippers = [-1, 1].map(sx => {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.78, 1.1, 0);
    pivot.add(S(part(new THREE.SphereGeometry(0.22, 12, 10), navy, 0, -0.34, 0, 1.1), 0.5, 1.7, 0.9));
    pivot.userData.sx = sx; body.add(pivot); return pivot;
  });
  if (rod) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 2.4, 6), lambert(0x6b3f1e));
    r.position.set(0.1, -0.55, 0.9); r.rotation.x = Math.PI / 2 - 0.55; flippers[1].add(r);
  }
  g.add(body);
  const feet = [-1, 1].map(sx => { const f = S(part(new THREE.SphereGeometry(0.2, 12, 10), orange, sx * 0.32, 0.08, 0.28, 1.12), 1.1, 0.42, 1.5); g.add(f); return f; });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5b6f99, transparent: true, opacity: 0.35 }));
  blob.position.y = 0.03; g.add(blob);
  g.userData = { body, feet, flippers, stride: 0, wobble: 0, footZ: 0.28, flipBase: 0.8 };
  return g;
}

/** 걷기(뒤뚱뒤뚱)·맞았을 때 흔들림 애니메이션. st = { moving, dt, facing } */
export function animatePenguin(g, { moving, dt, facing }) {
  const u = g.userData;
  if (u.mixer) { // 모델의 애니메이션 클립
    const want = moving || !u.actions.idle ? "walk" : "idle";
    if (want !== u.current && u.actions[want]) { const a = u.actions[want], b = u.actions[u.current]; a.reset().play(); if (b) a.crossFadeFrom(b, 0.2, false); u.current = want; }
    if (!moving && !u.actions.idle) u.actions.walk.paused = true; else u.actions.walk.paused = false;
    u.mixer.update(dt);
  }
  if (moving) u.stride += dt * 11;
  const s = Math.sin(u.stride);
  u.wobble = Math.max(0, u.wobble - dt);
  const hit = u.wobble > 0 ? Math.sin(u.wobble * 40) * 0.35 * (u.wobble / 0.5) : 0;
  const proc = !u.mixer; // 클립이 없는 모델은 뒤뚱 흔들림을 코드로 대신함
  u.body.position.y = moving && proc ? Math.abs(s) * 0.07 : 0;
  u.body.rotation.z = (moving && proc ? s * 0.13 : 0) + hit;
  if (u.feet.length) { // 모델에는 발/날개 부품이 따로 없을 수 있음
    u.feet[0].position.z = u.footZ + (moving ? s * 0.16 : 0);
    u.feet[1].position.z = u.footZ - (moving ? s * 0.16 : 0);
  }
  u.flippers.forEach(p => { p.rotation.z = -p.userData.sx * (u.flipBase + (moving ? 0.3 * s : 0)); });
  if (facing !== undefined) g.rotation.y = facing;
}
export function hitPenguin(g) { g.userData.wobble = 0.5; }

/** 머리 위 닉네임 표시 (canvas 텍스트라 HTML 삽입 위험이 없습니다) */
export function makeNameLabel(text, { me = false } = {}) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const x = c.getContext("2d"); x.font = '700 28px Galmuri11, "Apple SD Gothic Neo", sans-serif'; x.textAlign = "center"; x.textBaseline = "middle";
  const w = Math.min(244, x.measureText(text).width + 28);
  x.fillStyle = me ? "rgba(232,69,75,.92)" : "rgba(22,33,62,.82)";
  x.beginPath(); x.roundRect((256 - w) / 2, 8, w, 48, 14); x.fill();
  x.fillStyle = "#fff"; x.fillText(text, 128, 33, 232);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(2.4, 0.6, 1); s.position.y = 3.45; s.renderOrder = 10;
  return s;
}
