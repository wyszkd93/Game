// 시작 화면: 닉네임 입력 · 캐릭터 색 · 서버 선택 · 초대 링크 복사. 모두 textContent로만 렌더링합니다.
import { SKINS } from "./penguin.js";
import { fetchServers, Net } from "./net.js";
import { serverBase } from "./config.js";

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); kids.forEach(k => e.append(k)); return e; };
export const sanitizeName = s => [...String(s).replace(/[\u0000-\u001f\u007f-\u009f<>&"'`​-‏‪-‮⁦-⁩]/g, "").replace(/\s+/g, " ").trim()].slice(0, 10).join("");

/**
 * @returns Promise<{ name, skin, net|null, welcome|null }>  — 접속(또는 혼자 하기)이 끝나면 resolve
 */
export function runLobby({ root, title, subtitle, howto, onSkin }) {
  return new Promise(resolve => {
    root.textContent = "";
    const params = new URLSearchParams(location.search);
    let skin = Math.min(3, Math.max(0, store.get("xmas-skin", 0)));
    let selected = Number(params.get("room")) || null;
    let servers = null;

    const nameInput = el("input", { id: "lb-name", type: "text", maxLength: 10, autocomplete: "nickname", placeholder: "닉네임 (2~10자)", value: store.get("xmas-name", "") });
    nameInput.setAttribute("aria-label", "닉네임");
    const err = el("p", { className: "lb-err", role: "alert" });
    const skinBox = el("div", { id: "skins", role: "radiogroup", ariaLabel: "펭귄 색 고르기" });
    SKINS.forEach((s, i) => {
      const b = el("button", { type: "button" }); b.setAttribute("role", "radio"); b.setAttribute("aria-label", s.name);
      b.style.background = "#" + s.color.toString(16).padStart(6, "0");
      b.addEventListener("click", () => { skin = i; store.set("xmas-skin", i); paintSkins(); onSkin && onSkin(i); });
      skinBox.append(b);
    });
    const paintSkins = () => [...skinBox.children].forEach((c, j) => c.setAttribute("aria-checked", String(j === skin)));
    paintSkins(); onSkin && onSkin(skin);

    const list = el("div", { className: "lb-servers", role: "radiogroup", ariaLabel: "서버 선택" });
    const note = el("p", { className: "small" });
    const copyBtn = el("button", { type: "button", className: "ghost", textContent: "🔗 초대 링크 복사" });
    const startBtn = el("button", { type: "button", className: "primary", textContent: "시작하기" });
    const soloBtn = el("button", { type: "button", className: "ghost", textContent: "혼자 하기" });

    function paintServers() {
      list.textContent = "";
      if (!servers) {
        note.textContent = serverBase() ? "서버에 연결할 수 없어요. 혼자 하기는 바로 할 수 있어요." : "아직 서버 주소가 설정되지 않았어요. 혼자 하기로 시작해요.";
        startBtn.disabled = true; copyBtn.disabled = true; return;
      }
      note.textContent = "";
      if (!servers.some(s => s.id === selected)) selected = (servers.find(s => s.count < s.max) || servers[0]).id;
      servers.forEach(s => {
        const full = s.count >= s.max;
        const b = el("button", { type: "button", className: "lb-server" }, el("span", { textContent: s.name }), el("b", { textContent: full ? "가득 참" : `${s.count}/${s.max}명` }));
        b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(s.id === selected)); b.disabled = full;
        b.addEventListener("click", () => { selected = s.id; paintServers(); });
        list.append(b);
      });
      startBtn.disabled = false; copyBtn.disabled = false;
    }
    async function refresh() { if (!root.isConnected || root.classList.contains("hidden")) return; servers = await fetchServers(); paintServers(); }
    paintServers(); note.textContent = serverBase() ? "서버 확인 중..." : note.textContent;
    refresh(); const poll = setInterval(refresh, 5000);

    function validName() {
      const n = sanitizeName(nameInput.value);
      if ([...n].length < 2) { err.textContent = "닉네임은 2자 이상 입력해 주세요."; nameInput.focus(); return null; }
      err.textContent = ""; store.set("xmas-name", n); nameInput.value = n; return n;
    }
    function finish(extra) { clearInterval(poll); root.classList.add("hidden"); resolve({ name: sanitizeName(nameInput.value) || "펭귄", skin, net: null, welcome: null, ...extra }); }

    startBtn.addEventListener("click", async () => {
      const name = validName(); if (!name || !selected) return;
      startBtn.disabled = true; startBtn.textContent = "접속 중...";
      const net = new Net();
      try { const welcome = await net.connect(selected, { name, skin }); finish({ name, net, welcome }); }
      catch (e) {
        err.textContent = e.message === "full" ? "서버가 가득 찼어요. 다른 서버를 골라 주세요." : "접속하지 못했어요. 잠시 후 다시 시도해 주세요.";
        startBtn.disabled = false; startBtn.textContent = "시작하기"; refresh();
      }
    });
    soloBtn.addEventListener("click", () => { const name = validName(); if (name) finish({ name }); });
    nameInput.addEventListener("keydown", e => { if (e.key === "Enter") (startBtn.disabled ? soloBtn : startBtn).click(); e.stopPropagation(); });
    nameInput.addEventListener("keyup", e => e.stopPropagation());
    copyBtn.addEventListener("click", async () => {
      const u = new URL(location.href); u.search = ""; u.hash = ""; u.searchParams.set("room", String(selected));
      try { await navigator.clipboard.writeText(u.toString()); copyBtn.textContent = "✅ 복사했어요"; }
      catch { copyBtn.textContent = u.toString(); }
      setTimeout(() => { copyBtn.textContent = "🔗 초대 링크 복사"; }, 2500);
    });

    root.append(
      el("h1", { textContent: title }), el("p", { textContent: subtitle }),
      nameInput, err, skinBox, list, note,
      el("div", { className: "lb-row" }, startBtn, soloBtn), copyBtn,
      el("p", { className: "small", textContent: howto }),
    );
    setTimeout(() => nameInput.focus(), 50);
  });
}
