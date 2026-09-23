(function (root) {
  const W = root.Wot || (root.Wot = {});

  const MAX_ACTIONS = 220;

  const CONDITIONS = [
    { type: "always", label: "常に使う", text: () => "常に" },
    {
      type: "selfHpBelow",
      label: "自分の体力が少ない",
      value: true,
      min: 1,
      max: 99,
      step: 1,
      def: 40,
      unit: "%未満",
      text: (v) => `自分の体力が${v}%未満`,
    },
    {
      type: "selfHpAbove",
      label: "自分の体力に余裕がある",
      value: true,
      min: 1,
      max: 99,
      step: 1,
      def: 60,
      unit: "%以上",
      text: (v) => `自分の体力が${v}%以上`,
    },
    {
      type: "enemyHpBelow",
      label: "敵の体力が少ない",
      value: true,
      min: 1,
      max: 99,
      step: 1,
      def: 40,
      unit: "%未満",
      text: (v) => `敵の体力が${v}%未満`,
    },
    {
      type: "enemyHpAbove",
      label: "敵の体力が多い",
      value: true,
      min: 1,
      max: 99,
      step: 1,
      def: 70,
      unit: "%以上",
      text: (v) => `敵の体力が${v}%以上`,
    },
    {
      type: "hpWorseThanEnemy",
      label: "自分の方が体力割合が低い",
      text: () => "自分の体力割合が敵より低い",
    },
    {
      type: "hpBetterThanEnemy",
      label: "自分の方が体力割合が高い",
      text: () => "自分の体力割合が敵以上",
    },
    {
      type: "opening",
      label: "戦いの序盤だけ",
      value: true,
      min: 1,
      max: 5,
      step: 1,
      def: 3,
      unit: "回目まで",
      text: (v) => `自分の行動が${v}回目まで`,
    },
    {
      type: "afterActions",
      label: "ある程度戦ってから",
      value: true,
      min: 2,
      max: 8,
      step: 1,
      def: 4,
      unit: "回目から",
      text: (v) => `自分の行動が${v}回目から`,
    },
    {
      type: "everyN",
      label: "決まった回数ごと",
      value: true,
      min: 2,
      max: 6,
      step: 1,
      def: 3,
      unit: "回ごと",
      text: (v) => `自分の行動が${v}回ごと`,
    },
    { type: "tookHit", label: "直前にダメージを受けた", text: () => "直前にダメージを受けた" },
    { type: "notTookHit", label: "直前は無傷だった", text: () => "直前にダメージを受けていない" },
    { type: "lastWasNormal", label: "直前が通常攻撃だった", text: () => "直前の行動が通常攻撃だった" },
    { type: "lastWasSkill", label: "直前が技だった", text: () => "直前の行動が技だった" },
    {
      type: "enemyDefGEAtk",
      label: "敵の防御が自分の攻撃以上",
      text: () => "敵の防御が自分の攻撃以上",
    },
    { type: "selfFaster", label: "自分が敵より速い", text: () => "自分の行動速度が敵より高い" },
    { type: "enemyFaster", label: "敵が自分より速い", text: () => "敵の行動速度が自分以上" },
    { type: "enemyHasDebuff", label: "敵が弱体している", text: () => "敵が弱体している" },
    { type: "enemyNoDebuff", label: "敵が弱体していない", text: () => "敵が弱体していない" },
    { type: "enemyHasBuff", label: "敵に強化がある", text: () => "敵に強化がある" },
    { type: "selfHasDebuff", label: "自分が弱体している", text: () => "自分が弱体している" },
    { type: "selfHasBuff", label: "自分に強化がある", text: () => "自分に強化がある" },
    { type: "selfNoBuff", label: "自分に強化がない", text: () => "自分に強化がない" },
    { type: "enemyRegen", label: "敵が自動回復する", text: () => "敵が自動回復するタイプ" },
  ];

  const CONDITION_BY_TYPE = {};
  CONDITIONS.forEach((cond) => {
    CONDITION_BY_TYPE[cond.type] = cond;
  });

  function conditionLabel(cond) {
    const meta = CONDITION_BY_TYPE[cond && cond.type] || CONDITION_BY_TYPE.always;
    return meta.text(cond && cond.value);
  }

  function makeCombatant(name, stats) {
    return {
      name,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      atk: stats.atk,
      def: stats.def,
      regenInterval: Math.max(1, stats.regenInterval || 4),
      regenAmount: stats.regenAmount || 0,
      healEff: stats.healEff == null ? 1 : stats.healEff,
      atkEff: stats.atkEff == null ? 1 : stats.atkEff,
      defEff: stats.defEff == null ? 1 : stats.defEff,
      speed: Math.max(40, stats.speed || 100),
      dmgBonus: stats.dmgBonus || 0,
      dmgReduction: stats.dmgReduction || 0,
      effects: [],
      cd: {},
      cdFresh: {},
      actionCount: 0,
      regenCounter: 0,
      tookHit: false,
      lastAction: null,
      pattern: stats.pattern,
      boss: !!stats.boss,
    };
  }

  function hasDebuff(unit) {
    return unit.effects.some((effect) => effect.negative);
  }

  function hasBuff(unit) {
    return unit.effects.some((effect) => !effect.negative && effect.kind !== "dot");
  }

  function pctSum(unit, kind) {
    let total = 0;
    unit.effects.forEach((effect) => {
      if (effect.kind === kind) total += effect.value;
    });
    return total;
  }

  function effectiveAtk(unit) {
    return Math.max(1, unit.atk * (1 + pctSum(unit, "atkPct")));
  }

  function effectiveDef(unit) {
    return Math.max(0, unit.def * (1 + pctSum(unit, "defPct")));
  }

  function rawDamage(attacker, defender, mult, ignore) {
    const atk = effectiveAtk(attacker);
    const ignoreRate = Math.min(0.7, Math.max(0, ignore || 0));
    const def = effectiveDef(defender) * (1 - ignoreRate);
    const pen = atk * 0.55;
    const reduction = def <= 0 ? 0 : def / (def + 65 + pen);
    let damage = atk * (1 + attacker.dmgBonus) * mult * (1 - reduction);
    let dr = defender.dmgReduction;
    defender.effects.forEach((effect) => {
      if (effect.kind === "dr") dr += effect.value;
    });
    dr = Math.max(-0.5, Math.min(0.75, dr));
    damage *= 1 - dr;
    return Math.max(1, Math.floor(damage));
  }

  function conditionMet(cond, ctx) {
    const type = (cond && cond.type) || "always";
    const value = cond && cond.value;
    const playerRate = ctx.player.hp / ctx.player.maxHp;
    const enemyRate = ctx.enemy.hp / ctx.enemy.maxHp;
    switch (type) {
      case "always":
        return true;
      case "selfHpBelow":
        return playerRate * 100 < value;
      case "selfHpAbove":
        return playerRate * 100 >= value;
      case "enemyHpBelow":
        return enemyRate * 100 < value;
      case "enemyHpAbove":
        return enemyRate * 100 >= value;
      case "hpWorseThanEnemy":
        return playerRate < enemyRate;
      case "hpBetterThanEnemy":
        return playerRate >= enemyRate;
      case "opening":
        return value > 0 && ctx.player.actionCount <= value;
      case "afterActions":
        return value > 0 && ctx.player.actionCount >= value;
      case "enemyDefGEAtk":
        return effectiveDef(ctx.enemy) >= effectiveAtk(ctx.player);
      case "tookHit":
        return ctx.sawHit;
      case "notTookHit":
        return !ctx.sawHit;
      case "lastWasNormal":
        return ctx.player.lastAction === "normal";
      case "lastWasSkill":
        return ctx.player.lastAction === "skill";
      case "selfFaster":
        return ctx.player.speed > ctx.enemy.speed;
      case "enemyFaster":
        return ctx.enemy.speed >= ctx.player.speed;
      case "enemyHasDebuff":
        return hasDebuff(ctx.enemy);
      case "enemyNoDebuff":
        return !hasDebuff(ctx.enemy);
      case "enemyHasBuff":
        return hasBuff(ctx.enemy);
      case "selfHasDebuff":
        return hasDebuff(ctx.player);
      case "selfHasBuff":
        return hasBuff(ctx.player);
      case "enemyRegen":
        return ctx.enemy.regenAmount > 0;
      case "selfNoBuff":
        return !hasBuff(ctx.player);
      case "everyN":
        return value > 0 && ctx.player.actionCount % value === 0;
      default:
        return false;
    }
  }

  function simulate(input) {
    const player = makeCombatant("あなた", input.stats);
    const enemy = makeCombatant(input.enemy.name, input.enemy);
    const events = [];
    const keepLog = input.keepLog !== false;
    const levels = input.levels || {};
    const flowchart = input.flowchart || input.flow || [];
    let currentAction = 0;
    let currentSide = null;

    function pushEvent(text, kind) {
      if (!keepLog) return;
      events.push({
        text,
        kind: kind || "system",
        actionNo: currentAction || 0,
        side: currentSide,
        playerHp: player.hp,
        playerMax: player.maxHp,
        enemyHp: enemy.hp,
        enemyMax: enemy.maxHp,
      });
    }

    function log(text, kind) {
      let line = text;
      if (amped && kind === "attack") {
        line = text.includes("〕") ? text.replace("〕", "〕集中が乗り、") : `集中が乗り、${text}`;
        amped = false;
      }
      pushEvent(line, kind);
      if (trailer) {
        pushEvent(trailer.text, trailer.kind);
        trailer = null;
      }
    }

    let amped = false;
    let trailer = null;
    const ctx = {
      player,
      enemy,
      sawHit: false,
      actor: null,
      p: "",
      log,
      overNote(n) {
        return n > 0 ? `(${n}オーバー)` : "";
      },
      hasDebuff,
      effectiveAtk,
      effectiveDef,
      damage(mult, opts) {
        return applyHit(ctx, player, enemy, mult, opts || {});
      },
      hurt(unit, amount, source) {
        const raw = Math.max(0, Math.floor(amount));
        const before = unit.hp;
        unit.hp = Math.max(0, unit.hp - raw);
        const dealt = before - unit.hp;
        if (source !== "self" && dealt > 0) unit.tookHit = true;
        return { dealt, over: Math.max(0, raw - dealt), raw };
      },
      heal(unit, base) {
        let eff = unit.healEff;
        unit.effects.forEach((effect) => {
          if (effect.kind === "healDown") eff *= 1 - effect.value;
        });
        eff = Math.max(0, eff);
        const amount = Math.max(0, Math.floor(base * eff));
        const room = Math.max(0, unit.maxHp - unit.hp);
        const got = Math.min(room, amount);
        unit.hp += got;
        return { got, over: Math.max(0, amount - got), raw: amount };
      },
      addEffect(unit, effect) {
        const next = { ...effect, fresh: unit === ctx.actor };
        if (next.scale === "atk" && next.value > 0) next.value *= unit.atkEff;
        if (next.scale === "def" && next.value > 0) next.value *= unit.defEff;
        unit.effects = unit.effects.filter((item) => item.id !== next.id);
        unit.effects.push(next);
      },
      cleanse(unit) {
        const before = unit.effects.length;
        unit.effects = unit.effects.filter((effect) => !effect.negative);
        return before - unit.effects.length;
      },
    };

    function applyHit(context, attacker, defender, mult, opts) {
      const amp = opts.amp === false ? null : attacker.effects.find((effect) => effect.kind === "skillAmp");
      let power = mult;
      if (amp) power *= 1 + amp.value;
      let dealt = rawDamage(attacker, defender, power, opts.ignore || 0);
      const reflect = defender.effects.find((effect) => effect.kind === "reflect");
      let back = 0;
      if (reflect) {
        dealt = Math.max(1, Math.floor(dealt * (1 - (reflect.reduction || 0))));
        back = Math.max(0, Math.floor(dealt * reflect.value));
      }
      const hpBefore = defender.hp;
      defender.hp = Math.max(0, defender.hp - dealt);
      const over = Math.max(0, dealt - hpBefore);
      if (dealt > 0) defender.tookHit = true;
      if (amp) {
        attacker.effects = attacker.effects.filter((effect) => effect !== amp);
        if (attacker === player) amped = true;
      }
      if (reflect && reflect.once) {
        defender.effects = defender.effects.filter((effect) => effect !== reflect);
      }
      if (back > 0) {
        const atkBefore = attacker.hp;
        attacker.hp = Math.max(0, attacker.hp - back);
        const backOver = Math.max(0, back - atkBefore);
        attacker.tookHit = true;
        trailer = {
          text: `${attacker.name}の攻撃に対し、${back}が跳ね返った。${backOver > 0 ? `(${backOver}オーバー)` : ""}`,
          kind: "hit",
        };
      }
      return { dmg: dealt, over, amped: !!amp, reflect: back };
    }

    function startTurn(unit) {
      let hot = 0;
      let extraRegen = 0;
      unit.effects.forEach((effect) => {
        if (effect.kind === "hot") hot += effect.value;
        if (effect.kind === "regenFlat") extraRegen += effect.value;
      });
      if (hot > 0) {
        const healed = ctx.heal(unit, hot);
        if (healed.got > 0 || healed.over > 0) {
          log(`${unit.name}の再生で${healed.got}回復した。${ctx.overNote(healed.over)}`, "heal");
        }
      }
      const blocked = unit.effects.some((effect) => effect.kind === "noRegen");
      if (!blocked && (unit.regenAmount > 0 || extraRegen > 0)) {
        unit.regenCounter += 1;
        if (unit.regenCounter >= unit.regenInterval) {
          unit.regenCounter = 0;
          const healed = ctx.heal(unit, unit.regenAmount + extraRegen);
          if (healed.got > 0 || healed.over > 0) {
            log(`${unit.name}の体力が${healed.got}回復した。${ctx.overNote(healed.over)}`, "heal");
          }
        }
      }
      let dot = 0;
      unit.effects.forEach((effect) => {
        if (effect.kind === "dot") dot += effect.value;
      });
      if (dot > 0) {
        const hurt = ctx.hurt(unit, dot, "dot");
        log(`${unit.name}は毒で${hurt.dealt}のダメージ。${ctx.overNote(hurt.over)}`, "dot");
      }
      return unit.hp > 0;
    }

    function endTurn(unit) {
      const haste = unit.effects.some((effect) => effect.kind === "cdHaste" && !effect.fresh) ? 1 : 0;
      Object.keys(unit.cd).forEach((id) => {
        if (unit.cdFresh[id]) return;
        unit.cd[id] -= 1 + haste;
        if (unit.cd[id] <= 0) delete unit.cd[id];
      });
      unit.cdFresh = {};
      unit.effects = unit.effects.filter((effect) => {
        if (effect.turns == null) return true;
        if (effect.fresh) {
          effect.fresh = false;
          return true;
        }
        effect.turns -= 1;
        return effect.turns > 0;
      });
    }

    function startCooldown(unit, id, skips) {
      unit.cd[id] = skips;
      unit.cdFresh[id] = true;
    }

    function playerAct() {
      const waiting = [];
      for (let i = 0; i < flowchart.length; i += 1) {
        const node = flowchart[i];
        const skill = W.SKILL_BY_ID[node.skillId];
        const level = levels[node.skillId] || 0;
        if (!skill || level <= 0) continue;
        if (skill.available && !skill.available(ctx, level)) continue;
        if (!conditionMet(node.cond, ctx)) continue;
        if (player.cd[skill.id] > 0) {
          waiting.push(skill.name);
          continue;
        }
        ctx.p = `〔${conditionLabel(node.cond)}〕`;
        skill.use(ctx, level);
        startCooldown(player, skill.id, skill.cooldown);
        player.lastAction = "skill";
        return;
      }
      const hit = applyHit(ctx, player, enemy, 1, { amp: false });
      const waitText = waiting.length ? `${waiting.join("、")}は再使用を待っていて、` : "";
      log(`${waitText}条件に合う技がなく、通常攻撃。${enemy.name}に${hit.dmg}のダメージ。${ctx.overNote(hit.over)}`, "attack");
      player.lastAction = "normal";
    }

    function enemyAttack(mult, label) {
      const hit = applyHit(ctx, enemy, player, mult, { amp: false });
      log(`${enemy.name}の${label}。あなたに${hit.dmg}のダメージ。${ctx.overNote(hit.over)}`, "hit");
    }

    function enemyAct() {
      if (enemy.boss && enemy.actionCount % 4 === 0) {
        enemyAttack(1.5, "大振り");
        return;
      }
      if (enemy.pattern === "armor" && enemy.actionCount % 3 === 0) {
        ctx.actor = enemy;
        ctx.addEffect(enemy, {
          id: "armor-up",
          kind: "defPct",
          value: 0.35,
          turns: 2,
          scale: "def",
        });
        log(`${enemy.name}は身を固めた。`, "buff");
        return;
      }
      if (enemy.pattern === "assassin" && enemy.actionCount % 3 === 0) {
        enemyAttack(1.65, "急所狙い");
        return;
      }
      if (enemy.pattern === "venom" && enemy.actionCount % 3 === 0) {
        const hit = applyHit(ctx, enemy, player, 0.55, { amp: false });
        const dot = Math.max(1, Math.floor(effectiveAtk(enemy) * 0.24));
        ctx.actor = enemy;
        ctx.addEffect(player, {
          id: "enemy-venom",
          kind: "dot",
          value: dot,
          turns: 4,
          negative: true,
        });
        log(`${enemy.name}の毒針。あなたに${hit.dmg}のダメージ。${ctx.overNote(hit.over)}毒が回る。`, "dot");
        return;
      }
      if (enemy.pattern === "berserk") {
        const missing = 1 - enemy.hp / enemy.maxHp;
        enemyAttack(0.88 + missing * 0.85, "殴打");
        return;
      }
      if (enemy.pattern === "warden" && enemy.hp / enemy.maxHp < 0.55 && !enemy.effects.some((e) => e.id === "warden")) {
        ctx.actor = enemy;
        ctx.addEffect(enemy, {
          id: "warden",
          kind: "defPct",
          value: 0.3,
          turns: 4,
          scale: "def",
        });
        ctx.addEffect(enemy, {
          id: "warden-dr",
          kind: "dr",
          value: 0.15,
          turns: 4,
        });
        log(`${enemy.name}は門を守る構えを取った。`, "buff");
        return;
      }
      if (enemy.pattern === "hex" && enemy.actionCount % 4 === 0) {
        ctx.actor = enemy;
        ctx.addEffect(player, {
          id: "hex-atk",
          kind: "atkPct",
          value: -0.18,
          turns: 3,
          negative: true,
        });
        ctx.addEffect(player, {
          id: "hex-heal",
          kind: "healDown",
          value: 0.3,
          turns: 3,
          negative: true,
        });
        log(`${enemy.name}の呪い。攻撃力と回復の効きが落ちた。`, "dot");
        return;
      }
      if (enemy.pattern === "regen") {
        enemyAttack(0.9, "打撃");
        return;
      }
      if (enemy.pattern === "armor") {
        enemyAttack(0.92, "打撃");
        return;
      }
      if (enemy.pattern === "assassin") {
        enemyAttack(0.88, "斬撃");
        return;
      }
      if (enemy.pattern === "venom") {
        enemyAttack(0.82, "噛みつき");
        return;
      }
      if (enemy.pattern === "warden") {
        enemyAttack(0.9, "打撃");
        return;
      }
      if (enemy.pattern === "hex") {
        enemyAttack(0.92, "打撃");
        return;
      }
      enemyAttack(1, "打撃");
    }

    function takeTurn(unit) {
      ctx.actor = unit;
      unit.actionCount += 1;
      currentAction = unit.actionCount;
      currentSide = unit === player ? "player" : "enemy";
      if (!startTurn(unit)) return false;
      if (unit === player) {
        ctx.sawHit = player.tookHit;
        player.tookHit = false;
        playerAct();
      } else {
        enemyAct();
      }
      endTurn(unit);
      if (player.hp <= 0 || enemy.hp <= 0) return false;
      return true;
    }

    log(`${enemy.name}が行く手を阻む。`, "system");

    let nextP = 0;
    let nextE = 0;
    let actions = 0;
    let guard = 0;
    let lastSide = "player";
    while (player.hp > 0 && enemy.hp > 0 && actions < MAX_ACTIONS && guard < 5000) {
      guard += 1;
      if (nextP <= nextE) {
        lastSide = "player";
        nextP += 1000 / player.speed;
        actions += 1;
        if (!takeTurn(player)) break;
      } else {
        lastSide = "enemy";
        nextE += 1000 / enemy.speed;
        actions += 1;
        if (!takeTurn(enemy)) break;
      }
    }

    currentAction = 0;
    currentSide = null;

    let winner;
    let reason;
    if (enemy.hp <= 0 && player.hp <= 0) {
      winner = lastSide === "enemy" ? "enemy" : "player";
      reason = "kill";
    } else if (enemy.hp <= 0) {
      winner = "player";
      reason = "kill";
    } else if (player.hp <= 0) {
      winner = "enemy";
      reason = "kill";
    } else {
      const playerRate = player.hp / player.maxHp;
      const enemyRate = enemy.hp / enemy.maxHp;
      winner = playerRate > enemyRate ? "player" : "enemy";
      reason = "timeout";
      log(
        winner === "player"
          ? "長い戦いの末、相手の体力の割合が先に尽きた。"
          : "長い戦いの末、こちらの体力の割合が先に尽きた。",
        "system"
      );
    }

    if (winner === "player") log(`${enemy.name}を倒した。`, "system");
    else log("あなたは倒れた。", "down");

    return {
      winner,
      reason,
      events,
      actions,
      playerActions: player.actionCount,
      enemyActions: enemy.actionCount,
      playerHp: player.hp,
      playerMax: player.maxHp,
      enemyHp: enemy.hp,
      enemyMax: enemy.maxHp,
    };
  }

  W.CONDITIONS = CONDITIONS;
  W.CONDITION_BY_TYPE = CONDITION_BY_TYPE;
  W.conditionLabel = conditionLabel;
  W.simulate = simulate;
  W.MAX_ACTIONS = MAX_ACTIONS;
})(typeof window !== "undefined" ? window : globalThis);
