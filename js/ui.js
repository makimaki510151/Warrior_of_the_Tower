(function (root) {
  const W = root.Wot || (root.Wot = {});

  const ui = {
    screen: "title",
    detail: false,
    expanded: null,
    speed: 1,
    modal: null,
    help: false,
    battle: null,
    hasSave: false,
  };

  let app = null;
  let timer = 0;

  const CORE_GAINS = [
    ["maxHp", "体", false],
    ["atk", "攻", false],
    ["def", "防", false],
  ];

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function pct(value) {
    const number = Math.round(value * 1000) / 10;
    return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
  }

  function signed(value, asPct) {
    if (asPct) {
      const n = Math.round(value * 1000) / 10;
      const body = Number.isInteger(n) ? String(n) : n.toFixed(1);
      return n > 0 ? `+${body}%` : `${body}%`;
    }
    return value > 0 ? `+${value}` : String(value);
  }

  function coreGainLine(skill) {
    return CORE_GAINS.map(([key, short, asPct]) => {
      const v = skill.gain[key] || 0;
      return `${short}${signed(v, asPct)}`;
    }).join(" ");
  }

  function syncTitle() {
    const state = W.getState();
    if (ui.screen === "title") document.title = "塔の戦士";
    else if (ui.screen === "battle" && ui.battle) document.title = `第${ui.battle.floor}層 | 塔の戦士`;
    else if (ui.screen === "clear") document.title = "頂 | 塔の戦士";
    else document.title = `第${state.floor}層 | 塔の戦士`;
  }

  function shell(body, footer) {
    const state = W.getState();
    const floor =
      ui.screen === "battle" && ui.battle && ui.battle.phase === "playing"
        ? ui.battle.floor
        : state.floor;
    const best = state.bestCleared;
    return `
      <div class="shell">
        <header class="bar">
          <div class="bar-left">
            <strong class="brand">塔の戦士</strong>
            ${ui.screen === "title" ? "" : `<span class="chip">第${floor}層</span>`}
            ${ui.screen === "title" ? "" : `<span class="chip muted">最高 ${best || "—"}</span>`}
          </div>
          <div class="bar-right">
            ${
              ui.screen === "title" || ui.screen === "clear"
                ? ""
                : `<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-detail">${ui.detail ? "詳細" : "標準"}</button>`
            }
            <button type="button" class="btn btn-ghost btn-sm" data-action="help">?</button>
          </div>
        </header>
        <main class="main main-${ui.screen}">${body}</main>
        ${footer || ""}
      </div>
    `;
  }

  function compactStats(stats, hp) {
    const current = hp == null ? stats.maxHp : Math.max(0, Math.round(hp));
    if (!ui.detail) {
      return `
        <div class="stat-row">
          <span>体 <b>${stats.maxHp}</b></span>
          <span>攻 <b>${stats.atk}</b></span>
          <span>防 <b>${stats.def}</b></span>
        </div>
      `;
    }
    return `
      <div class="stat-dense">
        <span>現在 ${current}/${stats.maxHp}</span>
        <span>回復 ${stats.regenAmount}/${stats.regenInterval}行</span>
        <span>回効 ${pct(stats.healEff)}</span>
        <span>攻効 ${pct(stats.atkEff)}</span>
        <span>防効 ${pct(stats.defEff)}</span>
        <span>速 ${stats.speed}</span>
        <span>与D ${signed(stats.dmgBonus, true)}</span>
        <span>被減 ${signed(stats.dmgReduction, true)}</span>
      </div>
    `;
  }

  function offerCard(id, state) {
    const skill = W.SKILL_BY_ID[id];
    if (!skill) return "";
    const level = state.skills[id] || 0;
    const open = ui.expanded === id;
    const lines = skill.describe(Math.max(1, level || 1));
    return `
      <article class="offer-card ${open ? "is-open" : ""}">
        <button type="button" class="offer-main" data-action="expand-offer" data-skill="${id}">
          <div class="offer-top">
            <strong>${esc(skill.name)}</strong>
            <span>${level ? `Lv.${level}→${level + 1}` : "新規"} · ${skill.cooldown}行</span>
          </div>
          <p class="offer-blurb">${esc(skill.blurb)}</p>
          <p class="offer-gain">${esc(coreGainLine(skill))}</p>
        </button>
        ${
          open && ui.detail
            ? `<div class="offer-detail">
                ${lines.map((line) => `<p>${esc(line)}</p>`).join("")}
                <p class="trade">${esc(skill.tradeoff)}</p>
              </div>`
            : ""
        }
        <button type="button" class="btn btn-primary btn-sm" data-action="pick" data-skill="${id}">獲得</button>
      </article>
    `;
  }

  function renderOffer() {
    const state = W.getState();
    W.ensureOffer();
    const offer = state.offer || [];
    return shell(`
      <p class="hint">技を1つ選ぶ（${W.SKILLS.length}種から${offer.length}）</p>
      <div class="offer-grid">
        ${offer.map((id) => offerCard(id, state)).join("")}
      </div>
    `);
  }

  function ownedOptions(state, currentId) {
    return Object.keys(state.skills)
      .filter((id) => state.skills[id] > 0)
      .map((id) => W.SKILL_BY_ID[id])
      .filter(Boolean)
      .map((skill) => {
        const used = state.flow.some((node) => node.skillId === skill.id && skill.id !== currentId);
        return `<option value="${skill.id}" ${skill.id === currentId ? "selected" : ""} ${used ? "disabled" : ""}>${esc(skill.name)} ${state.skills[skill.id]}${used ? "*" : ""}</option>`;
      })
      .join("");
  }

  function renderPrep() {
    const state = W.getState();
    const stats = W.computeStats(state.skills);
    const unused = Object.keys(state.skills).filter(
      (id) => state.skills[id] > 0 && !state.flow.some((node) => node.skillId === id)
    );

    const nodes = state.flow
      .map((node, index) => {
        const meta = W.CONDITION_BY_TYPE[node.cond.type] || W.CONDITION_BY_TYPE.always;
        const value = node.cond.value == null ? meta.def : node.cond.value;
        return `
          <li class="flow-item">
            <span class="idx">${index + 1}</span>
            <select data-bind="node-skill" data-index="${index}">${ownedOptions(state, node.skillId)}</select>
            <select data-bind="node-cond" data-index="${index}">
              ${W.CONDITIONS.map(
                (cond) =>
                  `<option value="${cond.type}" ${cond.type === meta.type ? "selected" : ""}>${esc(cond.label)}</option>`
              ).join("")}
            </select>
            ${
              meta.value
                ? `<input type="range" data-bind="node-value" data-index="${index}" min="${meta.min}" max="${meta.max}" step="${meta.step}" value="${value}" />`
                : ""
            }
            <div class="flow-mini">
              <button type="button" class="btn btn-ghost btn-xs" data-action="move-node" data-index="${index}" data-dir="-1" ${index === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="btn btn-ghost btn-xs" data-action="move-node" data-index="${index}" data-dir="1" ${index === state.flow.length - 1 ? "disabled" : ""}>↓</button>
              <button type="button" class="btn btn-ghost btn-xs" data-action="remove-node" data-index="${index}">×</button>
            </div>
          </li>
        `;
      })
      .join("");

    const addable = unused
      .map((id) => `<option value="${id}">${esc(W.SKILL_BY_ID[id].name)}</option>`)
      .join("");

    return shell(
      `
      <div class="prep-grid">
        <section class="pane">
          <h2>能力</h2>
          ${compactStats(stats)}
          <p class="tiny">習得 ${Object.keys(state.skills).length}種</p>
        </section>
        <section class="pane pane-flow">
          <h2>手順 <span class="tiny">上から判定・外れは通常攻撃</span></h2>
          <ol class="flow-list">
            ${nodes || `<li class="empty">手順なし → 通常攻撃のみ</li>`}
            <li class="fallback">↓ 通常攻撃</li>
          </ol>
          ${
            state.flow.length < W.MAX_FLOW && addable
              ? `<div class="add-row">
                  <select data-new-skill>${addable}</select>
                  <button type="button" class="btn btn-ghost btn-sm" data-action="add-node">追加</button>
                </div>`
              : ""
          }
        </section>
      </div>
    `,
      `<footer class="foot">
        <button type="button" class="btn btn-primary" data-action="fight">第${state.floor}層に挑む</button>
      </footer>`
    );
  }

  function renderTitle() {
    const state = W.getState();
    return shell(`
      <div class="title-pane">
        <p class="eyebrow">Warrior of the Tower</p>
        <h1>塔の戦士</h1>
        <p class="lede">技を1つ選び、手順を組んで自動戦闘で百層を登る。</p>
        <p class="record">${state.bestCleared ? `最高 ${state.bestCleared}層` : "記録なし"}</p>
        <div class="title-actions">
          ${
            ui.hasSave
              ? `<button type="button" class="btn btn-primary" data-action="continue">続きから</button>
                 <button type="button" class="btn btn-ghost" data-action="restart">はじめから</button>`
              : `<button type="button" class="btn btn-primary" data-action="start">塔に入る</button>`
          }
        </div>
      </div>
    `);
  }

  function renderBattle() {
    const state = W.getState();
    const battle = ui.battle;
    const stats = W.computeStats(state.skills);
    const enemy = battle.enemy;
    const shown = battle.phase === "done" ? battle.events : battle.events.slice(0, battle.index);
    const latest = shown[shown.length - 1];
    const playerHp = latest ? latest.playerHp : stats.maxHp;
    const enemyHp = latest ? latest.enemyHp : enemy.maxHp;
    const pRate = Math.max(0, Math.min(100, (playerHp / stats.maxHp) * 100));
    const eRate = Math.max(0, Math.min(100, (enemyHp / enemy.maxHp) * 100));
    const logLines = shown.slice(-8);

    let foot = "";
    if (battle.phase === "done") {
      if (battle.winner === "player" && battle.cleared) {
        foot = `<footer class="foot result win"><span>第100層突破</span><button type="button" class="btn btn-primary" data-action="to-clear">頂へ</button></footer>`;
      } else if (battle.winner === "player") {
        foot = `<footer class="foot result win"><span>第${battle.floor}層突破</span><button type="button" class="btn btn-primary" data-action="next-floor">次へ</button></footer>`;
      } else {
        foot = `<footer class="foot result lose">
          <span>敗北</span>
          <button type="button" class="btn btn-primary btn-sm" data-action="rebuild">手順を組み直す</button>
          <button type="button" class="btn btn-danger btn-sm" data-action="give-up">諦める</button>
        </footer>`;
      }
    } else {
      foot = `<footer class="foot">
        <button type="button" class="btn btn-ghost btn-sm" data-action="speed">${ui.speed}x</button>
        <button type="button" class="btn btn-primary" data-action="skip">結果へ</button>
      </footer>`;
    }

    return shell(
      `
      <div class="battle-pane">
        <div class="bars">
          <div>
            <div class="bar-label"><span>あなた</span><span data-hp-label="player">${Math.max(0, Math.round(playerHp))}/${stats.maxHp}</span></div>
            <div class="hp"><span data-bar="player" style="width:${pRate}%"></span></div>
            ${ui.detail ? compactStats(stats, playerHp) : ""}
          </div>
          <div>
            <div class="bar-label"><span>敵</span><span data-hp-label="enemy">${Math.max(0, Math.round(enemyHp))}/${enemy.maxHp}</span></div>
            <div class="hp enemy"><span data-bar="enemy" style="width:${eRate}%"></span></div>
          </div>
        </div>
        <div class="log" data-log>
          ${logLines.map((event) => `<p class="${esc(event.kind || "system")}">${esc(event.text)}</p>`).join("")}
        </div>
      </div>
    `,
      foot
    );
  }

  function renderClear() {
    const state = W.getState();
    return shell(`
      <div class="title-pane">
        <p class="eyebrow">第100層</p>
        <h1>塔の頂</h1>
        <p class="lede">百層を越えた。</p>
        <p class="record">最高 ${state.bestCleared}層</p>
        <button type="button" class="btn btn-primary" data-action="climb-again">もう一度</button>
      </div>
    `);
  }

  function modal() {
    if (ui.help) {
      return `
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-card">
            <h2>遊び方</h2>
            <ul>
              <li>100層突破が目標。戦いは自動。</li>
              <li>約${W.SKILLS.length}種の技から毎回5つ提示。1つだけ獲得／強化。</li>
              <li>同じ技を重ねても伸びは一定。完全上位互換はない。</li>
              <li>手順は上から判定。外れは通常攻撃。</li>
              <li>敵の詳細は出ない。階層ごとの相手は固定。</li>
              <li>敗北時は手順の組み直しか諦め。</li>
            </ul>
            <button type="button" class="btn btn-primary" data-action="close-modal">閉じる</button>
          </div>
        </div>`;
    }
    if (ui.modal === "giveup" || ui.modal === "restart") {
      const give = ui.modal === "giveup";
      return `
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-card">
            <h2>${give ? "諦める" : "はじめから"}</h2>
            <p>技は消える。最高記録は残る。</p>
            <div class="row">
              <button type="button" class="btn ${give ? "btn-danger" : "btn-primary"}" data-action="${give ? "confirm-give-up" : "confirm-restart"}">実行</button>
              <button type="button" class="btn btn-ghost" data-action="close-modal">戻る</button>
            </div>
          </div>
        </div>`;
    }
    return "";
  }

  function routeScreen(state) {
    if (state.clearedTower) return "clear";
    if (state.pendingPick) return "offer";
    return "prep";
  }

  function render() {
    const state = W.getState();
    let body = "";
    if (ui.screen === "title") body = renderTitle();
    else if (ui.screen === "offer") body = renderOffer();
    else if (ui.screen === "prep") body = renderPrep();
    else if (ui.screen === "battle") body = renderBattle();
    else if (ui.screen === "clear") body = renderClear();
    app.innerHTML = `${body}${modal()}`;
    syncTitle();
    const log = document.querySelector("[data-log]");
    if (log) log.scrollTop = log.scrollHeight;
  }

  function beginRun() {
    W.newRun();
    ui.hasSave = true;
    ui.screen = "offer";
    ui.expanded = null;
    ui.modal = null;
    ui.help = false;
    ui.battle = null;
    render();
  }

  function stopPlayback() {
    clearTimeout(timer);
    timer = 0;
  }

  function paintBars(event) {
    ["player", "enemy"].forEach((side) => {
      const hp = side === "player" ? event.playerHp : event.enemyHp;
      const max = side === "player" ? event.playerMax : event.enemyMax;
      const bar = document.querySelector(`[data-bar="${side}"]`);
      const label = document.querySelector(`[data-hp-label="${side}"]`);
      if (bar) bar.style.width = `${Math.max(0, Math.min(100, (hp / max) * 100))}%`;
      if (label) label.textContent = `${Math.max(0, Math.round(hp))}/${max}`;
    });
  }

  function play() {
    clearTimeout(timer);
    const battle = ui.battle;
    if (!battle || battle.phase !== "playing") return;
    timer = setTimeout(step, battle.index === 0 ? 200 : Math.round(480 / ui.speed));
  }

  function step() {
    const battle = ui.battle;
    if (!battle || battle.phase !== "playing") return;
    if (battle.index >= battle.events.length) {
      battle.phase = "done";
      render();
      return;
    }
    const event = battle.events[battle.index];
    const log = document.querySelector("[data-log]");
    if (log) {
      const line = document.createElement("p");
      line.className = event.kind || "system";
      line.textContent = event.text;
      log.appendChild(line);
      while (log.children.length > 8) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }
    paintBars(event);
    battle.index += 1;
    if (battle.index >= battle.events.length) {
      battle.phase = "done";
      render();
      return;
    }
    play();
  }

  function startBattle() {
    if (ui.screen === "battle") return;
    const state = W.getState();
    if (state.clearedTower) {
      ui.screen = "clear";
      render();
      return;
    }
    const enemy = W.createEnemy(state.floor);
    const stats = W.computeStats(state.skills);
    const result = W.simulate({
      stats,
      enemy,
      levels: state.skills,
      flow: state.flow,
      keepLog: true,
    });
    let cleared = false;
    if (result.winner === "player") {
      cleared = W.commitWin().cleared;
    }
    stopPlayback();
    ui.battle = {
      ...result,
      floor: enemy.floor,
      enemy,
      cleared,
      phase: "playing",
      index: 0,
    };
    ui.screen = "battle";
    render();
    play();
  }

  function enterRunScreen() {
    const state = W.getState();
    ui.screen = routeScreen(state);
    if (ui.screen === "offer") W.ensureOffer();
    render();
  }

  function onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;

    if (action === "start") {
      beginRun();
      return;
    }
    if (action === "continue") {
      enterRunScreen();
      return;
    }
    if (action === "restart") {
      ui.modal = "restart";
      ui.help = false;
      render();
      return;
    }
    if (action === "confirm-restart") {
      beginRun();
      return;
    }
    if (action === "help") {
      ui.help = true;
      ui.modal = null;
      render();
      return;
    }
    if (action === "close-modal") {
      ui.help = false;
      ui.modal = null;
      render();
      return;
    }
    if (action === "toggle-detail") {
      ui.detail = !ui.detail;
      render();
      if (ui.battle && ui.battle.phase === "playing") play();
      return;
    }
    if (action === "expand-offer") {
      const id = button.dataset.skill;
      ui.expanded = ui.expanded === id ? null : id;
      render();
      return;
    }
    if (action === "pick") {
      if (W.pickSkill(button.dataset.skill)) {
        ui.expanded = null;
        ui.screen = "prep";
        render();
      }
      return;
    }
    if (action === "add-node") {
      const select = document.querySelector("[data-new-skill]");
      if (select) W.addNode(select.value);
      render();
      return;
    }
    if (action === "remove-node") {
      W.removeNode(Number(button.dataset.index));
      render();
      return;
    }
    if (action === "move-node") {
      W.moveNode(Number(button.dataset.index), Number(button.dataset.dir));
      render();
      return;
    }
    if (action === "fight") {
      startBattle();
      return;
    }
    if (action === "speed") {
      ui.speed = ui.speed === 4 ? 1 : ui.speed * 2;
      button.textContent = `${ui.speed}x`;
      return;
    }
    if (action === "skip") {
      if (!ui.battle) return;
      stopPlayback();
      ui.battle.index = ui.battle.events.length;
      ui.battle.phase = "done";
      render();
      return;
    }
    if (action === "next-floor") {
      ui.battle = null;
      ui.screen = "offer";
      W.ensureOffer();
      render();
      return;
    }
    if (action === "to-clear") {
      ui.battle = null;
      ui.screen = "clear";
      render();
      return;
    }
    if (action === "rebuild") {
      ui.battle = null;
      ui.screen = "prep";
      render();
      return;
    }
    if (action === "give-up") {
      ui.modal = "giveup";
      render();
      return;
    }
    if (action === "confirm-give-up") {
      W.giveUp();
      ui.modal = null;
      ui.battle = null;
      ui.screen = "offer";
      render();
      return;
    }
    if (action === "climb-again") {
      beginRun();
    }
  }

  function onChange(event) {
    const el = event.target;
    if (el.dataset.bind === "node-skill") {
      W.updateNode(Number(el.dataset.index), { skillId: el.value });
      render();
      return;
    }
    if (el.dataset.bind === "node-cond") {
      W.updateNode(Number(el.dataset.index), { condType: el.value });
      render();
      return;
    }
    if (el.dataset.bind === "node-value") {
      W.updateNode(Number(el.dataset.index), { value: Number(el.value) });
      render();
    }
  }

  function onKey(event) {
    if (event.key !== "Escape") return;
    if (!ui.modal && !ui.help) return;
    ui.modal = null;
    ui.help = false;
    render();
  }

  function onBackdrop(event) {
    if (event.target.classList && event.target.classList.contains("modal")) {
      ui.modal = null;
      ui.help = false;
      render();
    }
  }

  W.ui = {
    init(el) {
      app = el;
      ui.hasSave = W.load();
      if (!ui.hasSave) W.newRun({ persist: false });
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        ui.speed = 4;
      }
      app.addEventListener("click", onClick);
      app.addEventListener("click", onBackdrop);
      app.addEventListener("change", onChange);
      document.addEventListener("keydown", onKey);
    },
    render,
  };
  W.uiState = ui;
})(typeof window !== "undefined" ? window : globalThis);
