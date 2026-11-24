// 낚시 바 미니게임의 규칙 (화면과 무관한 순수 계산). 게임(main.js)과 난이도 측정 스크립트가 함께 씁니다.
// 가로 바: 위치는 모두 0(왼쪽 끝)~1(오른쪽 끝)로 정규화됩니다. 버튼을 누르면 초록 칸이 오른쪽으로, 떼면 왼쪽으로 움직입니다.
// d = 난이도 0(쉬움)~1(전설)
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// 난이도 숫자는 모두 여기서 조절하세요. 각 항목은 [쉬움일 때, 전설일 때] 값입니다.
export const TUNING = {
  zoneW:   [0.32, 0.17],  // 초록 칸 폭(바 길이 대비)
  fill:    [0.42, 0.28],  // 물고기가 칸 안에 있을 때 초당 게이지 상승
  drain:   [0.10, 0.17],  // 벗어났을 때 초당 게이지 하락
  retarget:[1.1, 0.5],    // 물고기가 새 목표를 정하는 간격(초)
  reach:   [0.2, 0.45],   // 한 번에 움직이는 거리
  follow:  [1.4, 3.0],    // 목표로 따라가는 속도 계수(클수록 빠름)
  dart:    [0, 0.2],      // 바 끝까지 갑자기 질주할 확률(난이도 0.45 이상에서만)
  push: 3.2, pull: 2.6, vmax: 1.5, startProg: 0.3, grace: 0.02, // 누를 때 가속, 뗄 때 가속, 최대 속도, 시작 게이지, 판정 여유
};
const T = (k, d) => lerp(TUNING[k][0], TUNING[k][1], d);

/** str = 물고기 힘(fish-data.js의 str, 0.4~1.9) */
export function newBar(str) {
  const d = clamp((str - 0.4) / 1.5, 0, 1);
  return { d, zw: T("zoneW", d), zx: 0.08, zv: 0, fx: 0.5, tx: 0.5, tT: 0.5, prog: TUNING.startProg, inZone: false };
}

/** 한 프레임 진행. held = 누르고 있는지 */
export function stepBar(b, held, dt, rand = Math.random) {
  const d = b.d;
  // 초록 칸: 누르면 오른쪽으로 가속, 떼면 왼쪽으로 가속. 왼쪽 끝에서는 살짝 튕김
  b.zv = clamp(b.zv + (held ? TUNING.push : -TUNING.pull) * dt, -TUNING.vmax, TUNING.vmax); b.zx += b.zv * dt;
  if (b.zx < 0) { b.zx = 0; b.zv = Math.abs(b.zv) * 0.25; }
  if (b.zx > 1 - b.zw) { b.zx = 1 - b.zw; b.zv = 0; }
  // 물고기: 일정 간격으로 새 목표 위치를 정해 부드럽게 이동. 어려울수록 자주·멀리·갑자기
  b.tT -= dt;
  if (b.tT <= 0) {
    b.tT = T("retarget", d) * (0.6 + rand() * 0.8);
    b.tx = clamp(b.fx + (rand() * 2 - 1) * T("reach", d), 0.05, 0.95);
    if (d > 0.45 && rand() < T("dart", d)) b.tx = rand() < 0.5 ? 0.06 : 0.94;
  }
  b.fx += (b.tx - b.fx) * Math.min(1, dt * T("follow", d));
  // 물고기가 칸 안이면 게이지 상승, 벗어나면 하락
  b.inZone = Math.abs(b.fx - (b.zx + b.zw / 2)) <= b.zw / 2 + TUNING.grace;
  b.prog = clamp(b.prog + (b.inZone ? T("fill", d) : -T("drain", d)) * dt, 0, 1);
  return b.prog >= 1 ? "win" : b.prog <= 0 ? "lose" : null;
}
