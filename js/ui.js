(function (root) {
  const W = root.Wot || (root.Wot = {});

  const ui = {
    screen: "title",
    detail: false,
    speed: 1,
    modal: null,
    help: false,
    patchNotes: false,
    offerStats: false,
    prepTab: "flow",
    battle: null,
    hasSave: false,
    expandedCard: null,
    pinnedStat: null,
    dragSkill: null,
    suppressCardClick: false,
  };

  let app = null;
  let timer = 0;
  let logFollow = true;
  let historyArmed = false;
  let historyQuiet = false;

  const STAT_ROWS_CORE = [
    ["maxHp", "体力", "plain"],
    ["atk", "攻撃力", "plain"],
    ["def", "防御力", "plain"],
  ];

  const STAT_ROWS_DETAIL = [
    ["currentHp", "現在体力", "current"],
    ["maxHp", "最大体力", "plain"],
    ["atk", "攻撃力", "plain"],
    ["def", "防御力", "plain"],
    ["regenInterval", "自動体力回復速度", "interval"],
    ["regenAmount", "自動体力回復量", "plain"],
    ["healEff", "体力回復効率", "pct"],
    ["atkEff", "攻撃力補助効率", "pct"],
    ["defEff", "防御力補助効率", "pct"],
    ["speed", "行動速度", "plain"],
    ["dmgBonus", "与ダメージ補正", "signedPct"],
    ["dmgReduction", "被ダメージ軽減", "signedPct"],
  ];

  const STAT_HELP = {
    currentHp: "いま残っている体力。0になると敗北する。",
    maxHp: "体力の上限。技や成長で増える。",
    atk: "与えるダメージの土台。高いほど敵を削りやすい。",
    def: "受けるダメージを抑える土台。高いほど削られにくい。",
    regenInterval: "自動回復が起きるまでの、自分の行動回数。短いほど回復が早い。",
    regenAmount: "自動回復で一度に戻る量の目安。",
    healEff: "回復技や自動回復の効き具合。高いほど回復が多い。",
    atkEff: "一時的な攻撃力上昇や、攻撃技の威力上乗せに必ず乗る。高いほどバフが厚くなる。",
    defEff: "一時的に防御力を上げる効果の乗りやすさ。",
    speed: "行動の速さ。高いほど自分の行動の順番が回りやすい。",
    dmgBonus: "与えるダメージ全体への補正。",
    dmgReduction: "受けるダメージ全体を減らす補正。負の値だと受けるダメージが増える。",
  };

  const GAIN_CORE = [
    ["maxHp", "体力", false],
    ["atk", "攻撃力", false],
    ["def", "防御力", false],
  ];

  const GAIN_EXTRA = [
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
    return `${(Number(value) * 100).toFixed(2)}%`;
  }

  function signedPct(value) {
    const n = Number(value) * 100;
    const body = n.toFixed(2);
    if (n > 0) return `+${body}%`;
    return `${body}%`;
  }

  function intNum(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return n < 0 ? Math.ceil(n) : Math.floor(n);
  }

  function signedPlain(value) {
    const n = Number(value) || 0;
    if (!Number.isFinite(n)) return "0";
    const rounded = Math.round(n * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
      const whole = Math.round(rounded);
      return whole > 0 ? `+${whole}` : String(whole);
    }
    const text = rounded.toFixed(1);
    return rounded > 0 ? `+${text}` : text;
  }

  function gainText(key, value, asPct) {
    if (asPct) return signedPct(value);
    if (key === "regenInterval") {
      const n = intNum(value);
      if (n < 0) return `${n}行動（速くなる）`;
      if (n > 0) return `+${n}行動（遅くなる）`;
      return "±0";
    }
    return signedPlain(value);
  }

  function formatStat(key, stats, hp, kind) {
    if (kind === "current") {
      const current = hp == null ? stats.maxHp : Math.max(0, intNum(hp));
      return `${current} / ${intNum(stats.maxHp)}`;
    }
    if (kind === "interval") return `${intNum(stats.regenInterval)}行動ごと`;
    if (kind === "pct") return pct(stats[key]);
    if (kind === "signedPct") return signedPct(stats[key]);
    return String(intNum(stats[key]));
  }

  function gameTitle() {
    return W.GAME_TITLE || "真・塔の戦士";
  }

  function syncTitle() {
    const state = W.getState();
    const name = gameTitle();
    if (ui.screen === "title") document.title = name;
    else if (ui.screen === "battle" && ui.battle) document.title = `第${ui.battle.floor}層 | ${name}`;
    else if (ui.screen === "clear") document.title = `頂 | ${name}`;
    else document.title = `第${state.floor}層 | ${name}`;
  }

  function shell(body, footer) {
    const state = W.getState();
    const floor =
      ui.screen === "battle" && ui.battle && ui.battle.phase === "playing"
        ? ui.battle.floor
        : state.floor;
    const best = state.bestCleared;
    const showMeta = ui.screen !== "title" && ui.screen !== "clear";
    const showDetail = showMeta;
    const showReroll = showMeta;
    return `
      <div class="shell shell-${ui.screen}">
        <header class="bar">
          <div class="bar-left">
            <strong class="brand">${esc(gameTitle())}</strong>
            ${showMeta ? `<span class="chip chip-floor">第${floor}層</span>` : ""}
            ${showMeta ? `<span class="chip muted chip-best">最高 ${best || "—"}</span>` : ""}
            ${
              showReroll
                ? `<span class="chip chip-reroll" title="${
                    W.isOpeningPick && W.isOpeningPick(state)
                      ? "最初の技獲得までは入れ替え無料・回数無制限"
                      : "階層クリアでたまる。候補の入れ替えに1消費"
                  }">リロール ${
                    W.isOpeningPick && W.isOpeningPick(state) ? "∞" : state.rerollPoints || 0
                  }</span>`
                : ""
            }
          </div>
          <div class="bar-right">
            ${
              showDetail
                ? `<button type="button" class="btn btn-ghost btn-compact" data-action="toggle-detail" aria-pressed="${ui.detail}">${
                    ui.detail ? "標準" : "詳細"
                  }</button>`
                : ""
            }
            <button type="button" class="btn btn-ghost btn-compact" data-action="patch-notes">履歴</button>
            <button type="button" class="btn btn-ghost btn-compact" data-action="help">遊び方</button>
          </div>
        </header>
        <main class="main main-${ui.screen}">${body}</main>
        ${footer || ""}
      </div>
    `;
  }

  function playerStatsList(stats, hp, opts) {
    const compact = !!(opts && opts.compact);
    const forceDetail = !!(opts && opts.forceDetail);
    let rows = forceDetail || ui.detail || compact ? STAT_ROWS_DETAIL : STAT_ROWS_CORE;
    if (opts && opts.hideCurrent) {
      rows = rows.filter(([key]) => key !== "currentHp");
    }
    const withTips = !!(opts && opts.tips);
    const listClass = `stat-list${withTips ? " has-tips" : ""}${compact ? " is-compact" : ""}`;
    return `
      <dl class="${listClass}">
        ${rows
          .map(([key, label, kind]) => {
            const help = STAT_HELP[key] || "";
            if (!withTips) {
              return `<div><dt>${label}</dt><dd>${esc(formatStat(key, stats, hp, kind))}</dd></div>`;
            }
            const pinned = ui.pinnedStat === key ? " is-pinned" : "";
            return `<div class="stat-row${pinned}" data-stat-key="${esc(key)}">
              <dt>
                <button type="button" class="stat-label" data-action="stat-tip" data-stat="${esc(key)}" aria-expanded="${
                  ui.pinnedStat === key ? "true" : "false"
                }">${esc(label)}</button>
              </dt>
              <dd>${esc(formatStat(key, stats, hp, kind))}</dd>
              <p class="stat-tip">${esc(help)}</p>
            </div>`;
          })
          .join("")}
      </dl>
    `;
  }

  function gainList(skill, level, mode) {
    const rows = ui.detail
      ? [...GAIN_CORE, ...GAIN_EXTRA.filter(([key]) => skill.gain[key])]
      : GAIN_CORE;
    const lv = Math.max(0, level || 0);
    const bonus = W.STACK_GAIN_BONUS || 0;
    // 所持／手順: 重複込みの合計。獲得画面: この獲得での上昇値（新規=基礎、強化=基礎×重複係数）
    const showOwnedTotal = mode === "owned" && lv >= 1;
    const totals =
      showOwnedTotal && W.gainFromSkill ? W.gainFromSkill(skill, lv) : null;
    const offerUpgrade = mode === "offer" && lv >= 1;
    return `
      <ul class="gains">
        ${rows
          .map(([key, label, asPct]) => {
            const base = skill.gain[key] || 0;
            let value = base;
            if (totals) value = totals[key] || 0;
            else if (offerUpgrade) value = base * bonus;
            return `<li><span>${label}</span><b>${esc(gainText(key, value, asPct))}</b></li>`;
          })
          .join("")}
      </ul>
    `;
  }

  function describeLines(skill, level, stats) {
    const raw = skill.describe(Math.max(1, level || 1), stats) || [];
    const filtered = raw.filter(
      (line) => !/行動あけると再使用|自分の行動を\d+回空けるとまた使える/.test(line)
    );
    return [...filtered, W.cooldownReuseText(skill.cooldown)];
  }

  const GROUP_STYLE = {
    攻撃: { slug: "attack", tag: "攻撃", tip: "攻撃技" },
    崩し: { slug: "break", tag: "弱体", tip: "崩し・弱体技" },
    守り: { slug: "guard", tag: "守り", tip: "守り技" },
    回復: { slug: "heal", tag: "回復", tip: "回復技" },
    補助: { slug: "buff", tag: "強化", tip: "補助・強化技" },
  };

  function groupStyle(skill) {
    return (
      GROUP_STYLE[skill && skill.group] || {
        slug: "other",
        tag: (skill && skill.group) || "技",
        tip: "技",
      }
    );
  }

  function skillGroupTag(skill) {
    const g = groupStyle(skill);
    return `<span class="skill-tag skill-tag-${esc(g.slug)}" title="${esc(g.tip)}">${esc(g.tag)}</span>`;
  }

  function skillCardInner(skill, state, kind) {
    const sourceKind = kind === "zoom" && ui.expandedCard ? ui.expandedCard.kind : kind;
    const level = state.skills[skill.id] || 0;
    const stats = W.computeStats(state.skills);
    const lines = describeLines(skill, Math.max(1, level || 1), stats);
    const showFull = ui.detail || kind === "zoom";
    const meta =
      sourceKind === "offer"
        ? `${level ? `Lv.${level}→${level + 1}` : "新規"} · ${W.cooldownShort(skill.cooldown)}`
        : `Lv.${level} · ${W.cooldownShort(skill.cooldown)}`;
    let bodyExtra = "";
    if (sourceKind === "offer") {
      bodyExtra += gainList(skill, level, "offer");
    } else if (showFull) {
      bodyExtra += gainList(skill, level, "owned");
    } else if (sourceKind === "owned" && level >= 2) {
      // 重複で付随ステータスが伸びているときは、標準表示でも合計値を出す
      bodyExtra += gainList(skill, level, "owned");
    }
    if (showFull) {
      bodyExtra += `<div class="skill-detail">
        ${lines.map((line) => `<p>${esc(line)}</p>`).join("")}
        <p class="trade">${esc(skill.tradeoff)}</p>
      </div>`;
    } else {
      bodyExtra += `<div class="skill-detail skill-detail-lite">
        ${
          sourceKind === "owned"
            ? lines
                .slice(0, -1)
                .slice(0, 1)
                .map((line) => `<p>${esc(line)}</p>`)
                .join("")
            : ""
        }
        <p class="skill-cd">${esc(W.cooldownReuseText(skill.cooldown))}</p>
      </div>`;
    }
    return `
      <div class="skill-body">
        <header class="skill-top">
          <div class="skill-title-row">
            ${skillGroupTag(skill)}
            <strong>${esc(skill.name)}</strong>
          </div>
          <span class="skill-meta">${esc(meta)}</span>
        </header>
        <p class="skill-blurb">${esc(skill.blurb)}</p>
        ${bodyExtra}
      </div>
      ${
        sourceKind === "offer"
          ? `<button type="button" class="btn btn-primary" data-action="pick" data-skill="${esc(skill.id)}">獲得</button>`
          : ""
      }
    `;
  }

  function offerCard(id, state) {
    const skill = W.SKILL_BY_ID[id];
    if (!skill) return "";
    const g = groupStyle(skill);
    return `
      <article
        class="skill-card offer-card is-interactive group-${esc(g.slug)} ${ui.detail ? "is-detail" : ""}"
        data-card-kind="offer"
        data-card-id="${esc(id)}"
        data-group="${esc(skill.group || "")}"
        role="button"
        tabindex="0"
        aria-label="${esc(g.tag)} ${esc(skill.name)}の詳細を開く"
      >
        ${skillCardInner(skill, state, "offer")}
      </article>
    `;
  }

  function ownedSkillCard(id, state) {
    const skill = W.SKILL_BY_ID[id];
    if (!skill) return "";
    const g = groupStyle(skill);
    const inFlow = state.flow.some((node) => node.skillId === id);
    const canDrag = !inFlow && state.flow.length < W.MAX_FLOW;
    const mobileExtra = canDrag
      ? `<button type="button" class="btn btn-primary btn-add-flow m-only" data-action="add-flow-skill" data-skill="${esc(id)}">手順へ追加</button>`
      : !inFlow
        ? `<p class="owned-status is-full m-only">手順がいっぱい</p>`
        : "";
    return `
      <article
        class="skill-card owned-card is-interactive group-${esc(g.slug)} ${ui.detail ? "is-detail" : ""}${
          canDrag ? " is-draggable" : ""
        }${inFlow ? " is-in-flow" : ""}"
        data-card-kind="owned"
        data-card-id="${esc(id)}"
        data-group="${esc(skill.group || "")}"
        ${canDrag ? `draggable="true" data-drag-skill="${esc(id)}"` : ""}
        role="button"
        tabindex="0"
        aria-label="${esc(g.tag)} ${esc(skill.name)}${inFlow ? "（手順で使用中）" : canDrag ? "（手順へ追加可）" : ""}の詳細を開く"
      >
        ${skillCardInner(skill, state, "owned")}
        ${inFlow ? `<p class="tiny owned-used">手順で使用中</p>` : ""}
        ${mobileExtra}
      </article>
    `;
  }

  function flowDropSlot(index, empty) {
    return `
      <li
        class="flow-drop${empty ? " is-empty" : ""}"
        data-drop-index="${index}"
        aria-label="${empty ? "ここに技をドロップして手順へ" : `ここに挿入（${index + 1}番目）`}"
      >
        <span class="pc-only">${empty ? "技をここにドロップ" : "ここに挿入"}</span>
        <span class="m-only" aria-hidden="true">${empty ? "下の技をタップして追加" : ""}</span>
      </li>
    `;
  }

  function flowPaletteChip(id) {
    const skill = W.SKILL_BY_ID[id];
    if (!skill) return "";
    const g = groupStyle(skill);
    const level = W.getState().skills[id] || 1;
    return `
      <button
        type="button"
        class="flow-chip skill-tag-${esc(g.slug)} is-draggable"
        draggable="true"
        data-drag-skill="${esc(id)}"
        data-action="add-flow-skill"
        data-skill="${esc(id)}"
        title="手順へ追加（PCはドラッグ）"
        aria-label="${esc(skill.name)}を手順へ追加"
      >
        <span class="flow-chip-tag m-only">${esc(g.tag)}</span>
        <span class="flow-chip-name">${esc(skill.name)}</span>
        <span class="flow-chip-lv m-only">Lv.${level}</span>
        <span class="flow-chip-cta m-only">＋追加</span>
      </button>
    `;
  }

  function cardZoomOverlay() {
    if (!ui.expandedCard) return "";
    const state = W.getState();
    const skill = W.SKILL_BY_ID[ui.expandedCard.id];
    if (!skill) return "";
    const g = groupStyle(skill);
    return `
      <div class="card-zoom-backdrop" data-action="close-card-zoom">
        <article class="skill-card card-zoom group-${esc(g.slug)}" data-card-zoom data-card-id="${esc(skill.id)}" data-group="${esc(skill.group || "")}" role="dialog" aria-modal="true">
          ${skillCardInner(skill, state, "zoom")}
          <p class="card-zoom-hint">もう一度クリック、または外側クリックで閉じる</p>
        </article>
      </div>
    `;
  }

  function renderOffer() {
    const state = W.getState();
    W.ensureOffer();
    const offer = state.offer || [];
    const points = state.rerollPoints || 0;
    const freeReroll = W.isOpeningPick ? W.isOpeningPick(state) : false;
    const canReroll = freeReroll || points >= 1;
    const stats = W.computeStats(state.skills);
    const ownedCount = Object.keys(state.skills).filter((id) => state.skills[id] > 0).length;
    return shell(
      `
      <p class="hint offer-hint">技を1つ選ぶ（${W.SKILLS.length}種から${offer.length}） · いま${ui.detail ? "詳細" : "標準"}表示 · カードを開いて確認</p>
      <div class="offer-self">
        <div class="offer-self-stats" aria-label="いまの能力（要約）">
          <span><b>体力</b>${intNum(stats.maxHp)}</span>
          <span><b>攻撃</b>${intNum(stats.atk)}</span>
          <span><b>防御</b>${intNum(stats.def)}</span>
          <span class="tiny">習得 ${ownedCount}</span>
        </div>
        <button type="button" class="btn btn-ghost btn-compact" data-action="offer-stats" aria-expanded="${ui.offerStats ? "true" : "false"}">
          能力を見る
        </button>
      </div>
      <p class="group-legend" aria-hidden="true">
        <span class="skill-tag skill-tag-attack">攻撃</span>
        <span class="skill-tag skill-tag-break">弱体</span>
        <span class="skill-tag skill-tag-guard">守り</span>
        <span class="skill-tag skill-tag-heal">回復</span>
        <span class="skill-tag skill-tag-buff">強化</span>
      </p>
      <div class="offer-grid">
        ${offer.map((id) => offerCard(id, state)).join("")}
      </div>
    `,
      `<footer class="foot foot-offer">
        <span class="tiny foot-note">${
          freeReroll
            ? "最初の獲得は入れ替え無料・回数無制限"
            : `リロール ${points}（クリアで+1）`
        }</span>
        <button type="button" class="btn btn-ghost" data-action="reroll" ${canReroll ? "" : "disabled"}>
          ${freeReroll ? "入れ替え（無料）" : "入れ替え（1）"}
        </button>
      </footer>`
    );
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

  function valueField(meta, index, condIndex, value) {
    const unit = meta.unit || "";
    const id = `val-${index}-${condIndex}`;
    return `
      <div class="value-field">
        <label class="sr" for="${id}">数値</label>
        <input
          id="${id}"
          type="number"
          inputmode="numeric"
          data-bind="node-value"
          data-index="${index}"
          data-cond-index="${condIndex}"
          min="${meta.min}"
          max="${meta.max}"
          step="${meta.step}"
          value="${value}"
        />
        <span class="value-unit">${esc(unit)}</span>
      </div>
    `;
  }

  function renderFlowConds(node, index) {
    const conds = W.nodeConds ? W.nodeConds(node) : node.conds || [node.cond || { type: "always" }];
    const join = node.join === "or" ? "or" : "and";
    const maxConds = W.MAX_CONDS || 3;
    const joinRow =
      conds.length > 1
        ? `<div class="cond-join">
            <label class="sr" for="join-${index}">条件のつなぎ方</label>
            <select id="join-${index}" data-bind="node-join" data-index="${index}">
              <option value="and" ${join === "and" ? "selected" : ""}>すべて満たす（かつ）</option>
              <option value="or" ${join === "or" ? "selected" : ""}>どれか満たす（または）</option>
            </select>
          </div>`
        : "";
    const rows = conds
      .map((cond, condIndex) => {
        const meta = W.CONDITION_BY_TYPE[cond.type] || W.CONDITION_BY_TYPE.always;
        const value = cond.value == null ? meta.def : cond.value;
        return `
          <div class="cond-row">
            <select data-bind="node-cond" data-index="${index}" data-cond-index="${condIndex}">
              ${W.CONDITIONS.map(
                (item) =>
                  `<option value="${item.type}" ${item.type === meta.type ? "selected" : ""}>${esc(item.label)}</option>`
              ).join("")}
            </select>
            ${meta.value ? valueField(meta, index, condIndex, value) : `<span class="value-spacer"></span>`}
            ${
              conds.length > 1
                ? `<button type="button" class="btn btn-ghost btn-icon" data-action="remove-cond" data-index="${index}" data-cond-index="${condIndex}" aria-label="条件を外す"><span aria-hidden="true">×</span><span class="btn-lab">外す</span></button>`
                : ""
            }
          </div>
        `;
      })
      .join("");
    const addBtn =
      conds.length < maxConds
        ? `<button type="button" class="btn btn-ghost btn-cond-add" data-action="add-cond" data-index="${index}">条件を足す</button>`
        : "";
    return `<div class="flow-conds">${joinRow}${rows}${addBtn}</div>`;
  }

  function renderPrep() {
    const state = W.getState();
    const stats = W.computeStats(state.skills);
    const ownedIds = Object.keys(state.skills).filter((id) => state.skills[id] > 0);
    const unused = ownedIds.filter((id) => !state.flow.some((node) => node.skillId === id));

    const nodes = state.flow
      .map((node, index) => {
        const skill = W.SKILL_BY_ID[node.skillId];
        const g = skill ? groupStyle(skill) : null;
        return `
          ${flowDropSlot(index, false)}
          <li class="flow-item${g ? ` group-${esc(g.slug)}` : ""}">
            <div class="flow-item-head">
              <span class="idx" aria-hidden="true">${index + 1}</span>
              <div class="flow-item-title">
                <span class="flow-item-label m-only">手順 ${index + 1} · 技を選ぶ</span>
                <label class="sr" for="node-skill-${index}">技</label>
                <select id="node-skill-${index}" data-bind="node-skill" data-index="${index}">${ownedOptions(state, node.skillId)}</select>
              </div>
            </div>
            <div class="flow-mini" role="group" aria-label="手順の操作">
              <button type="button" class="btn btn-ghost btn-icon" data-action="move-node" data-index="${index}" data-dir="-1" ${index === 0 ? "disabled" : ""} aria-label="上へ"><span aria-hidden="true">↑</span><span class="btn-lab">上へ</span></button>
              <button type="button" class="btn btn-ghost btn-icon" data-action="move-node" data-index="${index}" data-dir="1" ${index === state.flow.length - 1 ? "disabled" : ""} aria-label="下へ"><span aria-hidden="true">↓</span><span class="btn-lab">下へ</span></button>
              <button type="button" class="btn btn-ghost btn-icon btn-remove-node" data-action="remove-node" data-index="${index}" aria-label="外す"><span aria-hidden="true">×</span><span class="btn-lab">外す</span></button>
            </div>
            <div class="flow-conds-wrap">
              <p class="flow-conds-label m-only">使う条件</p>
              ${renderFlowConds(node, index)}
            </div>
          </li>
        `;
      })
      .join("");

    const addable = unused
      .map((id) => `<option value="${id}">${esc(W.SKILL_BY_ID[id].name)}</option>`)
      .join("");
    const canAdd = state.flow.length < W.MAX_FLOW && unused.length > 0;
    const dropTail = canAdd || state.flow.length > 0 ? flowDropSlot(state.flow.length, state.flow.length === 0) : "";

    if (!ui.prepTab || !["stats", "skills", "flow"].includes(ui.prepTab)) ui.prepTab = "flow";

    return shell(
      `
      <nav class="prep-tabs" role="tablist" aria-label="準備画面の切替">
        <button type="button" class="prep-tab ${ui.prepTab === "stats" ? "is-active" : ""}" data-action="prep-tab" data-tab="stats" role="tab" aria-selected="${ui.prepTab === "stats"}">能力</button>
        <button type="button" class="prep-tab ${ui.prepTab === "skills" ? "is-active" : ""}" data-action="prep-tab" data-tab="skills" role="tab" aria-selected="${ui.prepTab === "skills"}">習得技 ${ownedIds.length}</button>
        <button type="button" class="prep-tab ${ui.prepTab === "flow" ? "is-active" : ""}" data-action="prep-tab" data-tab="flow" role="tab" aria-selected="${ui.prepTab === "flow"}">手順 ${state.flow.length}</button>
      </nav>
      <div class="prep-grid" data-prep-tab="${esc(ui.prepTab)}">
        <section class="pane pane-stats ${ui.prepTab === "stats" ? "is-active" : ""}" data-prep-pane="stats">
          <h2>能力</h2>
          ${playerStatsList(stats, null, { tips: true })}
          <p class="tiny">習得 ${ownedIds.length}種 · ${ui.detail ? "詳細" : "標準"} · 能力名で説明</p>
        </section>
        <section class="pane pane-skills ${ui.prepTab === "skills" ? "is-active" : ""}" data-prep-pane="skills">
          <h2>習得技</h2>
          <p class="tiny pane-hint pc-only">未使用の技は手順へドラッグできる</p>
          <p class="tiny pane-hint m-only">未使用の技は「手順へ追加」で入れられる。カード本体をタップすると詳細。</p>
          <div class="owned-grid">
            ${
              ownedIds.length
                ? ownedIds.map((id) => ownedSkillCard(id, state)).join("")
                : `<p class="empty">まだ技がない</p>`
            }
          </div>
        </section>
        <section class="pane pane-flow ${ui.prepTab === "flow" ? "is-active" : ""}" data-prep-pane="flow">
          <h2>手順 <span class="tiny">上から判定・外れは通常攻撃</span></h2>
          <p class="flow-guide m-only">上から順に判定。条件が合えばその技、どれも外れれば通常攻撃。</p>
          <ol class="flow-list" data-flow-list>
            ${
              state.flow.length
                ? `${nodes}${dropTail}`
                : canAdd
                  ? dropTail
                  : `<li class="empty">手順なし → 通常攻撃のみ</li>`
            }
            <li class="fallback">↓ 通常攻撃</li>
          </ol>
          ${
            canAdd
              ? `<div class="flow-palette" aria-label="手順に追加できる技">
                  <p class="tiny pc-only">ドラッグして手順のすき間へ（間にも挿入可）</p>
                  <p class="flow-palette-title m-only">未使用の技を追加 <span class="tiny">タップで末尾へ</span></p>
                  <div class="flow-chips">${unused.map((id) => flowPaletteChip(id)).join("")}</div>
                </div>`
              : state.flow.length >= W.MAX_FLOW
                ? `<p class="flow-full m-only">手順は最大${W.MAX_FLOW}個まで（外して入れ替え）</p>`
                : ""
          }
          ${
            canAdd
              ? `<div class="add-row pc-only">
                  <select data-new-skill>${addable}</select>
                  <button type="button" class="btn btn-ghost" data-action="add-node">追加</button>
                </div>`
              : ""
          }
        </section>
      </div>
    `,
      `<footer class="foot foot-prep">
        <button type="button" class="btn btn-primary btn-fight" data-action="fight">第${state.floor}層に挑む</button>
      </footer>`
    );
  }

  function renderTitle() {
    const state = W.getState();
    const ver = W.latestPatchVersion ? W.latestPatchVersion() : "";
    return shell(`
      <div class="title-pane">
        <p class="eyebrow">${esc(W.GAME_TITLE_EN || "True Warrior of the Tower")}</p>
        <h1>${esc(gameTitle())}</h1>
        <p class="lede">技を1つ選び、手順を組んで自動戦闘で百層を登る。</p>
        <p class="record">${state.bestCleared ? `最高 ${state.bestCleared}層` : "記録なし"}</p>
        <div class="title-actions">
          ${
            ui.hasSave
              ? `<button type="button" class="btn btn-primary" data-action="continue">続きから</button>
                 <button type="button" class="btn btn-ghost" data-action="restart">はじめから</button>`
              : `<button type="button" class="btn btn-primary" data-action="start">塔に入る</button>`
          }
          <button type="button" class="btn btn-ghost" data-action="patch-notes">更新履歴${
            ver ? ` <span class="tiny">v${esc(ver)}</span>` : ""
          }</button>
        </div>
      </div>
    `);
  }

  function logSideLabel(side) {
    if (side === "enemy") return "敵";
    if (side === "player") return "あなた";
    return "";
  }

  function formatLogLine(event) {
    const classes = [event.kind || "system"];
    if (event.side === "player") classes.push("side-player");
    if (event.side === "enemy") classes.push("side-enemy");
    let mark = "";
    if (event.actionNo > 0 && event.side) {
      const who = logSideLabel(event.side);
      mark = `<span class="log-act">${esc(who)}第${event.actionNo}行動</span>`;
    }
    return `<p class="${esc(classes.join(" "))}">${mark}${esc(event.text)}</p>`;
  }

  function formatActLabel(battle, latest) {
    const p = battle.playerActions || 0;
    const e = battle.enemyActions || 0;
    if (latest && latest.actionNo > 0 && latest.side) {
      const who = logSideLabel(latest.side);
      return `${who}第${latest.actionNo}行動（あなた${p} / 敵${e}）`;
    }
    return `あなた${p}行動 / 敵${e}行動`;
  }

  function appendLogLine(log, event) {
    const wrap = document.createElement("div");
    wrap.innerHTML = formatLogLine(event);
    const line = wrap.firstElementChild;
    if (line) log.appendChild(line);
  }

  function isLogNearBottom(log) {
    return log.scrollHeight - log.scrollTop - log.clientHeight < 28;
  }

  function scrollLogToBottom(log) {
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }

  function bindLogScroll(log) {
    if (!log || log.dataset.boundScroll) return;
    log.dataset.boundScroll = "1";
    log.addEventListener("scroll", () => {
      logFollow = isLogNearBottom(log);
    });
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
    const actLabel = formatActLabel(battle, latest);

    let foot = "";
    if (battle.phase === "done") {
      if (battle.winner === "player" && battle.cleared) {
        foot = `<footer class="foot result win"><span>第100層突破</span><button type="button" class="btn btn-primary" data-action="to-clear">頂へ</button></footer>`;
      } else if (battle.winner === "player") {
        foot = `<footer class="foot result win"><span>第${battle.floor}層突破</span><button type="button" class="btn btn-primary" data-action="next-floor">次へ</button></footer>`;
      } else {
        foot = `<footer class="foot result lose">
          <span>敗北</span>
          <button type="button" class="btn btn-primary" data-action="rebuild">手順を組み直す</button>
          <button type="button" class="btn btn-danger" data-action="give-up">諦める</button>
        </footer>`;
      }
    } else {
      foot = `<footer class="foot">
        <button type="button" class="btn btn-ghost" data-action="speed">${ui.speed}x</button>
        <button type="button" class="btn btn-primary" data-action="skip">結果へ</button>
      </footer>`;
    }

    return shell(
      `
      <div class="battle-pane${ui.detail ? " is-detail" : ""}">
        <div class="bars">
          <div class="fighter fighter-player">
            <div class="bar-label"><span>あなた</span><span data-hp-label="player">${Math.max(0, intNum(playerHp))}/${intNum(stats.maxHp)}</span></div>
            <div class="hp"><span data-bar="player" style="width:${pRate}%"></span></div>
            ${
              ui.detail
                ? `<div class="battle-stats" aria-label="詳細能力">${playerStatsList(stats, playerHp, {
                    compact: true,
                  })}</div>`
                : ""
            }
          </div>
          <div class="fighter fighter-enemy">
            <div class="bar-label"><span>敵</span><span data-hp-label="enemy">${Math.max(0, intNum(enemyHp))}/${intNum(enemy.maxHp)}</span></div>
            <div class="hp enemy"><span data-bar="enemy" style="width:${eRate}%"></span></div>
          </div>
        </div>
        <div class="log-head">
          <span>戦闘ログ</span>
          <span data-act-label>${actLabel}</span>
        </div>
        <div class="log" data-log>
          ${shown.map(formatLogLine).join("")}
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

  function renderPatchNotesBody() {
    const notes = W.PATCH_NOTES || [];
    if (!notes.length) return `<p class="muted">まだ更新履歴はありません。</p>`;
    return notes
      .map((entry) => {
        const sections = (entry.sections || [])
          .map((sec) => {
            const items = (sec.items || []).map((item) => `<li>${esc(item)}</li>`).join("");
            return `<h3 class="patch-h">${esc(sec.heading)}</h3><ul class="patch-list">${items}</ul>`;
          })
          .join("");
        return `
          <article class="patch-entry">
            <header class="patch-head">
              <strong>v${esc(entry.version)}</strong>
              <span class="muted">${esc(entry.date || "")}</span>
              <p class="patch-title">${esc(entry.title || "")}</p>
            </header>
            ${sections}
          </article>`;
      })
      .join("");
  }

  function modal() {
    if (ui.offerStats) {
      const state = W.getState();
      const stats = W.computeStats(state.skills);
      const ownedCount = Object.keys(state.skills).filter((id) => state.skills[id] > 0).length;
      return `
        <div class="modal" role="dialog" aria-modal="true" aria-label="いまの能力">
          <div class="modal-card">
            <h2>いまの能力</h2>
            <p class="tiny muted">習得 ${ownedCount}種 · 候補選ぶ前の確認</p>
            ${playerStatsList(stats, null, { forceDetail: true, hideCurrent: true, tips: true })}
            <button type="button" class="btn btn-primary" data-action="close-modal">閉じる</button>
          </div>
        </div>`;
    }
    if (ui.patchNotes) {
      return `
        <div class="modal" role="dialog" aria-modal="true" aria-label="更新履歴">
          <div class="modal-card modal-card-wide">
            <h2>更新履歴</h2>
            <p class="tiny muted">スキル数値や仕様の変更は、できるだけここに細かく書きます。</p>
            <div class="patch-scroll">${renderPatchNotesBody()}</div>
            <button type="button" class="btn btn-primary" data-action="close-modal">閉じる</button>
          </div>
        </div>`;
    }
    if (ui.help) {
      return `
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-card">
            <h2>遊び方</h2>
            <ul>
              <li>100層突破が目標。戦いは自動。</li>
              <li>約${W.SKILLS.length}種の技から毎回5つ提示。1つだけ獲得／強化。</li>
              <li>最初の技を得るまでは候補の入れ替えが無料で何度でもできる。2つ目以降はリロールポイントを1消費。</li>
              <li>階層クリアごとにリロールポイントが1たまる。候補画面で1消費し、5枚を全技から入れ替えられる（上限なし）。</li>
              <li>同じ技を重ねると効果は伸びる。付随ステータスは1枚目が満額で、2枚目以降は基礎gainの約${Math.round(
                (W.STACK_GAIN_BONUS || 0.3) * 100
              )}%分だけ追加（例: +6なら2枚で約+7.8）。</li>
              <li>手順は最大${W.MAX_FLOW}個。上から判定し、外れは通常攻撃。習得技をドラッグして手順のすき間へ挿入できる。</li>
              <li>再使用は「自分の行動を何回空けるか」。</li>
              <li>戦闘ログの行動番号は、あなたと敵で別々に数える。</li>
              <li>使用条件は体力・序盤／終盤・直前の行動・強化弱体などから選ぶ。1つの技に最大${W.MAX_CONDS || 3}つまで付けられ、「かつ／または」でつなげる。</li>
              <li>比較の言葉: ${(W.COMPARE_RULES_HELP || []).join(" ")}</li>
              <li>戦闘の倍速は 1／2／4／8／16 倍。</li>
              <li>技カードはクリックで拡大表示。能力名に触れると説明が出る。</li>
              <li>技の候補画面では「能力を見る」でいまのステータスを確認できる。</li>
              <li>敵は序盤だけ弱く、以降は急に強くなる。50層以降は浅い層の敵を混ぜず、専用ローテのビルドのみ。100層は育成と手順が要る。</li>
              <li>回復技は少なめ。自動回復に注目した技もある。</li>
              <li>残響・階調・血契・返礼・共鳴・時縫い・終焔・虚盾・溢光・無限廊など、ビルドを変える癖の強い技もある。</li>
              <li>標準／詳細で表示量を切り替えられる。</li>
              <li>「更新履歴」にパッチノートがある。数値調整はそこに追記される。</li>
              <li>毒や終焔など遅延するダメージは、付与した時点の攻撃力・与ダメ補正を使い、防御・軽減はダメージ発生時のものを使う。</li>
              <li>ブラウザの戻るで、カード拡大や履歴・確認ダイアログなどを一段ずつ閉じる（ページ自体は閉じない）。</li>
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
    let body = "";
    if (ui.screen === "title") body = renderTitle();
    else if (ui.screen === "offer") body = renderOffer();
    else if (ui.screen === "prep") body = renderPrep();
    else if (ui.screen === "battle") body = renderBattle();
    else if (ui.screen === "clear") body = renderClear();
    app.innerHTML = `${body}${modal()}${cardZoomOverlay()}`;
    syncTitle();
    const log = document.querySelector("[data-log]");
    if (log) {
      bindLogScroll(log);
      if (logFollow) scrollLogToBottom(log);
    }
  }

  function closeOverlays() {
    ui.modal = null;
    ui.help = false;
    ui.patchNotes = false;
    ui.offerStats = false;
  }

  /** ブラウザ履歴を1段足し、戻る操作をアプリ内で受け取る */
  function armHistoryTrap() {
    if (typeof history === "undefined" || !history.pushState) return;
    historyQuiet = true;
    try {
      if (!history.state || !history.state.wot) {
        history.replaceState({ wot: true, root: true }, "", location.href);
      }
      history.pushState({ wot: true, t: Date.now() }, "", location.href);
      historyArmed = true;
    } catch (err) {
      historyArmed = false;
    }
    historyQuiet = false;
  }

  function goTitleScreen() {
    stopPlayback();
    ui.battle = null;
    closeOverlays();
    ui.expandedCard = null;
    ui.screen = "title";
    ui.hasSave = W.hasSave ? W.hasSave() : ui.hasSave;
    render();
  }

  /**
   * 戻るキー／ジェスチャ1回分。上から順に UI を閉じる。
   * @returns {boolean} 何かしらの UI を戻したら true
   */
  function undoUiStep() {
    if (ui.expandedCard) {
      closeCardZoom(true);
      return true;
    }
    if (ui.modal || ui.help || ui.patchNotes || ui.offerStats) {
      closeOverlays();
      if (W.sfx) W.sfx.ui();
      render();
      return true;
    }
    if (ui.screen === "prep" && ui.prepTab && ui.prepTab !== "flow") {
      ui.prepTab = "flow";
      if (W.sfx) W.sfx.ui();
      render();
      return true;
    }
    if (ui.screen === "battle" && ui.battle) {
      if (ui.battle.phase === "playing") {
        // 再生中の戻る → 結果へ（セーブは戦闘開始時に確定済み）
        stopPlayback();
        ui.battle.index = ui.battle.events.length;
        ui.battle.phase = "done";
        if (W.sfx) {
          if (ui.battle.winner === "player") W.sfx.win();
          else W.sfx.lose();
        }
        if (W.sfx) W.sfx.ui();
        render();
        return true;
      }
      // 結果画面の戻る → 手順へ（敗北の「組み直す」と同じ）
      stopPlayback();
      ui.battle = null;
      ui.screen = "prep";
      if (W.sfx) W.sfx.ui();
      render();
      return true;
    }
    if (ui.screen === "offer" || ui.screen === "prep" || ui.screen === "clear") {
      goTitleScreen();
      if (W.sfx) W.sfx.ui();
      return true;
    }
    // タイトルでは何もしない（サイトを閉じない）
    return false;
  }

  function onPopState() {
    if (historyQuiet) return;
    // すぐ再アームして、連続の戻るでもページ外へ出ない
    armHistoryTrap();
    undoUiStep();
  }

  function beginRun() {
    W.newRun();
    ui.hasSave = true;
    ui.screen = "offer";
    closeOverlays();
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
      if (label) label.textContent = `${Math.max(0, intNum(hp))}/${intNum(max)}`;
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
    const pinned = !log || isLogNearBottom(log);
    if (log) {
      bindLogScroll(log);
      appendLogLine(log, event);
      if (pinned || logFollow) {
        logFollow = true;
        scrollLogToBottom(log);
      }
    }
    const actLabel = document.querySelector("[data-act-label]");
    if (actLabel) actLabel.textContent = formatActLabel(battle, event);
    paintBars(event);
    if (W.sfx) W.sfx.forEvent(event.kind);
    battle.index += 1;
    if (battle.index >= battle.events.length) {
      battle.phase = "done";
      if (W.sfx) {
        if (battle.winner === "player") W.sfx.win();
        else W.sfx.lose();
      }
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
    logFollow = true;
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
    if (W.sfx) W.sfx.start();
    play();
  }

  function enterRunScreen() {
    const state = W.getState();
    ui.screen = routeScreen(state);
    if (ui.screen === "offer") W.ensureOffer();
    render();
  }

  function closeCardZoom(playSound) {
    if (!ui.expandedCard) return;
    ui.expandedCard = null;
    if (playSound && W.sfx) W.sfx.collapse();
    render();
  }

  function toggleCardZoom(kind, id) {
    if (ui.expandedCard && ui.expandedCard.kind === kind && ui.expandedCard.id === id) {
      closeCardZoom(true);
      return;
    }
    ui.expandedCard = { kind, id };
    if (W.sfx) W.sfx.expand();
    render();
  }

  function onClick(event) {
    if (W.sfx) W.sfx.unlock();

    const zoomCard = event.target.closest("[data-card-zoom]");
    if (ui.expandedCard && event.target.closest("[data-action='close-card-zoom']") && !zoomCard) {
      closeCardZoom(true);
      return;
    }
    if (ui.expandedCard && zoomCard && !event.target.closest("[data-action]")) {
      closeCardZoom(true);
      return;
    }

    const button = event.target.closest("[data-action]");
    if (button && !button.disabled) {
      const action = button.dataset.action;

      if (action === "close-card-zoom") {
        closeCardZoom(true);
        return;
      }
      if (action === "stat-tip") {
        const key = button.dataset.stat;
        ui.pinnedStat = ui.pinnedStat === key ? null : key;
        if (W.sfx) W.sfx.tip();
        render();
        return;
      }
      if (action === "start") {
        if (W.sfx) W.sfx.ui();
        beginRun();
        return;
      }
      if (action === "continue") {
        if (W.sfx) W.sfx.ui();
        enterRunScreen();
        return;
      }
      if (action === "restart") {
        if (W.sfx) W.sfx.ui();
        ui.modal = "restart";
        ui.help = false;
        ui.patchNotes = false;
        render();
        return;
      }
      if (action === "confirm-restart") {
        if (W.sfx) W.sfx.ui();
        beginRun();
        return;
      }
      if (action === "help") {
        if (W.sfx) W.sfx.ui();
        ui.help = true;
        ui.patchNotes = false;
        ui.modal = null;
        render();
        return;
      }
      if (action === "patch-notes") {
        if (W.sfx) W.sfx.ui();
        ui.patchNotes = true;
        ui.help = false;
        ui.modal = null;
        render();
        return;
      }
      if (action === "close-modal") {
        if (W.sfx) W.sfx.ui();
        closeOverlays();
        render();
        return;
      }
      if (action === "offer-stats") {
        if (W.sfx) W.sfx.ui();
        ui.offerStats = true;
        ui.help = false;
        ui.patchNotes = false;
        ui.modal = null;
        render();
        return;
      }
      if (action === "toggle-detail") {
        if (W.sfx) W.sfx.ui();
        ui.detail = !ui.detail;
        render();
        if (ui.battle && ui.battle.phase === "playing") play();
        return;
      }
      if (action === "prep-tab") {
        if (W.sfx) W.sfx.ui();
        const tab = button.getAttribute("data-tab");
        if (tab === "stats" || tab === "skills" || tab === "flow") {
          ui.prepTab = tab;
          render();
        }
        return;
      }
      if (action === "pick") {
        if (W.pickSkill(button.dataset.skill)) {
          ui.expandedCard = null;
          if (W.sfx) W.sfx.pick();
          ui.screen = "prep";
          render();
        }
        return;
      }
      if (action === "reroll") {
        if (W.rerollOffer()) {
          ui.expandedCard = null;
          if (W.sfx) W.sfx.ui();
          render();
        }
        return;
      }
      if (action === "add-node") {
        if (W.sfx) W.sfx.ui();
        const select = document.querySelector("[data-new-skill]");
        if (select) W.addNode(select.value);
        render();
        return;
      }
      if (action === "add-flow-skill") {
        // PCはドラッグ操作のまま。タップ追加は狭い画面のみ。
        if (!window.matchMedia("(max-width: 720px)").matches) return;
        if (ui.suppressCardClick) {
          ui.suppressCardClick = false;
          return;
        }
        const skillId = button.getAttribute("data-skill");
        if (skillId && W.addNode(skillId)) {
          if (W.sfx) W.sfx.ui();
          ui.prepTab = "flow";
          render();
        }
        return;
      }
      if (action === "remove-node") {
        if (W.sfx) W.sfx.ui();
        W.removeNode(Number(button.dataset.index));
        render();
        return;
      }
      if (action === "move-node") {
        if (W.sfx) W.sfx.ui();
        W.moveNode(Number(button.dataset.index), Number(button.dataset.dir));
        render();
        return;
      }
      if (action === "fight") {
        startBattle();
        return;
      }
      if (action === "speed") {
        if (W.sfx) W.sfx.ui();
        const speeds = [1, 2, 4, 8, 16];
        const at = speeds.indexOf(ui.speed);
        ui.speed = speeds[(at + 1) % speeds.length];
        button.textContent = `${ui.speed}x`;
        return;
      }
      if (action === "add-cond") {
        if (W.sfx) W.sfx.ui();
        W.updateNode(Number(button.dataset.index), { addCond: true });
        render();
        return;
      }
      if (action === "remove-cond") {
        if (W.sfx) W.sfx.ui();
        W.updateNode(Number(button.dataset.index), {
          removeCondIndex: Number(button.dataset.condIndex),
        });
        render();
        return;
      }
      if (action === "skip") {
        if (!ui.battle) return;
        if (W.sfx) W.sfx.ui();
        stopPlayback();
        ui.battle.index = ui.battle.events.length;
        ui.battle.phase = "done";
        if (W.sfx) {
          if (ui.battle.winner === "player") W.sfx.win();
          else W.sfx.lose();
        }
        render();
        return;
      }
      if (action === "next-floor") {
        if (W.sfx) W.sfx.ui();
        ui.battle = null;
        ui.screen = "offer";
        W.ensureOffer();
        render();
        return;
      }
      if (action === "to-clear") {
        if (W.sfx) W.sfx.ui();
        ui.battle = null;
        ui.screen = "clear";
        render();
        return;
      }
      if (action === "rebuild") {
        if (W.sfx) W.sfx.ui();
        ui.battle = null;
        ui.screen = "prep";
        render();
        return;
      }
      if (action === "give-up") {
        if (W.sfx) W.sfx.ui();
        ui.modal = "giveup";
        ui.help = false;
        ui.patchNotes = false;
        render();
        return;
      }
      if (action === "confirm-give-up") {
        if (W.sfx) W.sfx.ui();
        W.giveUp();
        closeOverlays();
        ui.battle = null;
        ui.screen = "offer";
        render();
        return;
      }
      if (action === "climb-again") {
        if (W.sfx) W.sfx.ui();
        beginRun();
      }
      return;
    }

    const card = event.target.closest("[data-card-id].is-interactive");
    if (card && !event.target.closest("[data-action]")) {
      if (ui.suppressCardClick) {
        ui.suppressCardClick = false;
        return;
      }
      toggleCardZoom(card.dataset.cardKind, card.dataset.cardId);
    }
  }

  function clearDropHighlights() {
    document.querySelectorAll(".flow-drop.is-over").forEach((el) => el.classList.remove("is-over"));
    document.querySelectorAll(".is-dragging").forEach((el) => el.classList.remove("is-dragging"));
  }

  function onDragStart(event) {
    const source = event.target.closest("[data-drag-skill]");
    if (!source || !event.dataTransfer) return;
    const id = source.getAttribute("data-drag-skill");
    if (!id) return;
    ui.dragSkill = id;
    ui.suppressCardClick = false;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.setData("application/x-wot-skill", id);
    source.classList.add("is-dragging");
    document.querySelector("[data-flow-list]")?.classList.add("is-drop-target");
  }

  function onDragEnd() {
    ui.dragSkill = null;
    clearDropHighlights();
    document.querySelector("[data-flow-list]")?.classList.remove("is-drop-target");
    // ドラッグ後の click で拡大が開かないようにする
    ui.suppressCardClick = true;
    setTimeout(() => {
      ui.suppressCardClick = false;
    }, 0);
  }

  function onDragOver(event) {
    const zone = event.target.closest("[data-drop-index]");
    if (!zone) return;
    if (!ui.dragSkill && !(event.dataTransfer && event.dataTransfer.types)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    document.querySelectorAll(".flow-drop.is-over").forEach((el) => {
      if (el !== zone) el.classList.remove("is-over");
    });
    zone.classList.add("is-over");
  }

  function onDragLeave(event) {
    const zone = event.target.closest("[data-drop-index]");
    if (!zone) return;
    if (zone.contains(event.relatedTarget)) return;
    zone.classList.remove("is-over");
  }

  function onDrop(event) {
    const zone = event.target.closest("[data-drop-index]");
    if (!zone) return;
    event.preventDefault();
    const id =
      (event.dataTransfer &&
        (event.dataTransfer.getData("application/x-wot-skill") ||
          event.dataTransfer.getData("text/plain"))) ||
      ui.dragSkill;
    const index = Number(zone.getAttribute("data-drop-index"));
    clearDropHighlights();
    document.querySelector("[data-flow-list]")?.classList.remove("is-drop-target");
    ui.dragSkill = null;
    if (!id || !Number.isFinite(index)) return;
    if (W.insertNode(id, index)) {
      if (W.sfx) W.sfx.ui();
      render();
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
      W.updateNode(Number(el.dataset.index), {
        condType: el.value,
        condIndex: Number(el.dataset.condIndex || 0),
      });
      render();
      return;
    }
    if (el.dataset.bind === "node-join") {
      W.updateNode(Number(el.dataset.index), { join: el.value });
      render();
      return;
    }
    if (el.dataset.bind === "node-value") {
      const index = Number(el.dataset.index);
      const condIndex = Number(el.dataset.condIndex || 0);
      W.updateNode(index, { value: Number(el.value), condIndex });
      const node = W.getState().flow[index];
      const conds = node && (node.conds || [node.cond]);
      const cond = conds && conds[condIndex];
      if (cond && cond.value != null) el.value = String(cond.value);
      return;
    }
  }

  function onKey(event) {
    if (event.key !== "Escape") return;
    if (ui.expandedCard) {
      closeCardZoom(true);
      return;
    }
    if (!ui.modal && !ui.help && !ui.patchNotes && !ui.offerStats) return;
    closeOverlays();
    if (W.sfx) W.sfx.ui();
    render();
  }

  function onBackdrop(event) {
    if (event.target.classList && event.target.classList.contains("modal")) {
      closeOverlays();
      if (W.sfx) W.sfx.ui();
      render();
    }
  }

  function onPointerOver(event) {
    const card = event.target.closest(".skill-card.is-interactive");
    if (card && W.sfx) W.sfx.hover();
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
      app.addEventListener("pointerover", onPointerOver);
      app.addEventListener("dragstart", onDragStart);
      app.addEventListener("dragend", onDragEnd);
      app.addEventListener("dragover", onDragOver);
      app.addEventListener("dragleave", onDragLeave);
      app.addEventListener("drop", onDrop);
      document.addEventListener("keydown", onKey);
      window.addEventListener("popstate", onPopState);
      armHistoryTrap();
      // bfcache 復帰時もトラップを張り直す
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) armHistoryTrap();
      });
    },
    render,
  };
  W.uiState = ui;
})(typeof window !== "undefined" ? window : globalThis);
