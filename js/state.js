(function (root) {
  const W = root.Wot || (root.Wot = {});
  const KEY = "wot-save-v2";
  const MAX_FLOW = 10;

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

  function sanitizeFlow(skills, rawFlow) {
    const seen = {};
    const flow = [];
    (Array.isArray(rawFlow) ? rawFlow : []).forEach((node) => {
      if (!node || seen[node.skillId] || !skills[node.skillId]) return;
      const meta = W.CONDITION_BY_TYPE[node.cond && node.cond.type] || W.CONDITION_BY_TYPE.always;
      const cond = { type: meta.type };
      if (meta.value) {
        let value = Number(node.cond && node.cond.value);
        if (!Number.isFinite(value)) value = meta.def;
        const steps = Math.round((value - meta.min) / meta.step);
        value = meta.min + steps * meta.step;
        cond.value = Math.min(meta.max, Math.max(meta.min, value));
      }
      seen[node.skillId] = true;
      flow.push({ skillId: node.skillId, cond });
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
    state.offer = W.rollOffer(offerSeed(), W.OFFER_COUNT);
    save();
    return state.offer;
  }

  function rerollOffer() {
    if (!state.pendingPick || state.clearedTower) return false;
    const free = isOpeningPick();
    if (!free && (state.rerollPoints || 0) < 1) return false;
    if (!free) state.rerollPoints -= 1;
    state.rerollSalt = (state.rerollSalt || 0) + 1;
    state.offer = W.rollOffer(offerSeed(), W.OFFER_COUNT);
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
    if (!state.pendingPick || !state.offer || !state.offer.includes(id)) return false;
    if (!W.SKILL_BY_ID[id]) return false;
    state.skills[id] = (state.skills[id] || 0) + 1;
    state.offer = null;
    state.pendingPick = false;
    if (
      state.flow.length < MAX_FLOW &&
      !state.flow.some((node) => node.skillId === id)
    ) {
      state.flow.push({ skillId: id, cond: { type: "always" } });
    }
    save();
    return true;
  }

  function addNode(skillId) {
    return insertNode(skillId, state.flow.length);
  }

  function insertNode(skillId, index) {
    if (!(state.skills[skillId] > 0)) return false;
    if (state.flow.length >= MAX_FLOW) return false;
    if (state.flow.some((node) => node.skillId === skillId)) return false;
    const at = Math.max(0, Math.min(state.flow.length, Number(index)));
    if (!Number.isFinite(at)) return false;
    state.flow.splice(at, 0, { skillId, cond: { type: "always" } });
    save();
    return true;
  }

  function updateNode(index, patch) {
    const node = state.flow[index];
    if (!node) return false;
    if (patch.skillId) {
      if (!(state.skills[patch.skillId] > 0)) return false;
      if (state.flow.some((item, i) => i !== index && item.skillId === patch.skillId)) return false;
      node.skillId = patch.skillId;
    }
    if (patch.condType) {
      const meta = W.CONDITION_BY_TYPE[patch.condType] || W.CONDITION_BY_TYPE.always;
      node.cond = { type: meta.type };
      if (meta.value) node.cond.value = meta.def;
    }
    if (patch.value != null && node.cond) {
      const meta = W.CONDITION_BY_TYPE[node.cond.type];
      if (meta && meta.value) {
        let value = Number(patch.value);
        if (!Number.isFinite(value)) value = meta.def;
        const steps = Math.round((value - meta.min) / meta.step);
        value = meta.min + steps * meta.step;
        node.cond.value = Math.min(meta.max, Math.max(meta.min, value));
      }
    }
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
