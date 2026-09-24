(function (root) {
  const W = root.Wot || (root.Wot = {});
  const KEY = "wot-save-v3";
  const LEGACY_KEYS = ["wot-save-v2", "wot-save-v1"];
  const MAX_FLOW = 10;
  const MAX_CONDS = 3;
  const MAX_CLEAR_HISTORY = 8;
  const MAX_PICK_LOG = 80;
  const SAVE_VERSION = 3;

  function towerHeight() {
    return W.TOWER_HEIGHT || 30;
  }

  function blankRunStats() {
    return {
      startedAt: Date.now(),
      clearedAt: null,
      battlesWon: 0,
      battlesLost: 0,
      rerollsUsed: 0,
      damageDealt: 0,
      damageTaken: 0,
      playerActions: 0,
      enemyActions: 0,
      picks: [],
      openingSkillId: null,
      scaleTierAtStart: 0,
    };
  }

  function blankChronicle() {
    return {
      clearCount: 0,
      bestScaleTier: 0,
      clears: [],
    };
  }

  function blank(best, chronicle, scaleTier) {
    const run = blankRunStats();
    run.scaleTierAtStart = Math.max(0, Math.floor(Number(scaleTier) || 0));
    return {
      v: SAVE_VERSION,
      floor: 1,
      bestCleared: best || 0,
      clearedTower: false,
      scaleTier: Math.max(0, Math.floor(Number(scaleTier) || 0)),
      runSeed: (Math.random() * 0xffffffff) >>> 0 || 1,
      skills: {},
      flow: [],
      offer: null,
      pendingPick: true,
      rerollPoints: 0,
      rerollSalt: 0,
      runStats: run,
      chronicle: sanitizeChronicle(chronicle),
      needsSpecNotice: false,
    };
  }

  function sanitizeRunStats(raw) {
    const base = blankRunStats();
    if (!raw || typeof raw !== "object") return base;
    base.startedAt = Math.max(0, Math.floor(Number(raw.startedAt) || base.startedAt));
    base.clearedAt = raw.clearedAt == null ? null : Math.max(0, Math.floor(Number(raw.clearedAt) || 0));
    base.battlesWon = Math.max(0, Math.floor(Number(raw.battlesWon) || 0));
    base.battlesLost = Math.max(0, Math.floor(Number(raw.battlesLost) || 0));
    base.rerollsUsed = Math.max(0, Math.floor(Number(raw.rerollsUsed) || 0));
    base.damageDealt = Math.max(0, Math.floor(Number(raw.damageDealt) || 0));
    base.damageTaken = Math.max(0, Math.floor(Number(raw.damageTaken) || 0));
    base.playerActions = Math.max(0, Math.floor(Number(raw.playerActions) || 0));
    base.enemyActions = Math.max(0, Math.floor(Number(raw.enemyActions) || 0));
    base.scaleTierAtStart = Math.max(0, Math.floor(Number(raw.scaleTierAtStart) || 0));
    if (raw.openingSkillId && W.SKILL_BY_ID[raw.openingSkillId]) {
      base.openingSkillId = raw.openingSkillId;
    }
    const picks = Array.isArray(raw.picks) ? raw.picks : [];
    const height = towerHeight();
    base.picks = picks
      .filter((p) => p && W.SKILL_BY_ID[p.id])
      .slice(0, MAX_PICK_LOG)
      .map((p) => ({
        id: p.id,
        floor: Math.max(1, Math.min(height, Math.floor(Number(p.floor) || 1))),
        level: Math.max(1, Math.floor(Number(p.level) || 1)),
        at: Math.max(0, Math.floor(Number(p.at) || 0)),
      }));
    return base;
  }

  function sanitizeClearEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const groups = {};
    (W.SKILL_GROUPS || []).forEach((g) => {
      groups[g] = Math.max(0, Math.floor(Number(raw.groups && raw.groups[g]) || 0));
    });
    return {
      at: Math.max(0, Math.floor(Number(raw.at) || 0)),
      seed: (Number(raw.seed) >>> 0) || 0,
      durationMs: Math.max(0, Math.floor(Number(raw.durationMs) || 0)),
      skillKinds: Math.max(0, Math.floor(Number(raw.skillKinds) || 0)),
      passiveKinds: Math.max(0, Math.floor(Number(raw.passiveKinds) || 0)),
      battlesWon: Math.max(0, Math.floor(Number(raw.battlesWon) || 0)),
      battlesLost: Math.max(0, Math.floor(Number(raw.battlesLost) || 0)),
      rerollsUsed: Math.max(0, Math.floor(Number(raw.rerollsUsed) || 0)),
      damageDealt: Math.max(0, Math.floor(Number(raw.damageDealt) || 0)),
      damageTaken: Math.max(0, Math.floor(Number(raw.damageTaken) || 0)),
      openingSkillId: raw.openingSkillId && W.SKILL_BY_ID[raw.openingSkillId] ? raw.openingSkillId : null,
      topGroup: raw.topGroup && (W.SKILL_GROUPS || []).includes(raw.topGroup) ? raw.topGroup : null,
      scaleTier: Math.max(0, Math.floor(Number(raw.scaleTier) || 0)),
      groups,
    };
  }

  function sanitizeChronicle(raw) {
    const base = blankChronicle();
    if (!raw || typeof raw !== "object") return base;
    base.clearCount = Math.max(0, Math.floor(Number(raw.clearCount) || 0));
    base.bestScaleTier = Math.max(0, Math.floor(Number(raw.bestScaleTier) || 0));
    const clears = Array.isArray(raw.clears) ? raw.clears : [];
    base.clears = clears
      .slice(0, MAX_CLEAR_HISTORY)
      .map((entry) => sanitizeClearEntry(entry))
      .filter(Boolean);
    return base;
  }

  let state = blank(0);

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      /* ignore */
    }
  }

  function sanitizeCond(raw) {
    const meta = W.CONDITION_BY_TYPE[raw && raw.type] || W.CONDITION_BY_TYPE.always;
    const cond = { type: meta.type };
    if (meta.value) {
      let value = Number(raw && raw.value);
      if (!Number.isFinite(value)) value = meta.def;
      const steps = Math.round((value - meta.min) / meta.step);
      value = meta.min + steps * meta.step;
      cond.value = Math.min(meta.max, Math.max(meta.min, value));
    }
    return cond;
  }

  function sanitizeFlow(skills, rawFlow) {
    const seen = {};
    const flow = [];
    (Array.isArray(rawFlow) ? rawFlow : []).forEach((node) => {
      if (!node || seen[node.skillId] || !skills[node.skillId]) return;
      const meta = W.SKILL_BY_ID[node.skillId];
      if (meta && meta.passive) return;
      let rawConds = Array.isArray(node.conds) ? node.conds : null;
      if (!rawConds || !rawConds.length) {
        rawConds = [node.cond || { type: "always" }];
      }
      const conds = rawConds.map(sanitizeCond).slice(0, MAX_CONDS);
      if (!conds.length) conds.push({ type: "always" });
      const join = node.join === "or" ? "or" : "and";
      seen[node.skillId] = true;
      flow.push({ skillId: node.skillId, join, conds, cond: conds[0] });
    });
    return flow.slice(0, MAX_FLOW);
  }

  function isLegacySave(data) {
    if (!data || typeof data !== "object") return false;
    if (data.v === 1) return true;
    if (data.v === 2) return true;
    if (data.v !== SAVE_VERSION) return true;
    const height = towerHeight();
    if (Number(data.floor) > height) return true;
    if (Number(data.bestCleared) > height) return true;
    if (data.scaleTier == null && (data.clearedTower || Number(data.bestCleared) >= 50)) return true;
    return false;
  }

  function sanitize(data, opts) {
    const height = towerHeight();
    const skills = {};
    const rawSkills = data.skills && typeof data.skills === "object" ? data.skills : {};
    Object.keys(rawSkills).forEach((id) => {
      const level = Math.floor(Number(rawSkills[id]));
      if (W.SKILL_BY_ID[id] && level > 0) skills[id] = level;
    });

    const legacy = !!(opts && opts.legacy) || isLegacySave(data);
    let floor = Math.floor(Number(data.floor) || 1);
    floor = Math.min(height, Math.max(1, floor));
    let clearedTower = !!data.clearedTower;
    // 旧100層クリアなどは新仕様では未クリア扱い（周知後に初めから）
    if (legacy) {
      clearedTower = false;
      floor = Math.min(floor, height);
    }
    if (clearedTower) floor = height;

    const pendingPick = data.pendingPick !== false && !clearedTower;
    let offer = Array.isArray(data.offer)
      ? data.offer.filter((id) => W.SKILL_BY_ID[id]).slice(0, W.OFFER_COUNT)
      : null;
    if (pendingPick && (!offer || offer.length < W.OFFER_COUNT)) {
      offer = null;
    }

    let bestCleared = Math.max(0, Math.floor(Number(data.bestCleared) || 0));
    if (legacy && bestCleared > height) bestCleared = height;

    return {
      v: SAVE_VERSION,
      floor,
      bestCleared: Math.min(height, bestCleared),
      clearedTower,
      scaleTier: Math.max(0, Math.floor(Number(data.scaleTier) || 0)),
      runSeed: (Number(data.runSeed) >>> 0) || 1,
      skills: legacy ? {} : skills,
      flow: legacy ? [] : sanitizeFlow(skills, data.flow),
      offer: legacy ? null : offer,
      pendingPick: legacy ? true : pendingPick,
      rerollPoints: legacy ? 0 : Math.max(0, Math.floor(Number(data.rerollPoints) || 0)),
      rerollSalt: legacy ? 0 : Math.max(0, Math.floor(Number(data.rerollSalt) || 0)),
      runStats: legacy ? blankRunStats() : sanitizeRunStats(data.runStats),
      chronicle: sanitizeChronicle(data.chronicle),
      needsSpecNotice: legacy || !!data.needsSpecNotice,
    };
  }

  function offerSeed() {
    return (
      (state.runSeed ^
        (state.floor * 2654435761) ^
        ((state.rerollSalt || 0) * 1597334677) ^
        ((state.scaleTier || 0) * 2246822519)) >>>
      0
    );
  }

  function ownedSkillCount(data) {
    const skills = (data || state).skills || {};
    return Object.keys(skills).filter((id) => (skills[id] || 0) > 0).length;
  }

  function isOpeningPick(data) {
    return ownedSkillCount(data || state) === 0;
  }

  function ensureOffer() {
    if (!state.pendingPick || state.clearedTower) return state.offer;
    if (state.offer && state.offer.length === W.OFFER_COUNT) return state.offer;
    state.offer = W.rollOffer(offerSeed(), W.OFFER_COUNT, state.skills);
    save();
    return state.offer;
  }

  function ensureRunStats() {
    if (!state.runStats) state.runStats = blankRunStats();
    return state.runStats;
  }

  function ensureChronicle() {
    if (!state.chronicle) state.chronicle = blankChronicle();
    return state.chronicle;
  }

  function rerollOffer() {
    if (!state.pendingPick || state.clearedTower) return false;
    const free = isOpeningPick();
    if (!free && (state.rerollPoints || 0) < 1) return false;
    if (!free) {
      state.rerollPoints -= 1;
      ensureRunStats().rerollsUsed += 1;
    }
    state.rerollSalt = (state.rerollSalt || 0) + 1;
    state.offer = W.rollOffer(offerSeed(), W.OFFER_COUNT, state.skills);
    save();
    return true;
  }

  function readRawSave() {
    try {
      const raw = localStorage.getItem(KEY) || LEGACY_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function load() {
    try {
      const data = readRawSave();
      if (!data) return false;
      if (!data.v || (data.v !== 1 && data.v !== 2 && data.v !== SAVE_VERSION)) return false;
      const legacy = isLegacySave(data);
      state = sanitize(data, { legacy });
      if (state.pendingPick) ensureOffer();
      save();
      // 旧キー掃除（移行後）
      try {
        LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
      } catch (err) {
        /* ignore */
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  function hasSave() {
    try {
      return !!(localStorage.getItem(KEY) || LEGACY_KEYS.some((k) => localStorage.getItem(k)));
    } catch (err) {
      return false;
    }
  }

  function newRun(options) {
    const opts = options || {};
    const best = opts.keepBest === false ? 0 : state.bestCleared || 0;
    const chronicle = opts.keepBest === false ? blankChronicle() : state.chronicle;
    const scale =
      opts.scaleTier != null
        ? Math.max(0, Math.floor(Number(opts.scaleTier) || 0))
        : opts.keepScale === false
          ? 0
          : state.scaleTier || 0;
    state = blank(best, chronicle, scale);
    if (opts.persist !== false) {
      ensureOffer();
      save();
    }
    return state;
  }

  function ackSpecNotice() {
    state.needsSpecNotice = false;
    // 周知後は新仕様の開幕から
    const chronicle = state.chronicle;
    const best = Math.min(towerHeight(), state.bestCleared || 0);
    state = blank(best, chronicle, 0);
    state.needsSpecNotice = false;
    ensureOffer();
    save();
    return state;
  }

  function groupCountsFromSkills(skills) {
    const groups = {};
    (W.SKILL_GROUPS || []).forEach((g) => {
      groups[g] = 0;
    });
    let passiveKinds = 0;
    let activeKinds = 0;
    Object.keys(skills || {}).forEach((id) => {
      const lv = skills[id] || 0;
      if (lv <= 0) return;
      const skill = W.SKILL_BY_ID[id];
      if (!skill) return;
      if (skill.passive) {
        passiveKinds += 1;
        return;
      }
      activeKinds += 1;
      if (Object.prototype.hasOwnProperty.call(groups, skill.group)) {
        groups[skill.group] += lv;
      }
    });
    let topGroup = null;
    let topVal = 0;
    Object.keys(groups).forEach((g) => {
      if (groups[g] > topVal) {
        topVal = groups[g];
        topGroup = g;
      }
    });
    return { groups, passiveKinds, activeKinds, topGroup };
  }

  function buildClearEntry(data) {
    const st = data || state;
    const run = st.runStats || blankRunStats();
    const counts = groupCountsFromSkills(st.skills);
    const started = run.startedAt || 0;
    const ended = run.clearedAt || Date.now();
    return {
      at: ended,
      seed: st.runSeed || 0,
      durationMs: started > 0 ? Math.max(0, ended - started) : 0,
      skillKinds: Object.keys(st.skills || {}).filter((id) => (st.skills[id] || 0) > 0).length,
      passiveKinds: counts.passiveKinds,
      battlesWon: run.battlesWon || 0,
      battlesLost: run.battlesLost || 0,
      rerollsUsed: run.rerollsUsed || 0,
      damageDealt: run.damageDealt || 0,
      damageTaken: run.damageTaken || 0,
      openingSkillId: run.openingSkillId || null,
      topGroup: counts.topGroup,
      scaleTier: st.scaleTier || 0,
      groups: counts.groups,
    };
  }

  function pickSkill(id) {
    if (!state.pendingPick || state.clearedTower) return false;
    if (!W.SKILL_BY_ID[id]) return false;
    if (!isOpeningPick() && (!state.offer || !state.offer.includes(id))) return false;
    const skill = W.SKILL_BY_ID[id];
    const wasOpening = isOpeningPick();
    state.skills[id] = (state.skills[id] || 0) + 1;
    const run = ensureRunStats();
    if (wasOpening) run.openingSkillId = id;
    run.picks.push({
      id,
      floor: state.floor,
      level: state.skills[id],
      at: Date.now(),
    });
    if (run.picks.length > MAX_PICK_LOG) run.picks = run.picks.slice(-MAX_PICK_LOG);
    state.offer = null;
    state.pendingPick = false;
    if (
      !skill.passive &&
      state.flow.length < MAX_FLOW &&
      !state.flow.some((node) => node.skillId === id)
    ) {
      state.flow.push({
        skillId: id,
        join: "and",
        conds: [{ type: "always" }],
        cond: { type: "always" },
      });
    }
    save();
    return true;
  }

  function addNode(skillId) {
    return insertNode(skillId, state.flow.length);
  }

  function insertNode(skillId, index) {
    if (!(state.skills[skillId] > 0)) return false;
    const skill = W.SKILL_BY_ID[skillId];
    if (!skill || skill.passive) return false;
    if (state.flow.length >= MAX_FLOW) return false;
    if (state.flow.some((node) => node.skillId === skillId)) return false;
    const at = Math.max(0, Math.min(state.flow.length, Number(index)));
    if (!Number.isFinite(at)) return false;
    state.flow.splice(at, 0, {
      skillId,
      join: "and",
      conds: [{ type: "always" }],
      cond: { type: "always" },
    });
    save();
    return true;
  }

  function syncNodeCondMirror(node) {
    if (!node.conds || !node.conds.length) {
      node.conds = [{ type: "always" }];
    }
    if (node.join !== "or") node.join = "and";
    node.cond = node.conds[0];
  }

  function updateNode(index, patch) {
    const node = state.flow[index];
    if (!node) return false;
    if (!Array.isArray(node.conds) || !node.conds.length) {
      node.conds = [node.cond || { type: "always" }];
    }
    if (patch.skillId) {
      if (!(state.skills[patch.skillId] > 0)) return false;
      const nextSkill = W.SKILL_BY_ID[patch.skillId];
      if (!nextSkill || nextSkill.passive) return false;
      if (state.flow.some((item, i) => i !== index && item.skillId === patch.skillId)) return false;
      node.skillId = patch.skillId;
    }
    if (patch.join === "and" || patch.join === "or") {
      node.join = patch.join;
    }
    if (patch.addCond) {
      if (node.conds.length >= MAX_CONDS) return false;
      node.conds.push({ type: "always" });
    }
    if (patch.removeCondIndex != null) {
      const ri = Number(patch.removeCondIndex);
      if (!Number.isFinite(ri) || ri < 0 || ri >= node.conds.length) return false;
      if (node.conds.length <= 1) return false;
      node.conds.splice(ri, 1);
    }
    const condIndex =
      patch.condIndex != null && Number.isFinite(Number(patch.condIndex))
        ? Math.max(0, Math.min(node.conds.length - 1, Number(patch.condIndex)))
        : 0;
    if (patch.condType) {
      const meta = W.CONDITION_BY_TYPE[patch.condType] || W.CONDITION_BY_TYPE.always;
      const next = { type: meta.type };
      if (meta.value) next.value = meta.def;
      node.conds[condIndex] = next;
    }
    if (patch.value != null) {
      const target = node.conds[condIndex];
      const meta = W.CONDITION_BY_TYPE[target && target.type];
      if (meta && meta.value) {
        let value = Number(patch.value);
        if (!Number.isFinite(value)) value = meta.def;
        const steps = Math.round((value - meta.min) / meta.step);
        value = meta.min + steps * meta.step;
        target.value = Math.min(meta.max, Math.max(meta.min, value));
      }
    }
    syncNodeCondMirror(node);
    save();
    return true;
  }

  function moveNode(index, dir) {
    const next = index + dir;
    if (!state.flow[index] || next < 0 || next >= state.flow.length) return;
    const [item] = state.flow.splice(index, 1);
    state.flow.splice(next, 0, item);
    save();
  }

  function removeNode(index) {
    if (!state.flow[index]) return;
    state.flow.splice(index, 1);
    save();
  }

  function recordBattle(result) {
    if (!result) return;
    const run = ensureRunStats();
    if (result.winner === "player") run.battlesWon += 1;
    else run.battlesLost += 1;
    run.damageDealt += Math.max(0, Math.floor(Number(result.damageDealt) || 0));
    run.damageTaken += Math.max(0, Math.floor(Number(result.damageTaken) || 0));
    run.playerActions += Math.max(0, Math.floor(Number(result.playerActions) || 0));
    run.enemyActions += Math.max(0, Math.floor(Number(result.enemyActions) || 0));
    save();
  }

  function commitWin() {
    const height = towerHeight();
    const floor = state.floor;
    state.bestCleared = Math.max(state.bestCleared || 0, floor);
    state.rerollPoints = (state.rerollPoints || 0) + 1;
    const cleared = floor >= height;
    state.clearedTower = cleared;
    if (!cleared) {
      state.floor += 1;
      state.pendingPick = true;
      state.offer = null;
      ensureOffer();
    } else {
      state.pendingPick = false;
      state.offer = null;
      const run = ensureRunStats();
      run.clearedAt = Date.now();
      const chronicle = ensureChronicle();
      chronicle.clearCount = (chronicle.clearCount || 0) + 1;
      chronicle.bestScaleTier = Math.max(chronicle.bestScaleTier || 0, state.scaleTier || 0);
      const entry = buildClearEntry(state);
      chronicle.clears = [entry, ...(chronicle.clears || [])].slice(0, MAX_CLEAR_HISTORY);
    }
    save();
    return { cleared, floor, rerollPoints: state.rerollPoints, scaleTier: state.scaleTier || 0 };
  }

  /** クリア後: ビルドをリセットし、選んだ敵強化段階で次の登塔へ */
  function beginScaledRun(tier) {
    if (!state.clearedTower) return false;
    const nextTier = Math.max(0, Math.floor(Number(tier) || 0));
    const chronicle = state.chronicle;
    const best = Math.max(state.bestCleared || 0, towerHeight());
    state = blank(best, chronicle, nextTier);
    ensureOffer();
    save();
    return true;
  }

  /** クリア後: 強化段階を+1して次の登塔へ（互換用） */
  function beginNextScale() {
    return beginScaledRun((state.scaleTier || 0) + 1);
  }

  function clearReport(data) {
    const st = data || state;
    const run = st.runStats || blankRunStats();
    const chronicle = st.chronicle || blankChronicle();
    const counts = groupCountsFromSkills(st.skills);
    const stats = W.computeStats(st.skills);
    const height = towerHeight();
    const owned = Object.keys(st.skills || {})
      .filter((id) => (st.skills[id] || 0) > 0)
      .map((id) => {
        const skill = W.SKILL_BY_ID[id];
        return {
          id,
          name: skill ? skill.name : id,
          group: skill ? skill.group : "",
          passive: !!(skill && skill.passive),
          level: st.skills[id],
        };
      })
      .sort((a, b) => {
        if (a.passive !== b.passive) return a.passive ? 1 : -1;
        if (a.group !== b.group) return String(a.group).localeCompare(String(b.group), "ja");
        return a.name.localeCompare(b.name, "ja");
      });
    const flow = (st.flow || []).map((node, index) => {
      const skill = W.SKILL_BY_ID[node.skillId];
      return {
        index: index + 1,
        id: node.skillId,
        name: skill ? skill.name : node.skillId,
        group: skill ? skill.group : "",
      };
    });
    const mileFloors = [1, 10, 20, height].filter((v, i, arr) => arr.indexOf(v) === i);
    const milestones = mileFloors
      .map((floor) => {
        const pick = (run.picks || []).find((p) => p.floor === floor);
        if (!pick) return null;
        const skill = W.SKILL_BY_ID[pick.id];
        return {
          floor,
          id: pick.id,
          name: skill ? skill.name : pick.id,
          level: pick.level,
        };
      })
      .filter(Boolean);
    return {
      run,
      chronicle,
      counts,
      stats,
      owned,
      flow,
      milestones,
      entry: buildClearEntry(st),
      scaleTier: st.scaleTier || 0,
      scalePct: Math.round((st.scaleTier || 0) * (W.SCALE_STEP || 0.5) * 100),
      nextScalePct: Math.round(((st.scaleTier || 0) + 1) * (W.SCALE_STEP || 0.5) * 100),
      towerHeight: height,
    };
  }

  function scaleLabel(tier) {
    const t = Math.max(0, Math.floor(Number(tier) || 0));
    const pct = Math.round(t * (W.SCALE_STEP || 0.5) * 100);
    if (pct <= 0) return "通常";
    return `敵強化 +${pct}%`;
  }

  W.MAX_FLOW = MAX_FLOW;
  W.MAX_CONDS = MAX_CONDS;
  W.SAVE_VERSION = SAVE_VERSION;
  W.getState = function getState() {
    return state;
  };
  W.load = load;
  W.hasSave = hasSave;
  W.newRun = newRun;
  W.ensureOffer = ensureOffer;
  W.rerollOffer = rerollOffer;
  W.isOpeningPick = isOpeningPick;
  W.pickSkill = pickSkill;
  W.addNode = addNode;
  W.insertNode = insertNode;
  W.updateNode = updateNode;
  W.moveNode = moveNode;
  W.removeNode = removeNode;
  W.commitWin = commitWin;
  W.recordBattle = recordBattle;
  W.clearReport = clearReport;
  W.beginScaledRun = beginScaledRun;
  W.beginNextScale = beginNextScale;
  W.ackSpecNotice = ackSpecNotice;
  W.scaleLabel = scaleLabel;
  W.groupCountsFromSkills = groupCountsFromSkills;
  W.giveUp = function giveUp() {
    return newRun({ persist: true, keepScale: true });
  };
})(typeof window !== "undefined" ? window : globalThis);
