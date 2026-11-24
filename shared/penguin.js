// 펭귄 캐릭터 (기본 도형으로 조립) · 이름표 · 걷기 애니메이션. 'three'는 각 페이지의 importmap으로 연결됩니다.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export const SKINS = [
  { name: "빨강", color: 0xe8454b }, { name: "초록", color: 0x3fbf7f },
  { name: "파랑", color: 0x4aa3ff }, { name: "분홍", color: 0xff8fc2 },
];

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a2340, side: THREE.BackSide });
const lambert = c => new THREE.MeshLambertMaterial({ color: c });
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
  const g = new THREE.Group(), body = new THREE.Group();
  const navy = 0x26325a, orange = 0xffa733;

  const torso = part(new THREE.SphereGeometry(0.62, 20, 16), navy, 0, 0.88, 0, 1.06);
  torso.scale.set(1, 1.15, 0.95); body.add(torso);
  const belly = part(new THREE.SphereGeometry(0.5, 16, 12), 0xffffff, 0, 0.8, 0.3, 0);
  belly.scale.set(0.85, 1, 0.5); body.add(belly);
  body.add(part(new THREE.SphereGeometry(0.46, 20, 16), navy, 0, 1.62, 0, 1.06));
  const face = part(new THREE.SphereGeometry(0.34, 14, 10), 0xffffff, 0, 1.58, 0.2, 0);
  face.scale.set(1, 0.8, 0.55); body.add(face);

  const eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff }), eyeB = new THREE.MeshBasicMaterial({ color: 0x14182b });
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), eyeW); w.position.set(sx * 0.17, 1.7, 0.36); body.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeB); p.position.set(sx * 0.17, 1.7, 0.45); body.add(p);
  }
  const beak = part(new THREE.ConeGeometry(0.1, 0.3, 10), orange, 0, 1.56, 0.52, 1.08); beak.rotation.x = Math.PI / 2; body.add(beak);

  const scarf = part(new THREE.TorusGeometry(0.43, 0.1, 8, 20), color, 0, 1.26, 0, 1.06); scarf.rotation.x = Math.PI / 2; body.add(scarf);
  const hat = part(new THREE.ConeGeometry(0.4, 0.75, 14), color, 0, 2.2, 0, 1.06); hat.rotation.z = 0.12; body.add(hat);
  body.add(part(new THREE.TorusGeometry(0.4, 0.09, 8, 18), 0xffffff, 0, 1.92, 0, 0)).children.at(-1).rotation.x = Math.PI / 2;
  body.add(part(new THREE.SphereGeometry(0.12, 10, 8), 0xffffff, 0.1, 2.6, 0, 0));

  const flippers = [-1, 1].map(sx => { // 어깨 위치를 축으로 회전
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.6, 1.2, 0);
    const f = part(new THREE.SphereGeometry(0.2, 10, 8), navy, 0, -0.32, 0, 1.08); f.scale.set(0.4, 1.5, 0.8); pivot.add(f);
    pivot.userData.sx = sx; body.add(pivot); return pivot;
  });
  if (rod) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 2.4, 6), lambert(0x6b3f1e));
    r.position.set(0.1, -0.55, 0.9); r.rotation.x = Math.PI / 2 - 0.55; flippers[1].add(r);
  }
  g.add(body);
  const feet = [-1, 1].map(sx => { const f = part(new THREE.SphereGeometry(0.2, 10, 8), orange, sx * 0.25, 0.08, 0.22, 1.1); f.scale.set(1, 0.4, 1.4); g.add(f); return f; });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5b6f99, transparent: true, opacity: 0.35 }));
  blob.position.y = 0.03; g.add(blob);
  g.userData = { body, feet, flippers, stride: 0, wobble: 0 };
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
    u.feet[0].position.z = 0.22 + (moving ? s * 0.16 : 0);
    u.feet[1].position.z = 0.22 - (moving ? s * 0.16 : 0);
  }
  u.flippers.forEach(p => { p.rotation.z = -p.userData.sx * (0.25 + (moving ? 0.3 * s : 0)); });
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
  s.scale.set(2.4, 0.6, 1); s.position.y = 3.2; s.renderOrder = 10;
  return s;
}
