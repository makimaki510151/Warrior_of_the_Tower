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
        const label = `${amped}が乗り、`;
        line = text.includes("〕") ? text.replace("〕", `〕${label}`) : `${label}${text}`;
        amped = null;
      }
      pushEvent(line, kind);
      if (trailer) {
        pushEvent(trailer.text, trailer.kind);
        trailer = null;
      }
    }

    let amped = null;
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
        let punish = 0;
        if (got > 0) {
          unit.effects.forEach((effect) => {
            if (effect.kind === "healPunish") punish += Math.floor(got * effect.value);
          });
        }
        if (punish > 0) {
          const before = unit.hp;
          unit.hp = Math.max(0, unit.hp - punish);
          const dealt = before - unit.hp;
          if (dealt > 0) {
            log(`${unit.name}の回復に罰が乗り、${dealt}のダメージ。`, "dot");
          }
        }
        return { got, over: Math.max(0, amount - got), raw: amount, punish };
      },
      addEffect(unit, effect) {
        const next = { ...effect, fresh: unit === ctx.actor };
        if (next.value > 0) {
          // 攻撃力バフ（割合・技威力上乗せ）には必ず攻撃力補助効率を乗せる
          if (next.kind === "atkPct" || next.kind === "skillAmp") next.value *= unit.atkEff;
          else if (next.scale === "atk") next.value *= unit.atkEff;
          if (next.kind === "defPct") next.value *= unit.defEff;
          else if (next.scale === "def") next.value *= unit.defEff;
        }
        unit.effects = unit.effects.filter((item) => item.id !== next.id);
        unit.effects.push(next);
      },
      /** 他の技の再使用待ちを即時に進める（exceptId は対象外） */
      advanceCds(unit, amount, exceptId) {
        const cut = Math.max(0, Math.floor(amount || 0));
        if (cut <= 0) return 0;
        let touched = 0;
        Object.keys(unit.cd).forEach((id) => {
          if (exceptId && id === exceptId) return;
          if (unit.cdFresh[id]) return;
          unit.cd[id] -= cut;
          touched += 1;
          if (unit.cd[id] <= 0) delete unit.cd[id];
        });
        return touched;
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
        if (attacker === player) {
          const skill = W.SKILL_BY_ID[amp.id];
          amped = (skill && skill.name) || "構え";
        }
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
      let regenHaste = 0;
      let regenSap = 0;
      unit.effects.forEach((effect) => {
        if (effect.kind === "regenHaste") regenHaste += effect.value;
        if (effect.kind === "regenSap") regenSap += effect.value;
      });
      const regenEvery = Math.max(1, unit.regenInterval - regenHaste);
      const blocked = unit.effects.some((effect) => effect.kind === "noRegen");
      const regenPool = Math.max(0, unit.regenAmount + extraRegen - regenSap);
      if (!blocked && regenPool > 0) {
        unit.regenCounter += 1;
        if (unit.regenCounter >= regenEvery) {
          unit.regenCounter = 0;
          const healed = ctx.heal(unit, regenPool);
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
      let hasteExtra = 0;
      unit.effects.forEach((effect) => {
        if (effect.kind === "cdHaste" && !effect.fresh) {
          hasteExtra = Math.max(hasteExtra, Math.max(0, Math.floor(effect.value || 0)));
        }
      });
      Object.keys(unit.cd).forEach((id) => {
        if (unit.cdFresh[id]) return;
        unit.cd[id] -= 1 + hasteExtra;
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
      let kick = 0;
      unit.effects.forEach((effect) => {
        // 今この行動で付いた拍子は、自分自身の再使用には掛けない
        if (effect.kind === "cdKick" && !effect.fresh) {
          kick = Math.max(kick, Math.max(0, Math.floor(effect.value || 0)));
        }
      });
      const final = Math.max(0, skips - kick);
      if (final <= 0) return;
      unit.cd[id] = final;
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
      if (enemy.pattern === "vampir") {
        const hit = applyHit(ctx, enemy, player, 1.05, { amp: false });
        const healed = ctx.heal(enemy, hit.dmg * 0.38);
        log(
          `${enemy.name}の吸血打撃。あなたに${hit.dmg}のダメージ。${ctx.overNote(hit.over)}${
            healed.got > 0 ? `${enemy.name}は${healed.got}回復した。` : ""
          }${ctx.overNote(healed.over)}`,
          "hit"
        );
        return;
      }
      if (enemy.pattern === "shatter" && enemy.actionCount % 3 === 0) {
        const hit = applyHit(ctx, enemy, player, 1.15, { amp: false, ignore: 0.35 });
        ctx.actor = enemy;
        ctx.addEffect(player, {
          id: "shatter-def",
          kind: "defPct",
          value: -0.24,
          turns: 3,
          negative: true,
        });
        log(`${enemy.name}の破甲撃。あなたに${hit.dmg}のダメージ。${ctx.overNote(hit.over)}防御が削れた。`, "hit");
        return;
      }
      if (enemy.pattern === "shatter") {
        enemyAttack(0.95, "打撃");
        return;
      }
      if (enemy.pattern === "priest" && enemy.actionCount % 3 === 0) {
        const healed = ctx.heal(enemy, enemy.maxHp * 0.09);
        log(`${enemy.name}は祈り、${healed.got}回復した。${ctx.overNote(healed.over)}`, "heal");
        return;
      }
      if (enemy.pattern === "priest") {
        enemyAttack(0.88, "錫杖");
        return;
      }
      if (enemy.pattern === "storm" && enemy.actionCount % 3 === 0) {
        enemyAttack(0.78, "連撃・一閃");
        if (player.hp > 0) enemyAttack(0.78, "連撃・追撃");
        return;
      }
      if (enemy.pattern === "storm") {
        enemyAttack(0.9, "斬撃");
        return;
      }
      if (enemy.pattern === "mirror" && enemy.actionCount % 4 === 0) {
        ctx.actor = enemy;
        ctx.addEffect(enemy, {
          id: "mirror-reflect",
          kind: "reflect",
          value: 0.5,
          reduction: 0.2,
          once: true,
          turns: 3,
        });
        log(`${enemy.name}は鏡の構えを取った。`, "buff");
        return;
      }
      if (enemy.pattern === "mirror") {
        enemyAttack(0.92, "打撃");
        return;
      }
      if (enemy.pattern === "siege" && enemy.actionCount % 4 === 0) {
        enemyAttack(1.85, "攻城撃");
        return;
      }
      if (enemy.pattern === "siege") {
        enemyAttack(0.85, "突進");
        return;
      }
      if (enemy.pattern === "abyss" && enemy.actionCount % 4 === 0) {
        ctx.actor = enemy;
        ctx.addEffect(player, {
          id: "abyss-noregen",
          kind: "noRegen",
          value: 1,
          turns: 4,
          negative: true,
        });
        ctx.addEffect(player, {
          id: "abyss-heal",
          kind: "healDown",
          value: 0.35,
          turns: 4,
          negative: true,
        });
        log(`${enemy.name}の深淵。自動回復が封じられ、回復の効きが落ちた。`, "dot");
        return;
      }
      if (enemy.pattern === "abyss") {
        enemyAttack(0.95, "闇撃");
        return;
      }
      if (enemy.pattern === "plaguebearer" && enemy.actionCount % 2 === 0) {
        const hit = applyHit(ctx, enemy, player, 0.5, { amp: false });
        const dot = Math.max(1, Math.floor(effectiveAtk(enemy) * 0.34));
        ctx.actor = enemy;
        ctx.addEffect(player, {
          id: "enemy-plague",
          kind: "dot",
          value: dot,
          turns: 5,
          negative: true,
        });
        log(`${enemy.name}の疫。あなたに${hit.dmg}のダメージ。${ctx.overNote(hit.over)}濃い毒が回る。`, "dot");
        return;
      }
      if (enemy.pattern === "plaguebearer") {
        enemyAttack(0.82, "接触");
        return;
      }
      if (enemy.pattern === "colossus" && enemy.actionCount % 5 === 0) {
        enemyAttack(1.95, "巨圧");
        return;
      }
      if (enemy.pattern === "colossus") {
        enemyAttack(0.88, "踏みつけ");
        return;
      }
      if (enemy.pattern === "phantom" && enemy.actionCount % 3 === 0) {
        ctx.actor = enemy;
        ctx.addEffect(enemy, {
          id: "phantom-dr",
          kind: "dr",
          value: 0.28,
          turns: 2,
        });
        enemyAttack(0.95, "幻斬");
        return;
      }
      if (enemy.pattern === "phantom") {
        enemyAttack(1.05, "残像斬");
        return;
      }
      if (
        enemy.pattern === "bloodarmor" &&
        enemy.hp / enemy.maxHp <= 0.4 &&
        !enemy.effects.some((e) => e.id === "bloodarmor")
      ) {
        ctx.actor = enemy;
        ctx.addEffect(enemy, {
          id: "bloodarmor",
          kind: "defPct",
          value: 0.42,
          turns: 5,
          scale: "def",
        });
        ctx.addEffect(enemy, {
          id: "bloodarmor-dr",
          kind: "dr",
          value: 0.2,
          turns: 5,
        });
        log(`${enemy.name}は血の装を纏った。`, "buff");
        return;
      }
      if (enemy.pattern === "bloodarmor") {
        enemyAttack(1.0, "血撃");
        return;
      }
      if (enemy.pattern === "drainhex" && enemy.actionCount % 3 === 0) {
        const hit = applyHit(ctx, enemy, player, 1.05, { amp: false });
        ctx.actor = enemy;
        ctx.addEffect(player, {
          id: "drainhex-atk",
          kind: "atkPct",
          value: -0.2,
          turns: 3,
          negative: true,
        });
        ctx.addEffect(player, {
          id: "drainhex-heal",
          kind: "healDown",
          value: 0.28,
          turns: 3,
          negative: true,
        });
        log(`${enemy.name}の吸呪。あなたに${hit.dmg}のダメージ。${ctx.overNote(hit.over)}呪いが回る。`, "dot");
        return;
      }
      if (enemy.pattern === "drainhex") {
        enemyAttack(0.92, "呪打");
        return;
      }
      if (enemy.pattern === "ironthorn" && enemy.actionCount % 3 === 0) {
        ctx.actor = enemy;
        ctx.addEffect(enemy, {
          id: "ironthorn-reflect",
          kind: "reflect",
          value: 0.55,
          reduction: 0.15,
          once: true,
          turns: 3,
        });
        log(`${enemy.name}は茨を逆立てた。`, "buff");
        return;
      }
      if (enemy.pattern === "ironthorn") {
        enemyAttack(0.9, "茨打");
        return;
      }
      if (enemy.pattern === "eclipse" && enemy.actionCount % 4 === 0) {
        ctx.actor = enemy;
        ctx.addEffect(player, {
          id: "eclipse-noregen",
          kind: "noRegen",
          value: 1,
          turns: 3,
          negative: true,
        });
        ctx.addEffect(player, {
          id: "eclipse-heal",
          kind: "healDown",
          value: 0.32,
          turns: 3,
          negative: true,
        });
        log(`${enemy.name}の蝕。回復が鈍くなり、自動回復も止まった。`, "dot");
        return;
      }
      if (enemy.pattern === "eclipse") {
        enemyAttack(0.95, "蝕撃");
        return;
      }
      if (enemy.pattern === "executioner") {
        const low = 1 - player.hp / player.maxHp;
        enemyAttack(0.9 + low * 1.05, "処刑斬");
        return;
      }
      if (enemy.pattern === "bastion" && enemy.actionCount === 1) {
        ctx.actor = enemy;
        ctx.addEffect(enemy, {
          id: "bastion-def",
          kind: "defPct",
          value: 0.35,
          turns: 4,
          scale: "def",
        });
        ctx.addEffect(enemy, {
          id: "bastion-dr",
          kind: "dr",
          value: 0.18,
          turns: 4,
        });
        log(`${enemy.name}は要塞の核を顕した。`, "buff");
        return;
      }
      if (enemy.pattern === "bastion") {
        enemyAttack(0.95, "核撃");
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
