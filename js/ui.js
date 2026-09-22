(function (root) {
  const W = root.Wot || (root.Wot = {});

  const ui = {
    screen: "title",
    detail: false,
    tab: "enemy",
    speed: 1,
    modal: null,
    help: false,
    battle: null,
    notice: "",
    hasSave: false,
    _screen: "",
  };

  let app = null;
  let timer = 0;

  const GAIN_ROWS = [
    ["maxHp", "体力", false],
    ["atk", "攻撃力", false],
    ["def", "防御力", false],
    ["regenInterval", "自動体力回復速度", false],
    ["regenAmount", "自動体力回復量", false],
    ["healEff", "体力回復効率", true],
    ["atkEff", "攻撃力補助効率", true],
    ["defEff", "防御力補助効率", true],
    ["speed", "行動速度", false],
    ["dmgBonus", "与ダメージ補正", true],
    ["dmgReduction", "被ダメージ軽減", true],
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

  function signedPct(value) {
    const number = Math.round(value * 1000) / 10;
    const body = Number.isInteger(number) ? String(number) : number.toFixed(1);
    if (number > 0) return `+${body}%`;
    return `${body}%`;
  }

  function gainText(key, value, asPct) {
    if (asPct) return signedPct(value);
    if (key === "regenInterval") {
      if (value < 0) return `${value}行動（速くなる）`;
      if (value > 0) return `+${value}行動（遅くなる）`;
      return "±0";
    }
    if (value > 0) return `+${value}`;
    return String(value);
  }

  function gainClass(key, value) {
    if (!value) return "zero";
    const good = key === "regenInterval" ? value < 0 : value > 0;
    return good ? "up" : "down";
  }

  function clearedCount(state) {
    if (state.clearedTower) return 100;
    return Math.max(0, state.floor - 1);
  }

  function syncTitle() {
    const state = W.getState();
    if (ui.screen === "title") document.title = "塔の戦士";
    else if (ui.screen === "battle" && ui.battle) document.title = `第${ui.battle.floor}層の戦い | 塔の戦士`;
    else if (ui.screen === "clear") document.title = "頂 | 塔の戦士";
    else document.title = `第${state.floor}層 | 塔の戦士`;
  }

  function shownProgress(state) {
    if (ui.screen === "battle" && ui.battle && ui.battle.phase === "playing") {
      return {
        floor: ui.battle.floor,
        points: ui.battle.pointsBefore,
        best: ui.battle.bestBefore,
        cleared: Math.max(0, ui.battle.floor - 1),
      };
    }
    return {
      floor: state.floor,
      points: state.points,
      best: state.bestCleared,
      cleared: clearedCount(state),
    };
  }

  function header(state) {
    if (ui.screen === "title") return "";
    const progress = shownProgress(state);
    return `
      <header class="top">
        <div class="top-row">
          <div class="brand">
            <p class="brand-kicker">百層</p>
            <p class="brand-name">塔の戦士</p>
          </div>
          <div class="top-meta">
            <span>第${progress.floor}層</span>
            <span>技点 ${progress.points}</span>
            <span>最高 ${progress.best ? `${progress.best}層` : "なし"}</span>
          </div>
          <div class="top-actions">
            <button type="button" class="btn btn-ghost" data-action="toggle-detail" aria-pressed="${ui.detail}">
              ${ui.detail ? "詳細表示" : "標準表示"}
            </button>
            <button type="button" class="btn btn-ghost" data-action="help">遊び方</button>
          </div>
        </div>
        <div class="tower-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.cleared}" aria-label="突破した階層">
          <span style="width:${progress.cleared}%"></span>
        </div>
        ${ui.screen === "prep" ? tabs(state) : ""}
      </header>
    `;
  }

  function tabs(state) {
    const hint = Object.keys(state.skills).length === 0 && state.points >= 3;
    const items = [
      ["enemy", "階層"],
      ["stats", "能力"],
        ["skills", "技"],
      ["flow", "手順"],
    ];
    return `
      <div class="tabbar" role="tablist">
        ${items
          .map(
            ([id, label]) => `
              <button type="button" class="tab ${ui.tab === id ? "is-active" : ""} ${id === "skills" && hint ? "has-hint" : ""}" data-action="set-tab" data-tab="${id}" role="tab" aria-selected="${ui.tab === id}">
                ${label}
              </button>
            `
          )
          .join("")}
      </div>
    `;
  }

  function notice() {
    if (!ui.notice) return "";
    return `<p class="notice" role="status">${esc(ui.notice)}</p>`;
  }

  function statSheet(stats, hp, detail) {
    const current = hp == null ? stats.maxHp : Math.max(0, Math.round(hp));
    if (!detail) {
      return `
        <dl class="stat-grid">
          <div><dt>体力</dt><dd>${stats.maxHp}</dd></div>
          <div><dt>攻撃力</dt><dd>${stats.atk}</dd></div>
          <div><dt>防御力</dt><dd>${stats.def}</dd></div>
        </dl>
      `;
    }
    const rows = [
      ["現在体力", `${current} / ${stats.maxHp}`],
      ["最大体力", String(stats.maxHp)],
      ["自動体力回復速度", `${stats.regenInterval}行動ごと`],
      ["自動体力回復量", String(stats.regenAmount)],
      ["体力回復効率", pct(stats.healEff)],
      ["攻撃力補助効率", pct(stats.atkEff)],
      ["防御力補助効率", pct(stats.defEff)],
      ["行動速度", String(stats.speed)],
      ["与ダメージ補正", signedPct(stats.dmgBonus)],
      ["被ダメージ軽減", signedPct(stats.dmgReduction)],
    ];
    return `
      <dl class="stat-list">
        ${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}
      </dl>
      <p class="fine-note">効率は100%が基準です。技の強化は、この割合でさらに伸びます。回復速度は、数字が小さいほど速くなります。</p>
    `;
  }

  function renderEnemy(enemy, reward) {
    return `
      <section class="panel panel-enemy ${ui.tab === "enemy" ? "is-active" : ""}" data-panel="enemy">
        <p class="eyebrow">いま挑む階層</p>
        <div class="enemy-head">
          <div class="seal" aria-hidden="true">${esc((enemy.badge || "敵").slice(0, 1))}</div>
          <div>
            <h2>第${enemy.floor}層 ${esc(enemy.name)}</h2>
            <p class="badge">${esc(enemy.badge)}</p>
          </div>
        </div>
        <p>${esc(enemy.hint)}</p>
        <p class="special">${esc(enemy.special)}</p>
        ${statSheet(enemy, enemy.maxHp, ui.detail)}
        <p class="reward">突破報酬 <strong>技点 ${reward}</strong></p>
      </section>
    `;
  }

  function renderPlayer(stats) {
    const state = W.getState();
    const learned = Object.keys(state.skills).length;
    return `
      <section class="panel panel-stats ${ui.tab === "stats" ? "is-active" : ""}" data-panel="stats">
        <p class="eyebrow">登塔者</p>
        <h2>あなたの能力</h2>
        ${statSheet(stats, stats.maxHp, ui.detail)}
        <p class="fine-note">習得した技 ${learned}種。戦いはこの能力と、手順に入れた技だけで進みます。</p>
      </section>
    `;
  }

  function gainList(skill, multiplier, mode) {
    return GAIN_ROWS.filter(([key], index) => {
      const extra = index >= 3;
      if (mode === "core") return !extra;
      if (!skill.gain[key]) return false;
      if (mode === "extra") return extra;
      return true;
    })
      .map(([key, label, asPct]) => {
        const value = (skill.gain[key] || 0) * multiplier;
        return `<li class="${gainClass(key, skill.gain[key] || 0)}"><span>${label}</span><b>${esc(gainText(key, value, asPct))}</b></li>`;
      })
      .join("");
  }

  function skillCard(skill, state) {
    const level = state.skills[skill.id] || 0;
    const nextCost = W.skillCost(level);
    const one = W.planBuy(skill.id, 1);
    const bulk = W.planBuy(skill.id, 5);
    const shown = Math.max(1, level);
    const lines = skill.describe(shown);
    return `
      <article class="skill-card ${level ? "is-owned" : ""}">
        <header>
          <h3>${esc(skill.name)}</h3>
          <span class="lv">${level ? `Lv.${level}` : "未習得"}</span>
        </header>
        <p>${esc(skill.blurb)}</p>
        <p class="cd">再使用まで ${skill.cooldown}行動</p>
        <p class="gain-label">1段階ごとの上昇</p>
        <ul class="gains">${gainList(skill, 1, "core")}</ul>
        ${
          ui.detail
            ? `
              ${gainList(skill, 1, "extra") ? `<ul class="gains gains-detail">${gainList(skill, 1, "extra")}</ul>` : ""}
              ${
                level
                  ? `<p class="gain-label">現在の累計</p><ul class="gains">${gainList(skill, level, "all")}</ul>`
                  : ""
              }
              <ul class="describe">
                ${lines.map((line) => `<li>${esc(line)}</li>`).join("")}
              </ul>
              <p class="tradeoff">${esc(skill.tradeoff)}</p>
            `
            : ""
        }
        <div class="skill-actions">
          <button type="button" class="btn btn-primary" data-action="buy" data-skill="${skill.id}" data-times="1" ${one ? "" : "disabled"}>
            ${level ? "強化" : "習得"} ${nextCost}
          </button>
          ${
            bulk >= 2
              ? `<button type="button" class="btn btn-ghost" data-action="buy" data-skill="${skill.id}" data-times="${bulk}">+${bulk}</button>`
              : ""
          }
        </div>
      </article>
    `;
  }

  function renderSkills(state) {
    const groups = W.SKILL_GROUPS.map((group) => {
      const cards = W.SKILLS.filter((skill) => skill.group === group)
        .map((skill) => skillCard(skill, state))
        .join("");
      return `<section class="skill-group"><h3>${esc(group)}</h3><div class="skill-grid">${cards}</div></section>`;
    }).join("");
    return `
      <section class="panel panel-skills ${ui.tab === "skills" ? "is-active" : ""}" data-panel="skills">
        <p class="eyebrow">技は${W.SKILLS.length}種</p>
        <h2>習得と強化</h2>
        <p class="lead">同じ技を重ねると1段階ずつ強くなる。伸びは毎回同じで、2段階目で威力が倍になることはない。完全に上位の技はなく、相手によって向き不向きが変わる。</p>
        ${groups}
      </section>
    `;
  }

  function ownedOptions(state, currentId) {
    return Object.keys(state.skills)
      .filter((id) => state.skills[id] > 0)
      .map((id) => W.SKILL_BY_ID[id])
      .filter(Boolean)
      .map((skill) => {
        const used = state.flow.some((node) => node.skillId === skill.id && skill.id !== currentId);
        return `<option value="${skill.id}" ${skill.id === currentId ? "selected" : ""} ${used ? "disabled" : ""}>${esc(skill.name)} Lv.${state.skills[skill.id]}${used ? "（使用中）" : ""}</option>`;
      })
      .join("");
  }

  function renderFlow(state) {
    const unused = Object.keys(state.skills).filter(
      (id) => state.skills[id] > 0 && !state.flow.some((node) => node.skillId === id)
    );
    const nodes = state.flow
      .map((node, index) => {
        const meta = W.CONDITION_BY_TYPE[node.cond.type] || W.CONDITION_BY_TYPE.always;
        const value = node.cond.value == null ? meta.def : node.cond.value;
        const label = W.conditionLabel({ type: meta.type, value });
        return `
          ${index ? '<li class="flow-else">当てはまらなければ、次へ</li>' : ""}
          <li class="flow-node">
            <div class="flow-top">
              <span class="flow-index">${index + 1}</span>
              <label class="sr" for="skill-${index}">技</label>
              <select id="skill-${index}" data-bind="node-skill" data-index="${index}">
                ${ownedOptions(state, node.skillId)}
              </select>
            </div>
            <label class="cond-label" for="cond-${index}">もし</label>
            <select id="cond-${index}" data-bind="node-cond" data-index="${index}">
              ${W.CONDITIONS.map(
                (cond) => `<option value="${cond.type}" ${cond.type === meta.type ? "selected" : ""}>${esc(cond.label)}</option>`
              ).join("")}
            </select>
            ${
              meta.value
                ? `
                  <div class="range-row">
                    <input type="range" data-bind="node-value" data-index="${index}" min="${meta.min}" max="${meta.max}" step="${meta.step}" value="${value}" aria-label="${esc(meta.label)}" />
                    <span class="cond-readout">${esc(label)}</span>
                  </div>
                `
                : `<p class="cond-readout standalone">${esc(label)}</p>`
            }
            <div class="flow-actions">
              <button type="button" class="btn btn-ghost" data-action="move-node" data-index="${index}" data-dir="-1" ${index === 0 ? "disabled" : ""}>上へ</button>
              <button type="button" class="btn btn-ghost" data-action="move-node" data-index="${index}" data-dir="1" ${index === state.flow.length - 1 ? "disabled" : ""}>下へ</button>
              <button type="button" class="btn btn-ghost" data-action="remove-node" data-index="${index}">外す</button>
            </div>
          </li>
        `;
      })
      .join("");

    const addable = unused
      .map((id) => `<option value="${id}">${esc(W.SKILL_BY_ID[id].name)} Lv.${state.skills[id]}</option>`)
      .join("");

    return `
      <section class="panel panel-flow ${ui.tab === "flow" ? "is-active" : ""}" data-panel="flow">
        <p class="eyebrow">フローチャート</p>
        <h2>戦闘の手順</h2>
        <p class="lead">上から順に条件を見る。最初に一致し、再使用できる技を使う。どれも使えなければ通常攻撃になる。</p>
        ${unused.length ? `<p class="fine-note">手順に入っていない習得技が${unused.length}つある。</p>` : ""}
        <ol class="flow">
          ${nodes || `<li class="flow-empty">手順は空です。通常攻撃だけで戦います。</li>`}
          <li class="flow-else">どれにも当てはまらなければ</li>
          <li class="flow-end">通常攻撃</li>
        </ol>
        <div class="add-node">
          ${
            state.flow.length >= W.MAX_FLOW
              ? `<p>手順は${W.MAX_FLOW}個までです。</p>`
              : addable
                ? `
                  <label for="new-skill">技を足す</label>
                  <select id="new-skill" data-new-skill>${addable}</select>
                  <button type="button" class="btn btn-primary" data-action="add-node">手順に加える</button>
                `
                : `<p>${
                    Object.keys(state.skills).length
                      ? "習得済みの技は、すべて手順に入っています。"
                      : "技を習得すると、ここに加えられます。"
                  }</p>`
          }
        </div>
      </section>
    `;
  }

  function renderTitle() {
    const state = W.getState();
    const record = state.bestCleared ? `最高記録 ${state.bestCleared}層` : "まだ記録はない";
    return `
      <main class="title-screen">
        <div class="tower" aria-hidden="true">
          ${Array.from({ length: 9 }, (_, i) => `<span style="--i:${i}"></span>`).join("")}
        </div>
        <div class="title-copy">
          <p class="eyebrow">Warrior of the Tower</p>
          <h1>塔の戦士</h1>
          <p class="lede">百の階層を、自動の戦いだけで登る。手が動くのは、戦う前だけだ。技を覚え、使う順番と条件を組む。手順が外れたとき、剣は通常の一撃に戻る。</p>
          <p class="record">${record}</p>
          <div class="title-actions">
            ${
              ui.hasSave
                ? `
                  <button type="button" class="btn btn-primary" data-action="continue">続きから</button>
                  <button type="button" class="btn btn-ghost" data-action="restart">はじめから</button>
                `
                : `<button type="button" class="btn btn-primary" data-action="start">塔に入る</button>`
            }
            <button type="button" class="btn btn-ghost" data-action="help">遊び方</button>
          </div>
        </div>
      </main>
    `;
  }

  function renderPrep() {
    const state = W.getState();
    const enemy = W.createEnemy(state.floor);
    const stats = W.computeStats(state.skills);
    const reward = W.rewardFor(state.floor);
    return `
      ${header(state)}
      <main class="screen-prep">
        ${notice()}
        <div class="prep-layout">
          <div class="col-left">
            ${renderEnemy(enemy, reward)}
            ${renderPlayer(stats)}
          </div>
          ${renderSkills(state)}
          ${renderFlow(state)}
        </div>
      </main>
      <div class="fight-bar">
        <div class="fight-bar-inner">
          <p>第${state.floor}層 <span>${esc(enemy.name)}</span></p>
          <button type="button" class="btn btn-primary" data-action="fight">この階層に挑む</button>
        </div>
      </div>
    `;
  }

  function fighterCard(side, name, badge, hp, max, stats) {
    const ratio = max ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
    return `
      <article class="fighter fighter-${side}">
        <div class="fighter-name">
          <div class="seal ${side === "enemy" ? "seal-enemy" : ""}" aria-hidden="true">${esc(badge)}</div>
          <div>
            <h2>${esc(name)}</h2>
            <p data-hp-label="${side}">${Math.max(0, Math.round(hp))} / ${max}</p>
          </div>
        </div>
        <div class="hp-track" aria-hidden="true">
          <span data-bar="${side}" style="width:${ratio}%"></span>
        </div>
        ${statSheet(stats, hp, ui.detail)}
      </article>
    `;
  }

  function logHtml(events) {
    return events
      .map((event) => `<p class="log-line ${esc(event.kind || "system")}">${esc(event.text)}</p>`)
      .join("");
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
    const result = battleResult(battle);
    return `
      ${header(state)}
      <main class="screen-battle">
        <div class="battle-layout">
          <div class="fighters">
            ${fighterCard("player", "登塔者", "登", playerHp, stats.maxHp, stats)}
            ${fighterCard("enemy", enemy.name, (enemy.badge || "敵").slice(0, 1), enemyHp, enemy.maxHp, enemy)}
          </div>
          <section class="panel log-panel">
            <p class="eyebrow">戦闘ログ</p>
            <div class="log" data-log>${logHtml(shown)}</div>
          </section>
        </div>
        <div class="battle-controls">
          ${
            battle.phase === "done"
              ? result
              : `
                <button type="button" class="btn btn-ghost" data-action="speed">速度 ${ui.speed}x</button>
                <button type="button" class="btn btn-primary" data-action="skip">結果まで進める</button>
              `
          }
        </div>
      </main>
    `;
  }

  function battleResult(battle) {
    if (battle.winner === "player" && battle.cleared) {
      return `
        <div class="result win" role="status">
          <h2>第100層を突破した</h2>
          <p>技点 +${battle.reward}。塔の頂は、目の前にある。</p>
          <button type="button" class="btn btn-primary" data-action="to-clear">頂を見る</button>
        </div>
      `;
    }
    if (battle.winner === "player") {
      return `
        <div class="result win" role="status">
          <h2>第${battle.floor}層を突破した</h2>
          <p>技点 +${battle.reward}。次の階層へ進める。</p>
          <button type="button" class="btn btn-primary" data-action="next-floor">次の階層へ</button>
        </div>
      `;
    }
    return `
      <div class="result lose" role="status">
        <h2>第${battle.floor}層で倒れた</h2>
        <p>技はそのまま残る。手順を組み直して、もう一度この階層に挑める。</p>
        <div class="result-actions">
          <button type="button" class="btn btn-primary" data-action="rebuild">スキルセットを組み直す</button>
          <button type="button" class="btn btn-danger" data-action="give-up">諦める</button>
        </div>
      </div>
    `;
  }

  function renderClear() {
    const state = W.getState();
    return `
      ${header(state)}
      <main class="clear-screen">
        <p class="eyebrow">第100層</p>
        <h1>塔の頂</h1>
        <p>百の階層を越えた。技の手順が、最後の番人まで届いた。</p>
        <p class="record">最高記録 ${state.bestCleared}層</p>
        <button type="button" class="btn btn-primary" data-action="climb-again">もう一度登る</button>
      </main>
    `;
  }

  function modal() {
    if (ui.help) {
      return `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <div class="modal-card">
            <h2 id="help-title">遊び方</h2>
            <ul>
              <li>目標は、100層の突破です。</li>
              <li>戦いは自動で進みます。操作するのは、挑む前の技の習得と手順だけです。</li>
              <li>技点で技を覚えます。同じ技は何度でも強化でき、1回ごとの伸びは一定です。2回目で威力が倍にはなりません。</li>
              <li>手順は上から判定します。条件に合い、再使用できる最初の技を使います。どれもダメなら通常攻撃です。</li>
              <li>標準表示は体力、攻撃力、防御力です。詳細表示にすると、回復の速度や量、各種の効率まで見えます。</li>
              <li>技に完全な上位互換はありません。硬い敵、回復する敵、毒、大振りで、役立つ技が変わります。</li>
              <li>一度負けると、手順を組み直して再戦するか、諦めて1層からやり直すかを選べます。諦めると技と技点は失われ、最高記録は残ります。</li>
            </ul>
            <button type="button" class="btn btn-primary" data-action="close-modal">閉じる</button>
          </div>
        </div>
      `;
    }
    if (ui.modal === "giveup") {
      return `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="giveup-title">
          <div class="modal-card">
            <h2 id="giveup-title">この登攀を諦める</h2>
            <p>習得した技と技点を失い、1層からやり直しになります。最高記録は残ります。</p>
            <div class="result-actions">
              <button type="button" class="btn btn-danger" data-action="confirm-give-up">諦めて最初から</button>
              <button type="button" class="btn btn-ghost" data-action="close-modal">戻る</button>
            </div>
          </div>
        </div>
      `;
    }
    if (ui.modal === "restart") {
      return `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="restart-title">
          <div class="modal-card">
            <h2 id="restart-title">はじめから登る</h2>
            <p>いまの技と階層は消えます。最高記録は残ります。</p>
            <div class="result-actions">
              <button type="button" class="btn btn-primary" data-action="confirm-restart">はじめから</button>
              <button type="button" class="btn btn-ghost" data-action="close-modal">戻る</button>
            </div>
          </div>
        </div>
      `;
    }
    return "";
  }

  function render() {
    const state = W.getState();
    const prev = ui._screen;
    const scrollY = window.scrollY;
    const skillScroll = document.querySelector(".panel-skills") ? document.querySelector(".panel-skills").scrollTop : 0;
    const flowScroll = document.querySelector(".panel-flow") ? document.querySelector(".panel-flow").scrollTop : 0;
    let body = "";
    if (ui.screen === "title") body = renderTitle();
    else if (ui.screen === "prep") body = renderPrep();
    else if (ui.screen === "battle") body = renderBattle();
    else if (ui.screen === "clear") body = renderClear();
    app.innerHTML = `${body}${modal()}`;
    syncTitle();
    if (ui.screen === prev && ui.screen === "prep") {
      window.scrollTo(0, scrollY);
      const skills = document.querySelector(".panel-skills");
      const flow = document.querySelector(".panel-flow");
      if (skills) skills.scrollTop = skillScroll;
      if (flow) flow.scrollTop = flowScroll;
    } else if (ui.screen !== prev) {
      window.scrollTo(0, 0);
    }
    ui._screen = ui.screen;
    const log = document.querySelector("[data-log]");
    if (log) log.scrollTop = log.scrollHeight;
  }

  function beginRun(noticeText) {
    W.newRun();
    ui.hasSave = true;
    ui.screen = "prep";
    ui.tab = "enemy";
    ui.notice = noticeText;
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
      if (label) label.textContent = `${Math.max(0, Math.round(hp))} / ${max}`;
    });
  }

  function appendLog(event) {
    const log = document.querySelector("[data-log]");
    if (!log) return;
    const line = document.createElement("p");
    line.className = `log-line ${event.kind || "system"}`;
    line.textContent = event.text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function play() {
    clearTimeout(timer);
    const battle = ui.battle;
    if (!battle || battle.phase !== "playing") return;
    const delay = battle.index === 0 ? 280 : Math.round(720 / ui.speed);
    timer = setTimeout(step, delay);
  }

  function step() {
    const battle = ui.battle;
    if (!battle || battle.phase !== "playing") return;
    if (battle.index >= battle.events.length) {
      battle.phase = "done";
      render();
      return;
    }
    appendLog(battle.events[battle.index]);
    paintBars(battle.events[battle.index]);
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
    const pointsBefore = state.points;
    const bestBefore = state.bestCleared;
    const result = W.simulate({
      stats,
      enemy,
      levels: state.skills,
      flow: state.flow,
      keepLog: true,
    });
    let reward = 0;
    let cleared = false;
    if (result.winner === "player") {
      const applied = W.commitWin();
      reward = applied.reward;
      cleared = applied.cleared;
    }
    stopPlayback();
    ui.battle = {
      ...result,
      floor: enemy.floor,
      enemy,
      reward,
      cleared,
      pointsBefore,
      bestBefore,
      phase: "playing",
      index: 0,
    };
    ui.screen = "battle";
    ui.notice = "";
    ui.modal = null;
    render();
    play();
  }

  function onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "start") {
      beginRun("最初の技点が3ある。突破すると、さらに技点を得る。");
      return;
    }
    if (action === "continue") {
      const state = W.getState();
      ui.screen = state.clearedTower ? "clear" : "prep";
      ui.notice = "";
      ui.modal = null;
      render();
      return;
    }
    if (action === "restart") {
      ui.modal = "restart";
      ui.help = false;
      render();
      return;
    }
    if (action === "confirm-restart") {
      beginRun("記録は残したまま、1層から登り直す。");
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
    if (action === "set-tab") {
      ui.tab = button.dataset.tab;
      render();
      return;
    }
    if (action === "buy") {
      const id = button.dataset.skill;
      const before = W.getState().skills[id] || 0;
      const times = Number(button.dataset.times) || 1;
      const bought = W.buy(id, times);
      if (!bought) ui.notice = "技点が足りない。";
      else if (!before) ui.notice = "習得した。『手順』に加えると、戦闘で使う。";
      else ui.notice = `${bought}段階、強化した。威力の伸びは一定のまま。`;
      render();
      return;
    }
    if (action === "add-node") {
      const select = document.querySelector("[data-new-skill]");
      if (select && W.addNode(select.value)) ui.notice = "";
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
      button.textContent = `速度 ${ui.speed}x`;
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
    if (action === "next-floor" || action === "to-clear") {
      ui.notice =
        ui.battle && ui.battle.winner === "player"
          ? `第${ui.battle.floor}層を突破した。技点+${ui.battle.reward}。`
          : "";
      ui.screen = action === "to-clear" || (ui.battle && ui.battle.cleared) ? "clear" : "prep";
      ui.battle = null;
      render();
      return;
    }
    if (action === "rebuild") {
      ui.screen = "prep";
      ui.tab = "flow";
      ui.notice = "この階層のまま、技の手順を組み直せる。";
      ui.battle = null;
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
      ui.screen = "prep";
      ui.tab = "enemy";
      ui.notice = "1層からやり直す。技と技点は失った。最高記録は残っている。";
      render();
      return;
    }
    if (action === "climb-again") {
      beginRun("記録は残したまま、1層から登り直す。");
    }
  }

  function onChange(event) {
    const el = event.target;
    if (el.dataset.bind === "node-skill") {
      const ok = W.updateNode(Number(el.dataset.index), { skillId: el.value });
      if (!ok) ui.notice = "その技は別の手順に入っています。";
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

  function onInput(event) {
    const el = event.target;
    if (el.dataset.bind !== "node-value") return;
    const node = W.getState().flow[Number(el.dataset.index)];
    if (!node) return;
    const readout = el.parentElement && el.parentElement.querySelector(".cond-readout");
    if (readout) readout.textContent = W.conditionLabel({ type: node.cond.type, value: Number(el.value) });
  }

  function onKey(event) {
    if (event.key !== "Escape") return;
    if (!ui.modal && !ui.help) return;
    ui.modal = null;
    ui.help = false;
    render();
    if (ui.battle && ui.battle.phase === "playing") play();
  }

  function onBackdrop(event) {
    if (event.target.classList && event.target.classList.contains("modal")) {
      ui.modal = null;
      ui.help = false;
      render();
      if (ui.battle && ui.battle.phase === "playing") play();
    }
  }

  W.ui = {
    init(el) {
      app = el;
      ui.hasSave = W.load();
      if (!ui.hasSave) W.newRun({ persist: false });
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ui.speed = 4;
      app.addEventListener("click", onClick);
      app.addEventListener("click", onBackdrop);
      app.addEventListener("change", onChange);
      app.addEventListener("input", onInput);
      document.addEventListener("keydown", onKey);
    },
    render,
  };
  W.uiState = ui;
})(typeof window !== "undefined" ? window : globalThis);
