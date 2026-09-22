(function (root) {
  const W = root.Wot || (root.Wot = {});
  const KEY = "wot-save-v1";
  const MAX_FLOW = 8;

  function blank(best) {
    return {
      v: 1,
      floor: 1,
      points: 3,
      bestCleared: best || 0,
      clearedTower: false,
      skills: {},
      flow: [],
    };
  }

  let state = blank(0);

  function rewardFor(floor) {
    return 3 + Math.floor((Math.max(1, floor) - 1) / 5);
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      /* プライベートモードなどでは保存できない。進行はその場限りになる。 */
    }
  }

  function sanitize(data) {
    const skills = {};
    const rawSkills = data.skills && typeof data.skills === "object" ? data.skills : {};
    Object.keys(rawSkills).forEach((id) => {
      const level = Math.floor(Number(rawSkills[id]));
      if (W.SKILL_BY_ID[id] && level > 0) skills[id] = level;
    });

    const seen = {};
    const flow = [];
    const rawFlow = Array.isArray(data.flow) ? data.flow : [];
    rawFlow.forEach((node) => {
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

    let floor = Math.floor(Number(data.floor) || 1);
    floor = Math.min(100, Math.max(1, floor));
    const clearedTower = !!data.clearedTower;
    if (clearedTower) floor = 100;

    return {
      v: 1,
      floor,
      points: Math.max(0, Math.floor(Number(data.points) || 0)),
      bestCleared: Math.max(0, Math.min(100, Math.floor(Number(data.bestCleared) || 0))),
      clearedTower,
      skills,
      flow: flow.slice(0, MAX_FLOW),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1) return false;
      state = sanitize(data);
      return true;
    } catch (err) {
      return false;
    }
  }

  function hasSave() {
    try {
      return !!localStorage.getItem(KEY);
    } catch (err) {
      return false;
    }
  }

  function newRun(options) {
    const opts = options || {};
    const best = opts.keepBest === false ? 0 : state.bestCleared || 0;
    state = blank(best);
    if (opts.persist !== false) save();
    return state;
  }

  function planBuy(id, cap) {
    if (!W.SKILL_BY_ID[id]) return 0;
    let points = state.points;
    let level = state.skills[id] || 0;
    let count = 0;
    const limit = Math.max(1, cap || 1);
    while (count < limit) {
      const cost = W.skillCost(level);
      if (points < cost) break;
      points -= cost;
      level += 1;
      count += 1;
    }
    return count;
  }

  function buy(id, times) {
    const count = planBuy(id, times || 1);
    if (!count) return 0;
    let level = state.skills[id] || 0;
    for (let i = 0; i < count; i += 1) {
      state.points -= W.skillCost(level);
      level += 1;
    }
    state.skills[id] = level;
    save();
    return count;
  }

  function addNode(skillId) {
    if (!(state.skills[skillId] > 0)) return false;
    if (state.flow.length >= MAX_FLOW) return false;
    if (state.flow.some((node) => node.skillId === skillId)) return false;
    state.flow.push({ skillId, cond: { type: "always" } });
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
    const reward = rewardFor(floor);
    state.points += reward;
    state.bestCleared = Math.max(state.bestCleared || 0, floor);
    const cleared = floor >= 100;
    state.clearedTower = cleared;
    if (!cleared) state.floor += 1;
    save();
    return { reward, cleared, floor };
  }

  W.MAX_FLOW = MAX_FLOW;
  W.rewardFor = rewardFor;
  W.getState = function getState() {
    return state;
  };
  W.load = load;
  W.hasSave = hasSave;
  W.newRun = newRun;
  W.planBuy = planBuy;
  W.buy = buy;
  W.addNode = addNode;
  W.updateNode = updateNode;
  W.moveNode = moveNode;
  W.removeNode = removeNode;
  W.commitWin = commitWin;
  W.giveUp = function giveUp() {
    return newRun({ persist: true });
  };
})(typeof window !== "undefined" ? window : globalThis);
