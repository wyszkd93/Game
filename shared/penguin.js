// 펭귄 캐릭터 (기본 도형으로 조립) · 이름표 · 걷기 애니메이션. 'three'는 각 페이지의 importmap으로 연결됩니다.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export const SKINS = [
  { name: "빨강", color: 0xd0303e }, { name: "초록", color: 0x3e9a4a },
  { name: "파랑", color: 0x4a93d8 }, { name: "분홍", color: 0xf07fa8 },
];

// 만화풍(셀) 음영: 밝기를 3단계로 끊어 평평한 일러스트 느낌을 냅니다
const toonGradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([170, 170, 170, 255, 225, 225, 225, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const lambert = c => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGradient });
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

const hullCache = new Map();
/** 외곽선 껍질 재질: 표면 법선 방향으로 width 만큼 밀어낸 뒷면. 모양·중심점과 무관하게 본체에 딱 붙고 두께가 균일합니다. */
function outlineMaterial(width) {
  const key = width.toFixed(4);
  if (hullCache.has(key)) return hullCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color: 0x191c44, side: THREE.BackSide });
  m.customProgramCacheKey = () => "penguin-hull";
  m.onBeforeCompile = sh => {
    sh.uniforms.uHull = { value: width };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uHull;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n transformed += normalize(normal) * uHull;");
  };
  hullCache.set(key, m);
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

