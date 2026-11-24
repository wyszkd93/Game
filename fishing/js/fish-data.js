// 물고기 도감 데이터 (40종). 이미지는 fishing/fish/<id>.webp
// 등급(tier)별 기본 점수·출현 가중치(w, 클수록 자주 나옴)·릴 난이도(str)를 아래 TIERS에서 조절하세요.
// 서버가 한 번에 올릴 수 있는 점수는 최대 200점입니다(server/room.js).
export const TIERS = {
  common:   { label: "흔함",   pts: 5,   w: 18,  str: 0.6, color: 0xbfe3ff, css: "#8aa6c8" },
  uncommon: { label: "보통",   pts: 12,  w: 10,  str: 0.9, color: 0x9be3a8, css: "#4caf6a" },
  rare:     { label: "희귀",   pts: 30,  w: 5,   str: 1.2, color: 0x7fc4ff, css: "#4a93d8" },
  epic:     { label: "영웅",   pts: 70,  w: 3,   str: 1.5, color: 0xd9a8ff, css: "#a45bd8" },
  legend:   { label: "전설",   pts: 150, w: 1.2, str: 1.9, color: 0xffd35a, css: "#e0a21a" },
  junk:     { label: "잡동사니", pts: 0,  w: 5,   str: 0.4, color: 0xc9b79c, css: "#9a8f80" },
};
// 항목별로 등급 기본값을 덮어쓰기
const OVERRIDE = { bottle: { pts: 3, w: 4 } };
const LIST = [
  ["silver", "은빛 산타붕어", "common"],
  ["shrimp", "초록 목도리 새우", "common"],
  ["mackerel", "털모자 고등어", "common"],
  ["ice-1", "얼음 물고기", "common"],
  ["clown", "흰동가리", "common"],
  ["butterfly", "노랑 나비고기", "common"],
  ["neon", "네온테트라", "common"],
  ["goldfish", "금붕어", "common"],
  ["flounder-grumpy", "심술쟁이 도다리", "uncommon"],
  ["flounder-santa", "산타 넙치", "uncommon"],
  ["crab", "털모자 왕게", "uncommon"],
  ["octopus", "엘프 문어", "uncommon"],
  ["starfish", "산타 불가사리", "uncommon"],
  ["hermit", "소라게", "uncommon"],
  ["urchin", "보라 성게", "uncommon"],
  ["tang", "블루탱", "uncommon"],
  ["puffer", "복어", "uncommon"],
  ["mandarin", "만다린피시", "uncommon"],
  ["trout-holly", "호랑가시 송어", "rare"],
  ["jelly", "눈꽃 해파리", "rare"],
  ["salmon", "숲속 연어", "rare"],
  ["clam", "진주 조개", "rare"],
  ["lobster", "바닷가재", "rare"],
  ["seal", "아기 물범", "rare"],
  ["idol", "깃대돔", "rare"],
  ["seahorse", "해마", "rare"],
  ["snapper", "붉은 돔", "rare"],
  ["telescope", "퉁방울눈 금붕어", "rare"],
  ["angler", "초롱아귀", "epic"],
  ["squid", "빨간 오징어", "epic"],
  ["hammer", "귀상어", "epic"],
  ["manta", "만타가오리", "epic"],
  ["sword", "황새치", "epic"],
  ["dumbo", "덤보문어", "epic"],
  ["chest", "눈 쌓인 보물상자", "legend"],
  ["sunfish", "개복치", "legend"],
  ["coel", "실러캔스", "legend"],
  ["narwhal", "일각고래", "legend"],
  ["boot", "낡은 장화", "junk"],
  ["bottle", "편지 병", "junk"],
];
export const FISH = LIST.map(([id, name, tier]) => {
  const t = TIERS[tier];
  return { id, name, tier, tierLabel: t.label, tierCss: t.css, img: new URL(`../fish/${id}.webp`, import.meta.url).href, pts: t.pts, w: t.w, str: t.str, col: t.color, ...OVERRIDE[id] };
});
