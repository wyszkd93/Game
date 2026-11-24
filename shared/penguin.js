// 펭귄 캐릭터 · 이름표 · 걷기 애니메이션. 'three'는 각 페이지의 importmap으로 연결됩니다.
// 기본: 시안 그림(shared/assets/penguin/*.webp)을 방향별(정면·3/4·측면·후면)로 골라 보여주는 빌보드 펭귄.
// 비상용: 주소에 ?penguin=3d 를 붙이면 도형으로 조립한 3D 펭귄(.glb 모델이 있으면 그 모델)을 씁니다.
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
const MODE_3D = new URLSearchParams(location.search).get("penguin") === "3d";
let template = null;
if (MODE_3D) {
  try {
    const head = await fetch(MODEL_URL, { method: "HEAD" });
    if (head.ok) template = await new GLTFLoader().loadAsync(MODEL_URL);
  } catch (e) { console.info("penguin.glb 없음 또는 읽기 실패 → 도형 펭귄을 사용합니다", e && e.message); }
}
export const usingModel = !!template;

/* ---------- 시안 그림(스프라이트) 펭귄 ---------- */
const SPRITE_DIR = new URL("./assets/penguin/", import.meta.url).href;
const SPRITE_COLORS = ["red", "green", "blue", "pink"], SPRITE_VIEWS = ["front", "tq", "side", "back"];
const SPRITE_H = 2.9; // 게임 안에서의 키
let sprites = null; // sprites[색][방향] = 텍스처
if (!MODE_3D) {
  try {
    const loader = new THREE.TextureLoader(), jobs = [];
    for (const c of SPRITE_COLORS) for (const v of SPRITE_VIEWS) jobs.push(loader.loadAsync(`${SPRITE_DIR}${c}-${v}.webp`).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return [c, v, t]; }));
    sprites = {};
    for (const [c, v, t] of await Promise.all(jobs)) (sprites[c] ||= {})[v] = t;
  } catch (e) { sprites = null; console.info("펭귄 그림을 읽지 못해 도형 펭귄을 사용합니다", e && e.message); }
}
export const usingSprites = !!sprites;
let viewYaw = 0, viewPitch = 0;
const MAX_TILT = 0.95; // 그림판을 뒤로 기울이는 최대 각도(라디안, 약 54°). 더 기울이면 누워 보임
/** 카메라가 캐릭터를 바라보는 방향(각도). 게임이 매 프레임 알려 주면 보는 각도에 맞는 그림이 골라집니다. */
export function setViewYaw(y, pitch = 0) { viewYaw = y; viewPitch = pitch; }
const planeGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0); // 발끝이 기준점
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
/** rel = 캐릭터가 바라보는 방향 − 카메라 방향. 0이면 정면, 양수면 화면 오른쪽을 향함. 그림은 3/4=오른쪽, 옆=왼쪽을 향하게 그려져 있음 */
function pickSprite(set, rel) {
  const a = Math.abs(rel), right = rel > 0;
  if (a < 0.44) return [set.front, false];
  if (a < 1.13) return [set.tq, !right];
  if (a < 2.0) return [set.side, right];
  return [set.back, false];
}
function createSpritePenguin(color, { rod = false }) {
  let idx = SKINS.findIndex(s => s.color === color); if (idx < 0) idx = Math.abs(color) % 4; // NPC 등 다른 색은 변형을 돌려 씀
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mat = new THREE.MeshBasicMaterial({ alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(planeGeo, mat); plane.rotation.order = "YXZ"; plane.visible = false; body.add(plane);
  if (rod) { // 그림에 없는 낚싯대는 3D 막대로 (끝 위치는 rodTip과 같음)
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, ROD_LEN, 6), new THREE.MeshBasicMaterial({ color: 0x6b3f1e }));
    // 손잡이(ROD_HAND)에서 시작해 앞쪽 위(ROD_PITCH)로 뻗는 막대: 중심 = 손 + 길이/2 × 방향
    r.position.set(ROD_HAND[0], ROD_HAND[1] + (ROD_LEN / 2) * Math.sin(ROD_PITCH), ROD_HAND[2] + (ROD_LEN / 2) * Math.cos(ROD_PITCH));
    r.rotation.x = Math.PI / 2 - ROD_PITCH; root.add(r);
  }
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5b6f99, transparent: true, opacity: 0.35 }));
  blob.position.y = 0.03; root.add(blob);
  root.userData = { body, plane, set: sprites[SPRITE_COLORS[idx]], feet: [], flippers: [], stride: 0, wobble: 0, sprite: true, tex: null, flip: null };
  return root;
}
const ROD_HAND = [0.92, 0.86, 0.14]; // 손(날개 끝) 위치: [왼쪽, 높이, 앞쪽]. 그림 속 날개 끝이 바깥쪽 약 0.9, 높이 약 0.8에 있음
const ROD_LEN = 1.8, ROD_PITCH = 0.7; // 막대 길이, 앞쪽에서 위로 들어올린 각도(라디안)
const ROD_SIDE = ROD_HAND[0], ROD_FWD = ROD_HAND[2] + ROD_LEN * Math.cos(ROD_PITCH), ROD_TIP_Y = ROD_HAND[1] + ROD_LEN * Math.sin(ROD_PITCH);
/** 낚싯대 끝의 월드 좌표 (낚시줄 시작점). 캐릭터의 앞·왼쪽으로 조금 나온 위치 */
export function rodTip(out, pos, facing) {
  return out.set(pos.x + Math.sin(facing) * ROD_FWD + Math.cos(facing) * ROD_SIDE, ROD_TIP_Y, pos.z + Math.cos(facing) * ROD_FWD - Math.sin(facing) * ROD_SIDE);
}

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
  if (sprites) return createSpritePenguin(color, opts);
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
  // 곧게 올라가다 완만한 원호(굽는 반지름 R)로 옆·아래로 처짐. R이 관 두께보다 커야 안쪽이 접히지 않습니다.
  const R = 0.5, pts = [[0, 0, 0], [0, 0.15, 0]];
  for (let a = 15; a <= 120; a += 15) { const t = a * Math.PI / 180; pts.push([R - R * Math.cos(t), 0.15 + R * Math.sin(t), 0]); }
  const curve = new THREE.CatmullRomCurve3(pts.map(a => new THREE.Vector3(...a)), false, "centripetal");
  const radii = [0.5, 0.44, 0.38, 0.33, 0.29, 0.26, 0.24, 0.22], SEG = 64, RAD = 32;
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
  // 하트형 흰 얼굴: 두 덩어리가 만나는 지점이 이마 남색 V자의 뾰족한 끝이 되어 부리 위에 닿도록 배치
  // (V 끝 높이 = 중심 y + ry·√(1-(c/rx)²) ≈ 1.34 + 0.36·0.33 ≈ 1.46, 부리 윗면과 같은 높이)
  [-1, 1].forEach(d => add(bodyGroup, unit, faceMat, { pos: [d * 0.34, 1.34, 0.5], rot: [0.05, d * 0.2, 0], scale: E(0.36, 0.36, 0.2), noOutline: true }));
  add(bodyGroup, unit, faceMat, { pos: [0, 1.22, 0.5], scale: E(0.5, 0.2, 0.2), noOutline: true }); // 두 덩어리 아래를 이어줌 (윗면은 V 끝 아래)
  // 눈·부리·볼터치: 얼굴 중앙 아래쪽에 오밀조밀 (얼굴 표면보다 확실히 앞으로 나오게)
  [-1, 1].forEach(d => {
    const e = add(bodyGroup, unit, eye, { pos: [d * 0.34, 1.43, 0.7], scale: E(0.07, 0.08, 0.05), noOutline: true });
    add(e, unit, white, { pos: [-0.2, 0.3, 0.95], scale: E(0.3, 0.3, 0.3), noOutline: true });
    add(bodyGroup, unit, cheek, { pos: [d * 0.5, 1.3, 0.645], rot: [0.1, d * 0.6, 0], scale: E(0.125, 0.07, 0.045), noOutline: true });
  });
  // 부리: 앞으로 내밀고, 뒤에 살짝 큰 남색 타원을 겹쳐 또렷한 테두리를 만들고, 위쪽에 하이라이트
  const ink = new THREE.MeshBasicMaterial({ color: 0x191c44 });
  add(bodyGroup, G.ball(0.11), ink, { pos: [0, 1.36, 0.735], scale: [1.2 * 1.17, 0.68 * 1.3, 0.82 * 0.95], noOutline: true });
  add(bodyGroup, G.ball(0.11), orange, { pos: [0, 1.36, 0.75], scale: [1.2, 0.68, 0.82], noOutline: true });
  add(bodyGroup, unit, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), { pos: [-0.045, 1.392, 0.818], scale: E(0.036, 0.017, 0.012), noOutline: true });
  // 목도리 띠 + 늘어진 꼬리
  add(bodyGroup, G.torus(0.62, 0.125), outfit, { pos: [0, 1.1, 0.03], rot: [Math.PI / 2 + 0.06, 0, 0], scale: [1.04, 0.98, 1.0], w: 0.03 });
  add(bodyGroup, G.scarfTail, outfit, { pos: [0.24, 0.84, 0.66], rot: [-0.22, 0.28, 0.08], w: 0.024 });
  // 산타 모자: 흰 챙(눈을 덮지 않게 위로 올림) + 하나로 이어진 모자 + 흰 폼폼
  const brimY = 2.08;
  add(bodyGroup, G.torus(0.53, 0.135), white, { pos: [0, brimY, 0.01], rot: [Math.PI / 2 - 0.05, 0, -0.04], scale: [1.04, 0.98, 1.0], w: 0.028 });
  add(bodyGroup, G.hat, outfit, { pos: [0, brimY - 0.02, 0.01], w: 0.03 });
  add(bodyGroup, G.ball(0.27), white, { pos: [G.hatTip.x + 0.03, brimY - 0.02 + G.hatTip.y - 0.06, 0.01], w: 0.03 }); // 모자 끝을 완전히 덮는 큰 폼폼
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
  if (u.sprite) { // 그림 펭귄: 카메라를 보는 판 + 보는 각도에 맞는 그림 + 뒤뚱뒤뚱
    if (moving) u.stride += dt * 11;
    const s = Math.sin(u.stride);
    u.wobble = Math.max(0, u.wobble - dt);
    const hit = u.wobble > 0 ? Math.sin(u.wobble * 40) * 0.3 * (u.wobble / 0.5) : 0;
    const f = facing === undefined ? g.rotation.y : facing;
    g.rotation.y = f;
    const [tex, flip] = pickSprite(u.set, wrapAngle(f - viewYaw));
    if (tex.image) {
      if (u.tex !== tex || u.flip !== flip) { // 그림이나 좌우가 바뀔 때만 크기를 다시 계산
        const w = (tex.image.width / tex.image.height) * SPRITE_H;
        u.plane.scale.set(flip ? -w : w, SPRITE_H, 1); u.plane.material.map = tex; u.plane.material.needsUpdate = true; u.tex = tex; u.flip = flip; u.plane.visible = true;
      }
    }
    u.plane.rotation.y = viewYaw - f;                                 // 월드 기준으로는 항상 카메라를 향함
    const tilt = Math.min(viewPitch, MAX_TILT);
    u.plane.rotation.x = -tilt;                                        // 카메라가 내려다보는 만큼 발끝을 축으로 뒤로 기울여, 위에서 봐도 납작해 보이지 않게 함
    if (u.label === undefined) u.label = g.children.find(c => c.userData && c.userData.nameLabel) || null;
    if (u.label) { // 이름표: 기울어진 그림의 머리 위 (뒤로 기운 만큼 높이는 낮아지고 카메라 반대쪽으로 밀려남)
      const back = SPRITE_H * Math.sin(tilt), wx = -Math.sin(viewYaw) * back, wz = -Math.cos(viewYaw) * back;
      u.label.position.set(wx * Math.cos(f) - wz * Math.sin(f), SPRITE_H * Math.cos(tilt) + 0.55, wx * Math.sin(f) + wz * Math.cos(f));
    }
    u.plane.rotation.z = (moving ? s * 0.12 : 0) + hit;               // 화면에서 보이는 좌우 뒤뚱임(발끝 기준)
    u.body.position.y = moving ? Math.abs(s) * 0.07 : 0;
    return;
  }
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
  s.scale.set(2.4, 0.6, 1); s.position.y = 3.45; s.renderOrder = 10; s.userData.nameLabel = true;
  return s;
}