// 공용 지오메트리·재질은 한 번만 만들어 모든 펭귄이 나눠 씁니다 (몸 형태 코드는 Gemini가 만든 시안 코드를 바탕으로 다듬음)
let K = null;
function kit() {
  if (K) return K;
  const mat = c => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGradient });
  // 변형한 지오메트리는 솔기(중복 꼭짓점)를 합치고 법선을 다시 계산해야 외곽선에 갈라진 틈이 안 생깁니다
  const smooth = geo => { geo.deleteAttribute("uv"); geo.deleteAttribute("normal"); const g = mergeVertices(geo, 1e-4); g.computeVertexNormals(); return g; };
  const warp = (geo, fn) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const [x, y, z] = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); } return smooth(geo); };
  const sph = new Map(), ball = r => { if (!sph.has(r)) sph.set(r, new THREE.SphereGeometry(r, 24, 18)); return sph.get(r); };
  const g = {
    ball,
    // 달걀형 몸통: 아래가 넓고 위가 좁음 (위아래로 눌리지 않게 y 배율 1.0)
    torso: warp(new THREE.SphereGeometry(0.74, 36, 28), (x, y, z) => { const t = (y + 0.74) / 1.48; return [x * (1.07 - t * 0.12), y, z * (0.95 - t * 0.08)]; }),
    // 몸통보다 살짝 크고 넓은 머리 (볼이 약간 튀어나옴)
    head: warp(new THREE.SphereGeometry(0.7, 36, 28), (x, y, z) => { const t = (y + 0.7) / 1.4; return [x * (1.1 - Math.pow(t - 0.4, 2) * 0.3), y * 0.99, z * 0.96]; }),
    flipper: warp(new THREE.SphereGeometry(0.24, 22, 16), (x, y, z) => { const taper = 1 - Math.max(0, -y / 0.24) * 0.35; return [x * 0.55 * taper, y * 1.45, z * 0.88 * taper]; }),
    foot: warp(new THREE.SphereGeometry(0.17, 22, 14), (x, y, z) => [x * 0.92 * (1 + Math.max(0, z / 0.17) * 0.22), y * 0.44, z * 1.28]),
    torus: (R, r) => new THREE.TorusGeometry(R, r, 20, 40),
  };
  g.belly = new THREE.SphereGeometry(1, 32, 24);
  { const p = g.belly.attributes.position, c = new Float32Array(p.count * 3), lo = new THREE.Color(0xd3e0f4), hi = new THREE.Color(0xffffff), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) { t.copy(hi).lerp(lo, THREE.MathUtils.smoothstep(-p.getY(i), 0.35, 0.95)); c.set([t.r, t.g, t.b], i * 3); }
    g.belly.setAttribute("color", new THREE.BufferAttribute(c, 3)); }
  // 목도리 꼬리: 모서리가 둥근 직사각형을 도톰하게
  const sh = new THREE.Shape(), w = 0.125, h = 0.34, r = 0.04;
  sh.moveTo(-w + r, 0); sh.lineTo(w - r, 0); sh.quadraticCurveTo(w, 0, w, -r); sh.lineTo(w + 0.015, -h + r); sh.quadraticCurveTo(w + 0.015, -h, w - r, -h);
  sh.lineTo(-w + r, -h); sh.quadraticCurveTo(-w - 0.015, -h, -w - 0.015, -h + r); sh.lineTo(-w, -r); sh.quadraticCurveTo(-w, 0, -w + r, 0);
  g.scarfTail = new THREE.ExtrudeGeometry(sh, { depth: 0.075, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 4 }); g.scarfTail.center();
  g.scarfTail = smooth(g.scarfTail);
  // 산타 모자: 하나의 매끈한 관(둥근 머리 → 옆·아래로 처짐 → 끝에서 폼폼). 본체와 외곽선이 같은 지오메트리라서 어긋나지 않음.
  const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [0.01, 0.24, 0], [0.08, 0.44, 0], [0.26, 0.57, 0], [0.5, 0.58, 0], [0.7, 0.46, 0], [0.8, 0.28, 0]].map(a => new THREE.Vector3(...a)));
  const radii = [0.5, 0.49, 0.46, 0.39, 0.31, 0.25, 0.21], SEG = 48, RAD = 28;
  const tube = new THREE.TubeGeometry(curve, SEG, 1, RAD, false), tp = tube.attributes.position, centers = curve.getSpacedPoints(SEG);
  for (let i = 0; i <= SEG; i++) {
    const f = (i / SEG) * (radii.length - 1), i0 = Math.floor(f), i1 = Math.min(i0 + 1, radii.length - 1), rr = THREE.MathUtils.lerp(radii[i0], radii[i1], f - i0), c = centers[i];
    for (let k = 0; k <= RAD; k++) { const v = i * (RAD + 1) + k; tp.setXYZ(v, c.x + (tp.getX(v) - c.x) * rr, c.y + (tp.getY(v) - c.y) * rr, c.z + (tp.getZ(v) - c.z) * rr * 0.96); }
  }
  g.hat = smooth(tube); g.hatTip = curve.getPoint(1);
  K = { g, body: mat(0x3c4469), white: mat(0xf7f9fc), bellyMat: new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: toonGradient, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), faceMat: new THREE.MeshToonMaterial({ color: 0xf7f9fc, gradientMap: toonGradient, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), orange: mat(0xf39223), eye: mat(0x161936), cheek: mat(0xf6a6b2), mat };
  return K;
}

