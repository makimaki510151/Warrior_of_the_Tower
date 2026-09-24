(function (root) {
  const W = root.Wot || (root.Wot = {});
  const KEY = "wot-save-v2";
  const MAX_FLOW = 10;
  const MAX_CONDS = 3;

  function blank(best) {
    return {
      v: 2,
      floor: 1,
      bestCleared: best || 0,
      clearedTower: false,
      runSeed: (Math.random() * 0xffffffff) >>> 0 || 1,
      skills: {},
      flow: [],
      offer: null,
      pendingPick: true,
      rerollPoints: 0,
      rerollSalt: 0,
    };
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

  function sanitize(data) {
    const skills = {};
    const rawSkills = data.skills && typeof data.skills === "object" ? data.skills : {};
    Object.keys(rawSkills).forEach((id) => {
      const level = Math.floor(Number(rawSkills[id]));
      if (W.SKILL_BY_ID[id] && level > 0) skills[id] = level;
    });

    let floor = Math.floor(Number(data.floor) || 1);
    floor = Math.min(100, Math.max(1, floor));
    const clearedTower = !!data.clearedTower;
    if (clearedTower) floor = 100;

    const pendingPick = data.pendingPick !== false && !clearedTower;
    let offer = Array.isArray(data.offer)
      ? data.offer.filter((id) => W.SKILL_BY_ID[id]).slice(0, W.OFFER_COUNT)
      : null;
    if (pendingPick && (!offer || offer.length < W.OFFER_COUNT)) {
      offer = null;
    }

    return {
      v: 2,
      floor,
      bestCleared: Math.max(0, Math.min(100, Math.floor(Number(data.bestCleared) || 0))),
      clearedTower,
      runSeed: (Number(data.runSeed) >>> 0) || 1,
      skills,
      flow: sanitizeFlow(skills, data.flow),
      offer,
      pendingPick,
      rerollPoints: Math.max(0, Math.floor(Number(data.rerollPoints) || 0)),
      rerollSalt: Math.max(0, Math.floor(Number(data.rerollSalt) || 0)),
    };
  }

  function offerSeed() {
    return (state.runSeed ^ (state.floor * 2654435761) ^ ((state.rerollSalt || 0) * 1597334677)) >>> 0;
  }

  function ownedSkillCount(data) {
    const skills = (data || state).skills || {};
    return Object.keys(skills).filter((id) => (skills[id] || 0) > 0).length;
  }

  /** ラン開始直後の最初の技獲得前なら true（このときリロールは消費なし・無制限） */
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

  function rerollOffer() {
    if (!state.pendingPick || state.clearedTower) return false;
    const free = isOpeningPick();
    if (!free && (state.rerollPoints || 0) < 1) return false;
    if (!free) state.rerollPoints -= 1;
    state.rerollSalt = (state.rerollSalt || 0) + 1;
    state.offer = W.rollOffer(offerSeed(), W.OFFER_COUNT, state.skills);
    save();
    return true;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY) || localStorage.getItem("wot-save-v1");
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || (data.v !== 1 && data.v !== 2)) return false;
      state = sanitize(data);
      if (state.pendingPick) ensureOffer();
      save();
      return true;
    } catch (err) {
      return false;
    }
  }

  function hasSave() {
    try {
      return !!(localStorage.getItem(KEY) || localStorage.getItem("wot-save-v1"));
    } catch (err) {
      return false;
    }
  }

  function newRun(options) {
    const opts = options || {};
    const best = opts.keepBest === false ? 0 : state.bestCleared || 0;
    state = blank(best);
    if (opts.persist !== false) {
      ensureOffer();
      save();
    }
    return state;
  }

  function pickSkill(id) {
    if (!state.pendingPick || state.clearedTower) return false;
    if (!W.SKILL_BY_ID[id]) return false;
    // 開幕（無限リロール中）は候補外の技も直接獲得できる
    if (!isOpeningPick() && (!state.offer || !state.offer.includes(id))) return false;
    const skill = W.SKILL_BY_ID[id];
    state.skills[id] = (state.skills[id] || 0) + 1;
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

  function commitWin() {
    const floor = state.floor;
    state.bestCleared = Math.max(state.bestCleared || 0, floor);
    state.rerollPoints = (state.rerollPoints || 0) + 1;
    const cleared = floor >= 100;
    state.clearedTower = cleared;
    if (!cleared) {
      state.floor += 1;
      state.pendingPick = true;
      state.offer = null;
      ensureOffer();
    } else {
      state.pendingPick = false;
      state.offer = null;
    }
    save();
    return { cleared, floor, rerollPoints: state.rerollPoints };
  }

  W.MAX_FLOW = MAX_FLOW;
  W.MAX_CONDS = MAX_CONDS;
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
  W.giveUp = function giveUp() {
    return newRun({ persist: true });
  };
})(typeof window !== "undefined" ? window : globalThis);