function createProceduralPenguin(color, { rod = false } = {}) {
  const { g: G, body: bodyMat, white, bellyMat, faceMat, orange, eye, cheek, mat } = kit();
  const outfit = mat(color);
  const root = new THREE.Group(), bodyGroup = new THREE.Group(); root.add(bodyGroup);
  // w = 외곽선 두께(월드 단위, 약 1.045배). 법선 방향으로 밀어내므로 부품이 어디에 있든 균일합니다
  const add = (parent, geo, material, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], w = 0.032, noOutline = false } = {}) => {
    const m = new THREE.Mesh(geo, material); m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scale); parent.add(m);
    if (!noOutline) m.add(new THREE.Mesh(geo, outlineMaterial(w)));
    return m;
  };
  const E = (rx, ry, rz) => [rx, ry, rz]; // 단위 구를 타원체로 쓸 때의 반지름
  const unit = G.ball(1);
  // 몸통·머리·배
  add(bodyGroup, G.torso, bodyMat, { pos: [0, 0.74, 0] });
  add(bodyGroup, G.head, bodyMat, { pos: [0, 1.5, 0.01] });
  add(bodyGroup, G.belly, bellyMat, { pos: [0, 0.7, 0.24], scale: E(0.66, 0.62, 0.5), noOutline: true });
  // 하트형 흰 얼굴: 좌우 둥근 덩어리 + 아래 연결부 (이마는 남색으로 남기고 가운데가 V자로 내려옴)
  [-1, 1].forEach(d => add(bodyGroup, unit, faceMat, { pos: [d * 0.27, 1.41, 0.5], rot: [0.05, d * 0.2, -d * 0.12], scale: E(0.4, 0.34, 0.2), noOutline: true }));
  add(bodyGroup, unit, faceMat, { pos: [0, 1.29, 0.5], scale: E(0.52, 0.24, 0.2), noOutline: true });
  // 눈·부리·볼터치: 얼굴 중앙 아래쪽에 오밀조밀 (얼굴 표면보다 확실히 앞으로 나오게)
  [-1, 1].forEach(d => {
    const e = add(bodyGroup, unit, eye, { pos: [d * 0.2, 1.39, 0.7], scale: E(0.072, 0.082, 0.05), noOutline: true });
    add(e, unit, white, { pos: [-0.2, 0.3, 0.95], scale: E(0.3, 0.3, 0.3), noOutline: true });
    add(bodyGroup, unit, cheek, { pos: [d * 0.35, 1.3, 0.66], rot: [0.1, d * 0.5, 0], scale: E(0.1, 0.06, 0.04), noOutline: true });
  });
  add(bodyGroup, G.ball(0.1), orange, { pos: [0, 1.325, 0.71], scale: [1.18, 0.66, 0.8], w: 0.022 });
  // 목도리 띠 + 늘어진 꼬리
  add(bodyGroup, G.torus(0.62, 0.125), outfit, { pos: [0, 1.1, 0.03], rot: [Math.PI / 2 + 0.06, 0, 0], scale: [1.04, 0.98, 1.0], w: 0.03 });
  add(bodyGroup, G.scarfTail, outfit, { pos: [0.24, 0.84, 0.66], rot: [-0.22, 0.28, 0.08], w: 0.024 });
  // 산타 모자: 흰 챙(눈을 덮지 않게 위로 올림) + 하나로 이어진 모자 + 흰 폼폼
  const brimY = 2.08;
  add(bodyGroup, G.torus(0.53, 0.135), white, { pos: [0, brimY, 0.01], rot: [Math.PI / 2 - 0.05, 0, -0.04], scale: [1.04, 0.98, 1.0], w: 0.028 });
  add(bodyGroup, G.hat, outfit, { pos: [0, brimY - 0.02, 0.01], w: 0.03 });
  add(bodyGroup, G.ball(0.25), white, { pos: [G.hatTip.x, brimY - 0.02 + G.hatTip.y - 0.05, 0.01], w: 0.03 }); // 모자 끝을 완전히 덮는 큰 폼폼
  // 날개: 어깨가 회전축. userData.sx 는 좌(+X)=1, 우(-X)=-1
  const mkFlip = d => {
    const pv = new THREE.Group(); pv.position.set(d * 0.68, 0.98, 0); pv.rotation.z = d * 0.48; pv.userData.sx = d; bodyGroup.add(pv);
    add(pv, G.flipper, bodyMat, { pos: [d * 0.08, -0.2, 0], w: 0.03 }); return pv;
  };
  const flippers = [mkFlip(1), mkFlip(-1)];
  if (rod) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 2.4, 6), lambert(0x6b3f1e));
    r.position.set(0.1, -0.55, 0.9); r.rotation.x = Math.PI / 2 - 0.55; flippers[0].add(r);
  }
  const feet = [1, -1].map(d => add(bodyGroup, G.foot, orange, { pos: [d * 0.28, 0.075, 0.17], rot: [0, -d * 0.18, 0], w: 0.022 }));
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5b6f99, transparent: true, opacity: 0.35 }));
  blob.position.y = 0.03; root.add(blob);
  root.userData = { body: bodyGroup, feet, flippers, stride: 0, wobble: 0, footZ: 0.17, flipBase: 0.48 };
  return root;
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
  u.flippers.forEach(p => { p.rotation.z = p.userData.sx * (u.flipBase + (moving ? 0.3 * s : 0)); });
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
