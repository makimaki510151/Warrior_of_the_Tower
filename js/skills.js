(function (root) {
  const W = root.Wot || (root.Wot = {});

  const BASE_STATS = {
    maxHp: 170,
    atk: 18,
    def: 8,
    regenInterval: 4,
    regenAmount: 5,
    healEff: 1,
    atkEff: 1,
    defEff: 1,
    speed: 100,
    dmgBonus: 0,
    dmgReduction: 0,
  };

  function gain(partial) {
    return {
      maxHp: 0,
      atk: 0,
      def: 0,
      regenInterval: 0,
      regenAmount: 0,
      healEff: 0,
      atkEff: 0,
      defEff: 0,
      speed: 0,
      dmgBonus: 0,
      dmgReduction: 0,
      ...partial,
    };
  }

  function scaled(base, step, level) {
    return base + (level - 1) * step;
  }

  function pctLabel(rate) {
    return String(Math.floor(rate * 1000) / 10);
  }

  function maxHpPct(rate, stats) {
    const label = pctLabel(rate);
    if (!stats) return `${label}%`;
    return `${label}%(${Math.floor(stats.maxHp * rate)})`;
  }

  function atkMult(mult, stats) {
    const m = Number(mult).toFixed(2);
    if (!stats) return `攻撃×${m}`;
    const raw = Math.floor(Math.max(1, stats.atk) * (1 + (stats.dmgBonus || 0)) * mult);
    return `攻撃×${m}(${raw})`;
  }

  function multText(base, step, level, stats) {
    const now = scaled(base, step, level);
    const next = scaled(base, step, level + 1);
    return `威力は${atkMult(now, stats)}。次の強化で×${next.toFixed(2)}（+${step.toFixed(2)}）`;
  }

  /** 次の強化で…（+step） — 上昇率の共通テンプレート */
  function growthTail(nextText, stepText) {
    return `次の強化で${nextText}（+${stepText}）`;
  }

  function pctStepLabel(step) {
    const n = Math.floor(step * 1000) / 10;
    return Number.isInteger(n) ? `${n}%` : `${n}%`;
  }

  function pctNowLabel(rate) {
    return `${Math.floor(rate * 100)}%`;
  }

  /** 条件付き二系統の倍率に上昇率を付ける */
  function dualMultGrowth(baseA, stepA, baseB, stepB, level) {
    const nextA = scaled(baseA, stepA, level + 1);
    const nextB = scaled(baseB, stepB, level + 1);
    return growthTail(
      `×${nextA.toFixed(2)}／×${nextB.toFixed(2)}`,
      `${stepA.toFixed(2)}／+${stepB.toFixed(2)}`
    );
  }

  function atkBuffText(base, step, level, stats) {
    const now = scaled(base, step, level);
    const next = scaled(base, step, level + 1);
    let cur = `+${pctNowLabel(now)}`;
    if (stats) {
      const flat = Math.floor(Math.max(1, stats.atk) * now * (stats.atkEff || 1));
      cur = `+${pctNowLabel(now)}(+${flat})`;
    }
    return `一時的な攻撃力${cur}。${growthTail(`+${pctNowLabel(next)}`, pctStepLabel(step))}`;
  }

  function defBuffText(base, step, level, stats) {
    const now = scaled(base, step, level);
    const next = scaled(base, step, level + 1);
    let cur = `+${pctNowLabel(now)}`;
    if (stats) {
      const flat = Math.floor(Math.max(0, stats.def) * now * (stats.defEff || 1));
      cur = `+${pctNowLabel(now)}(+${flat})`;
    }
    return `一時的な防御力${cur}。${growthTail(`+${pctNowLabel(next)}`, pctStepLabel(step))}`;
  }

  function drText(base, step, level) {
    const now = scaled(base, step, level);
    const next = scaled(base, step, level + 1);
    return `受けるダメージを${pctNowLabel(now)}減らす。${growthTail(`${pctNowLabel(next)}減`, pctStepLabel(step))}`;
  }

  function healPctText(base, step, level, stats, prefix) {
    const now = scaled(base, step, level);
    const next = scaled(base, step, level + 1);
    const head = prefix || "最大体力の";
    return `${head}${maxHpPct(now, stats)}を基礎に回復する。${growthTail(
      maxHpPct(next, stats),
      pctStepLabel(step)
    )}`;
  }

  function ampText(base, step, level, stats) {
    const now = scaled(base, step, level);
    const next = scaled(base, step, level + 1);
    let cur = `+${pctNowLabel(now)}`;
    if (stats) {
      const flat = Math.floor(
        Math.max(1, stats.atk) * (1 + (stats.dmgBonus || 0)) * now * (stats.atkEff || 1)
      );
      cur = `+${pctNowLabel(now)}(+${flat})`;
    }
    return `次に出す攻撃技の威力を${cur}上乗せする（攻撃力補助効率も乗る）。${growthTail(
      `+${pctNowLabel(next)}`,
      pctStepLabel(step)
    )}`;
  }

  function speedBuffText(base, step, level) {
    const now = scaled(base, step, level);
    const next = scaled(base, step, level + 1);
    return `一時的な行動速度${now >= 0 ? "+" : ""}${pctNowLabel(now)}。${growthTail(
      `${next >= 0 ? "+" : ""}${pctNowLabel(next)}`,
      pctStepLabel(Math.abs(step))
    )}`;
  }

  function flatEffText(label, base, step, level) {
    const now = scaled(base, step, level);
    const next = scaled(base, step, level + 1);
    const fmt = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
    return `一時的な${label}${fmt(now)}。${growthTail(fmt(next), step.toFixed(2))}`;
  }

  function dmgBonusText(base, step, level) {
    const now = scaled(base, step, level);
    const next = scaled(base, step, level + 1);
    return `一時的な与ダメージ補正${now >= 0 ? "+" : ""}${pctNowLabel(now)}。${growthTail(
      `${next >= 0 ? "+" : ""}${pctNowLabel(next)}`,
      pctStepLabel(Math.abs(step))
    )}`;
  }

  function overNote(n) {
    return n > 0 ? `(${n}オーバー)` : "";
  }

  /** 使ったあと、自分の行動を何回空ければまた使えるか */
  function cooldownReuseText(skips) {
    const n = Math.max(0, Math.floor(Number(skips) || 0));
    if (n === 0) return "使った直後から、また使える。";
    return `使ったあと、自分の行動を${n}回空けるとまた使える。`;
  }

  function cooldownShort(skips) {
    const n = Math.max(0, Math.floor(Number(skips) || 0));
    return `再使用まで自分の行動${n}回`;
  }

  /** パッシブ技向け（手順に組まない） */
  function passiveReuseText() {
    return "所持するだけで発動する（手順には組まない）。";
  }

  function passiveShort() {
    return "常時";
  }


  function tickPulse(ctx, level) {
    const mem = ctx.player.passiveMem || (ctx.player.passiveMem = {});
    mem.pulseActs = (mem.pulseActs || 0) + 1;
    if (mem.pulseActs % 4 !== 0) return;
    const mult = scaled(1.4, 0.15, level);
    const healed = ctx.heal(ctx.player, Math.max(0, ctx.player.regenAmount || 0) * mult);
    if (healed.got > 0 || healed.over > 0) {
      ctx.log(`脈律。拍に合わせて${healed.got}回復した。${ctx.overNote(healed.over)}`, "heal");
    }
  }

  const SKILLS = [
    {
      id: "slash",
      name: "斬撃",
      group: "攻撃",
      blurb: "癖の少ない一振り。突出した強さはない。",
      tradeoff: "間隔は短いが、大技の頂点には届かない。",
      cooldown: 1,
      gain: gain({ maxHp: 4, atk: 2, def: 2 }),
      describe(level, stats) {
        return [multText(1.16, 0.04, level, stats)];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(1.16, 0.04, level));
        ctx.log(`${ctx.p}斬撃。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "flurry",
      name: "連撃",
      group: "攻撃",
      blurb: "短い間隔で斬る。一発の重さは強打に劣る。",
      tradeoff: "行動は速くなるが、防御は増えない。",
      cooldown: 1,
      gain: gain({ maxHp: 2, atk: 2, speed: 6 }),
      describe(level, stats) {
        return [multText(1.28, 0.05, level, stats), "体が速くなる代わりに、守りは伸びない。"];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(1.28, 0.05, level));
        ctx.log(`${ctx.p}連撃。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "heavy",
      name: "強打",
      group: "攻撃",
      blurb: "重い一撃。立て続けには出せない。",
      tradeoff: "単発は強いが、間に通常攻撃が挟まりやすい。",
      cooldown: 3,
      gain: gain({ maxHp: 6, atk: 3, atkEff: 0.02 }),
      describe(level, stats) {
        return [multText(1.72, 0.06, level, stats)];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(1.72, 0.06, level));
        ctx.log(`${ctx.p}強打。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "pierce",
      name: "貫打",
      group: "攻撃",
      blurb: "防御の一部を無視する。素の火力は高くない。",
      tradeoff: "硬い相手に通り、柔らかい相手には強打に負ける。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 2, def: 1, dmgBonus: 0.006 }),
      describe(level, stats) {
        const ignore = Math.min(0.6, scaled(0.28, 0.01, level));
        return [
          multText(1.22, 0.05, level, stats),
          `敵の防御を${Math.floor(ignore * 100)}%無視する。次は+1%。`,
        ];
      },
      use(ctx, level) {
        const ignore = Math.min(0.6, scaled(0.28, 0.01, level));
        const r = ctx.damage(scaled(1.22, 0.05, level), { ignore });
        ctx.log(`${ctx.p}貫打。防御を貫き、${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "execute",
      name: "追撃",
      group: "攻撃",
      blurb: "弱った敵に強い。元気な相手には手ぬるい。",
      tradeoff: "敵の体力が半分以上あると、通常攻撃より弱い。",
      cooldown: 2,
      gain: gain({ maxHp: 3, atk: 4, speed: 1 }),
      describe(level, stats) {
        return [
          `敵の体力が50%未満なら${atkMult(scaled(1.68, 0.06, level), stats)}。`,
          `それ以外は${atkMult(scaled(0.62, 0.02, level), stats)}。`,
          dualMultGrowth(1.68, 0.06, 0.62, 0.02, level),
        ];
      },
      use(ctx, level) {
        const low = ctx.enemy.hp / ctx.enemy.maxHp < 0.5;
        const mult = low ? scaled(1.68, 0.06, level) : scaled(0.62, 0.02, level);
        const r = ctx.damage(mult);
        ctx.log(
          `${ctx.p}追撃。${low ? "隙を突いて" : "手応えは薄く、"}${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
      },
    },
    {
      id: "laststand",
      name: "背水",
      group: "攻撃",
      blurb: "体力が減っているほど強い。満タンでは通常攻撃に負ける。",
      tradeoff: "開幕から撃つと損をする。手順で体力を見てから使う技。",
      cooldown: 2,
      gain: gain({ maxHp: 4, atk: 3, dmgBonus: 0.005 }),
      describe(level, stats) {
        const full = scaled(0.5, 0.02, level);
        const empty = full + scaled(1.2, 0.05, level);
        const nextFull = scaled(0.5, 0.02, level + 1);
        const nextEmpty = nextFull + scaled(1.2, 0.05, level + 1);
        return [
          `満タン時は${atkMult(full, stats)}。体力が尽きかけたとき${atkMult(empty, stats).replace("攻撃×", "最大×")}。`,
          "減っている体力の割合だけ、威力が一定幅で上乗せされる。",
          growthTail(`×${nextFull.toFixed(2)}／最大×${nextEmpty.toFixed(2)}`, `0.02／+0.07`),
        ];
      },
      use(ctx, level) {
        const missing = 1 - ctx.player.hp / ctx.player.maxHp;
        const mult = scaled(0.5, 0.02, level) + missing * scaled(1.2, 0.05, level);
        const r = ctx.damage(mult);
        ctx.log(`${ctx.p}背水。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "gamble",
      name: "捨て身",
      group: "攻撃",
      blurb: "非常に大きい一撃。自分の体力を削り、防御も下がる。",
      tradeoff: "火力の代わりに打たれ弱くなる。回復がなければ自滅する。",
      cooldown: 3,
      gain: gain({ atk: 5, def: -2, dmgReduction: -0.012 }),
      describe(level, stats) {
        const cost = scaled(0.08, 0.003, level);
        const nextCost = scaled(0.08, 0.003, level + 1);
        return [
          multText(2.02, 0.08, level, stats),
          `自分の最大体力の${maxHpPct(cost, stats)}を失う。防御無視や軽減は乗らない。${growthTail(
            maxHpPct(nextCost, stats),
            pctStepLabel(0.003)
          )}`,
          "習得のたびに防御が下がり、受けるダメージも増える。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(2.02, 0.08, level));
        const hurt = ctx.hurt(ctx.player, ctx.player.maxHp * scaled(0.08, 0.003, level), "self");
        const cost = hurt.dealt;
        ctx.log(`${ctx.p}捨て身。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}自分も${cost}削った。${ctx.overNote(hurt.over)}`, "attack");
      },
    },
    {
      id: "leech",
      name: "吸血",
      group: "攻撃",
      blurb: "与えたダメージの一部を体力に変える。通らない相手には回復も薄い。",
      tradeoff: "硬い敵には回復量が落ちる。応急のような安定はない。攻撃の伸びも控えめ。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 1, healEff: 0.01, def: -1 }),
      describe(level, stats) {
        const ratio = scaled(0.22, 0.01, level);
        const next = scaled(0.22, 0.01, level + 1);
        return [
          multText(1.0, 0.035, level, stats),
          `与ダメージの${pctNowLabel(ratio)}を基礎に回復する。回復効率がかかる。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.01)
          )}`,
        ];
      },
      use(ctx, level) {
        const ratio = scaled(0.22, 0.01, level);
        const r = ctx.damage(scaled(1.0, 0.035, level));
        const healed = ctx.heal(ctx.player, r.dmg * ratio);
        const got = healed.got;
        ctx.log(`${ctx.p}吸血。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}${got}回復した。${ctx.overNote(healed.over)}`, "attack");
      },
    },
    {
      id: "chain",
      name: "連技",
      group: "攻撃",
      blurb: "直前も技を出していれば強い。通常攻撃の直後は弱い。",
      tradeoff: "単体で回すと通常攻撃が挟まり、弱い方の威力ばかり出る。",
      cooldown: 1,
      gain: gain({ maxHp: 2, atk: 2, speed: 4, atkEff: 0.02 }),
      describe(level, stats) {
        return [
          `直前の行動が技なら${atkMult(scaled(1.52, 0.05, level), stats)}。`,
          `通常攻撃の直後なら${atkMult(scaled(0.7, 0.02, level), stats)}。`,
          dualMultGrowth(1.52, 0.05, 0.7, 0.02, level),
        ];
      },
      use(ctx, level) {
        const follow = ctx.player.lastAction === "skill";
        const mult = follow ? scaled(1.52, 0.05, level) : scaled(0.7, 0.02, level);
        const r = ctx.damage(mult);
        ctx.log(
          `${ctx.p}連技。${follow ? "流れに乗って" : "間が空いて"}${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
      },
    },
    {
      id: "siege",
      name: "破城",
      group: "攻撃",
      blurb: "防御の硬い相手に特に通る。柔らかい相手には普通以下。",
      tradeoff: "自分の攻撃が敵の防御を上回ると、得意条件から外れる。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 2, def: 3 }),
      describe(level, stats) {
        return [
          `敵の防御が自分の攻撃以上なら、${atkMult(scaled(1.58, 0.06, level), stats)}かつ防御20%無視。`,
          `そうでなければ${atkMult(scaled(0.88, 0.025, level), stats)}。`,
          dualMultGrowth(1.58, 0.06, 0.88, 0.025, level),
        ];
      },
      use(ctx, level) {
        const tank = ctx.effectiveDef(ctx.enemy) >= ctx.effectiveAtk(ctx.player);
        const mult = tank ? scaled(1.58, 0.06, level) : scaled(0.88, 0.025, level);
        const r = ctx.damage(mult, { ignore: tank ? 0.22 : 0 });
        ctx.log(
          `${ctx.p}破城。${tank ? "硬い守りを砕き、" : "手応えは軽く、"}${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
      },
    },
    {
      id: "sunder",
      name: "崩甲",
      group: "崩し",
      blurb: "敵の防御をしばらく大きく下げる。攻撃はしない。",
      tradeoff: "その行動では削らない。後続の攻撃や弱点と組んで初めて活きる。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 1, def: 2, atkEff: 0.03 }),
      describe(level) {
        const down = scaled(0.36, 0.025, level);
        const next = scaled(0.36, 0.025, level + 1);
        return [
          `敵の防御力を${pctNowLabel(down)}下げる（敵の5行動）。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.025)
          )}`,
          "この低下に、自分の補助効率は乗らない。",
        ];
      },
      use(ctx, level) {
        const down = scaled(0.36, 0.025, level);
        ctx.addEffect(ctx.enemy, {
          id: "sunder",
          kind: "defPct",
          value: -down,
          turns: 5,
          negative: true,
        });
        ctx.log(`${ctx.p}崩甲。${ctx.enemy.name}の防御力を下げた。`, "buff");
      },
    },
    {
      id: "exploit",
      name: "弱点",
      group: "崩し",
      blurb: "弱体している敵に強い。何もない相手には頼りない。",
      tradeoff: "崩甲や毒や枯渇のあとで撃つ技。単体では追撃にも劣る。",
      cooldown: 2,
      gain: gain({ maxHp: 1, atk: 3, speed: 4, atkEff: 0.01 }),
      describe(level, stats) {
        return [
          `敵が弱体中なら${atkMult(scaled(2.35, 0.09, level), stats)}。`,
          `何もなければ${atkMult(scaled(0.95, 0.03, level), stats)}。`,
          dualMultGrowth(2.35, 0.09, 0.95, 0.03, level),
        ];
      },
      use(ctx, level) {
        const debuffed = ctx.hasDebuff(ctx.enemy);
        const mult = debuffed ? scaled(2.35, 0.09, level) : scaled(0.95, 0.03, level);
        const r = ctx.damage(mult);
        ctx.log(
          `${ctx.p}弱点。${debuffed ? "隙を広げて" : "狙いが外れ、"}${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
      },
    },
    {
      id: "venom",
      name: "毒刃",
      group: "崩し",
      blurb: "即時の一撃はなく、毒が長く効く。短期決戦には向かない。",
      tradeoff: "回復効率が下がり、自分の回復技と相性が悪い。",
      cooldown: 2,
      gain: gain({ maxHp: 2, atk: 3, speed: 4, healEff: -0.02 }),
      describe(level, stats) {
        const ratio = scaled(0.52, 0.04, level);
        const next = scaled(0.52, 0.04, level + 1);
        return [
          `敵に毒を回す。6行動のあいだ行動ごとに、付与時の攻撃力で${atkMult(ratio, stats)}相当（発生時の防御・軽減で減衰）。${growthTail(
            `×${next.toFixed(2)}`,
            "0.04"
          )}`,
          "毒は重ねがけせず、打ち直すと残りが更新される。即時ダメージはない。",
        ];
      },
      use(ctx, level) {
        const offense = ctx.snapshotOffense({ consumeAmp: false });
        ctx.addEffect(ctx.enemy, {
          id: "venom",
          kind: "dot",
          mult: scaled(0.52, 0.04, level),
          offense,
          turns: 6,
          negative: true,
        });
        ctx.log(`${ctx.p}毒刃。${ctx.enemy.name}に毒が回る。`, "buff");
      },
    },
    {
      id: "wither",
      name: "枯渇",
      group: "崩し",
      blurb: "敵の自動回復を止める。回復しない相手には効果が薄い。",
      tradeoff: "再生する敵専用に近い。削りは他の技に任せる。",
      cooldown: 3,
      gain: gain({ maxHp: 4, atk: 1, def: 2, regenAmount: 1 }),
      describe(level) {
        return [
          "敵の自動回復を、敵の5行動のあいだ止める。",
          "継続回復そのものは消さない。止めたあいだだけ働かない。即時ダメージはない。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.enemy, {
          id: "wither",
          kind: "noRegen",
          value: 1,
          turns: 5,
          negative: true,
        });
        ctx.log(`${ctx.p}枯渇。${ctx.enemy.name}の自動回復を封じた。`, "buff");
      },
    },
    {
      id: "guard",
      name: "鉄身",
      group: "守り",
      blurb: "しばらく防御が厚くなる。その行動では攻撃しない。",
      tradeoff: "割合軽減の堅守と違い、防御が高いほど伸びは鈍る。",
      cooldown: 3,
      gain: gain({ maxHp: 8, def: 4, defEff: 0.03 }),
      describe(level, stats) {
        return [
          `次の4行動、${defBuffText(0.55, 0.03, level, stats)}`,
          "この行動では攻撃しない。",
        ];
      },
      use(ctx, level) {
        const rate = scaled(0.55, 0.03, level);
        ctx.addEffect(ctx.player, {
          id: "guard",
          kind: "defPct",
          value: rate,
          turns: 4,
          scale: "def",
        });
        ctx.log(`${ctx.p}鉄身。防御力が上がった。`, "buff");
      },
    },
    {
      id: "fortress",
      name: "堅守",
      group: "守り",
      blurb: "短い間、受けるダメージを割合で減らす。攻撃力は下がる。",
      tradeoff: "鉄身より短く、素の攻撃が落ちる。すでに防御が高いと鉄身より効くことがある。",
      cooldown: 3,
      gain: gain({ maxHp: 4, atk: -1, def: 3, defEff: 0.02, dmgReduction: 0.012 }),
      describe(level, stats) {
        return [
          `次の3行動、${drText(0.4, 0.02, level)}`,
          "軽減は防御計算のあとでかかる。上限75%。",
        ];
      },
      use(ctx, level) {
        const rate = scaled(0.4, 0.02, level);
        ctx.addEffect(ctx.player, {
          id: "fortress",
          kind: "dr",
          value: rate,
          turns: 3,
        });
        ctx.log(`${ctx.p}堅守。受ける打撃をいなす体勢に入った。`, "buff");
      },
    },
    {
      id: "reflect",
      name: "反射",
      group: "守り",
      blurb: "次に受ける一撃を弱め、一部を返す。継続して守る力は鉄身に劣る。",
      tradeoff: "多段の削りには弱い。大振りを一度返すための技。",
      cooldown: 3,
      gain: gain({ maxHp: 5, def: 3, defEff: 0.02, speed: 3 }),
      describe(level, stats) {
        const ratio = scaled(0.5, 0.03, level);
        const next = scaled(0.5, 0.03, level + 1);
        return [
          "次に受ける打撃を22%軽減し、軽減後の55%前後を相手へ返す。",
          `返しの割合は今${pctNowLabel(ratio)}。3行動以内に受けなければ消える。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.03)
          )}`,
          "一度返すと解ける。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "reflect",
          kind: "reflect",
          value: scaled(0.5, 0.03, level),
          reduction: 0.22,
          once: true,
          turns: 3,
        });
        ctx.log(`${ctx.p}反射。次の一撃を受ける構えを取った。`, "buff");
      },
    },
    {
      id: "blood",
      name: "血脈",
      group: "守り",
      blurb: "体力が半分を切った瞬間、一度だけ鉄の守りが立つ。",
      tradeoff: "戦闘中に一度きり。余裕がある戦いでは眠る。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 12, def: 6, defEff: 0.04 }),
      describe(level, stats) {
        return [
          "戦闘中、体力が最大の50%未満へ落ちた最初の瞬間に一度だけ発動する。",
          `次の4行動、${defBuffText(0.55, 0.03, level, stats)}`,
        ];
      },
      afterPlayerTake(ctx, level, hit) {
        if (!hit || hit.dmg <= 0) return;
        const mem = ctx.player.passiveMem;
        if (mem.bloodTriggered) return;
        const max = ctx.player.maxHp;
        const now = ctx.player.hp;
        const before = now + hit.dmg;
        if (before / max >= 0.5 && now / max < 0.5) {
          mem.bloodTriggered = true;
          ctx.addEffect(ctx.player, {
            id: "blood",
            kind: "defPct",
            value: scaled(0.55, 0.03, level),
            turns: 4,
            scale: "def",
          });
          ctx.log(`血脈。半ばで体が鉄に変わった。`, "buff");
        }
      },
    },
    {
      id: "mend",
      name: "応急",
      group: "回復",
      blurb: "その場で少し体力を戻す。回復だけでは伸びにくい。",
      tradeoff: "回復量は控えめ。再使用も遅い。",
      cooldown: 5,
      gain: gain({ maxHp: 4, def: 1, healEff: 0.01, speed: -3 }),
      describe(level, stats) {
        return [
          healPctText(0.08, 0.004, level, stats),
          "回復効率がかかる。",
        ];
      },
      use(ctx, level) {
        const healed = ctx.heal(ctx.player, ctx.player.maxHp * scaled(0.08, 0.004, level));
        const got = healed.got;
        ctx.log(`${ctx.p}応急。体力が${got}回復した。${ctx.overNote(healed.over)}`, "heal");
      },
    },
    {
      id: "weave",
      name: "再生",
      group: "回復",
      blurb: "時間をかけて回復する。今すぐ足りないときには遅い。",
      tradeoff: "総量は応急より多いが、途中で倒れると取りこぼす。",
      cooldown: 6,
      gain: gain({ maxHp: 5, def: 1, regenAmount: 1, healEff: 0.01, speed: -2 }),
      describe(level, stats) {
        const each = scaled(0.03, 0.002, level);
        const next = scaled(0.03, 0.002, level + 1);
        return [
          `3行動にわたり、行動ごとに最大体力の${maxHpPct(each, stats)}を基礎に回復する。${growthTail(
            maxHpPct(next, stats),
            pctStepLabel(0.002)
          )}`,
          "打ち直すと残り時間は更新される。回復効率がかかる。",
        ];
      },
      use(ctx, level) {
        const each = Math.max(1, Math.floor(ctx.player.maxHp * scaled(0.03, 0.002, level)));
        ctx.addEffect(ctx.player, {
          id: "weave",
          kind: "hot",
          value: each,
          turns: 3,
        });
        ctx.log(`${ctx.p}再生。傷がゆっくり塞がり始める。`, "heal");
      },
    },
    {
      id: "pulse",
      name: "脈律",
      group: "回復",
      blurb: "行動の拍に合わせて、自動回復量が傷を縫う。",
      tradeoff: "即時の大きな回復はない。自動回復量が低いと薄い。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 9, regenAmount: 3, healEff: 0.025 }),
      describe(level, stats) {
        const mult = scaled(1.4, 0.15, level);
        const next = scaled(1.4, 0.15, level + 1);
        const regen = stats ? Math.max(0, stats.regenAmount || 0) : 0;
        const expect = stats ? Math.floor(regen * mult * (stats.healEff || 1)) : null;
        return [
          `自分の行動4回ごとに、自動回復量×${mult.toFixed(2)}を基礎に回復する${
            expect != null ? `（今なら約${expect}）` : ""
          }。${growthTail(`×${next.toFixed(2)}`, "0.15")}`,
        ];
      },
      afterPlayerSkill(ctx, level) {
        tickPulse(ctx, level);
      },
      afterPlayerNormal(ctx, level) {
        tickPulse(ctx, level);
      },
    },
    {
      id: "purify",
      name: "浄化",
      group: "回復",
      blurb: "弱体を払い、わずかに回復する。何も受けていなければほぼ無駄。",
      tradeoff: "回復量は薄い。弱体がない戦いでは枠を圧迫する。",
      cooldown: 4,
      gain: gain({ maxHp: 4, def: 1, healEff: 0.01 }),
      describe(level, stats) {
        return [
          "自分の弱体をすべて消す。",
          healPctText(0.04, 0.002, level, stats),
          "弱体を1つでも消したときは、さらに最大体力の3%が基礎に加わる。",
        ];
      },
      use(ctx, level) {
        const removed = ctx.cleanse(ctx.player);
        const rate = scaled(0.04, 0.002, level) + (removed > 0 ? 0.03 : 0);
        const healed = ctx.heal(ctx.player, ctx.player.maxHp * rate);
        const got = healed.got;
        ctx.log(
          `${ctx.p}浄化。${removed > 0 ? `弱体を${removed}つ払い、` : ""}体力が${got}回復した。${ctx.overNote(healed.over)}`,
          "heal"
        );
      },
    },
    {
      id: "rally",
      name: "鼓舞",
      group: "補助",
      blurb: "しばらく攻撃力が上がる。一撃の伸びは集中より小さい。",
      tradeoff: "通常攻撃にも乗るが、捨て身のような単発は集中に劣る。",
      cooldown: 3,
      gain: gain({ maxHp: 4, atk: 1, def: 2, atkEff: 0.03, speed: 2 }),
      describe(level, stats) {
        return [
          `次の3行動、${atkBuffText(0.22, 0.015, level, stats)}`,
          "通常攻撃にも、技にも乗る。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "rally",
          kind: "atkPct",
          value: scaled(0.22, 0.015, level),
          turns: 3,
          scale: "atk",
        });
        ctx.log(`${ctx.p}鼓舞。攻撃力が上がった。`, "buff");
      },
    },
    {
      id: "focus",
      name: "集中",
      group: "補助",
      blurb: "次の攻撃技を大きくする。通常攻撃には乗らない。",
      tradeoff: "鼓舞より短い。次が回復や守りだと、乗らずに残る。",
      cooldown: 2,
      gain: gain({ maxHp: 2, atk: 1, def: 1, atkEff: 0.05 }),
      describe(level, stats) {
        return [
          ampText(0.42, 0.03, level, stats),
          "通常攻撃では消費しない。攻撃技を出すと一度で消える。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "focus",
          kind: "skillAmp",
          value: scaled(0.42, 0.03, level),
          turns: null,
        });
        ctx.log(`${ctx.p}集中。次の攻撃技に備えを重ねた。`, "buff");
      },
    },
    {
      id: "haste",
      name: "加速",
      group: "補助",
      blurb: "技の待ちを一気に進め、しばらく回転と攻撃を底上げする。",
      tradeoff: "その行動では殴らない。待ちが空いていると即時短縮の恩恵は薄い。",
      cooldown: 3,
      gain: gain({ maxHp: 4, atk: 2, speed: 12, atkEff: 0.04 }),
      describe(level, stats) {
        const instant = Math.max(1, Math.floor(scaled(1, 0.5, level)));
        const nextInstant = Math.max(1, Math.floor(scaled(1, 0.5, level + 1)));
        const haste = Math.max(1, Math.floor(scaled(1, 0.5, level)));
        const nextHaste = Math.max(1, Math.floor(scaled(1, 0.5, level + 1)));
        const turns = Math.max(4, Math.floor(scaled(4, 0.5, level)));
        const nextTurns = Math.max(4, Math.floor(scaled(4, 0.5, level + 1)));
        return [
          `使用時、他の技の待ちを${instant}進める。${growthTail(`${nextInstant}`, "0.5切捨")}`,
          `その後${turns}行動、自分の行動が終わるたびに待ちが「1」ではなく「${1 + haste}」進む。${growthTail(
            `待ち+${nextHaste}／${nextTurns}行動`,
            "0.5切捨"
          )}`,
          `同じあいだ、${atkBuffText(0.18, 0.05, level, stats)}`,
        ];
      },
      use(ctx, level) {
        const instant = Math.max(1, Math.floor(scaled(1, 0.5, level)));
        const haste = Math.max(1, Math.floor(scaled(1, 0.5, level)));
        const turns = Math.max(4, Math.floor(scaled(4, 0.5, level)));
        const advanced = ctx.advanceCds(ctx.player, instant, "haste");
        ctx.addEffect(ctx.player, {
          id: "haste",
          kind: "cdHaste",
          value: haste,
          turns,
        });
        ctx.addEffect(ctx.player, {
          id: "haste-atk",
          kind: "atkPct",
          value: scaled(0.18, 0.05, level),
          turns,
          scale: "atk",
        });
        ctx.log(
          `${ctx.p}加速。${
            advanced > 0 ? `待ちを${instant}進め、` : ""
          }技の回転と攻撃力が上がった。`,
          "buff"
        );
      },
    },
    {
      id: "jab",
      name: "針継",
      group: "攻撃",
      blurb: "通常攻撃のあと、細い針がもう一度届く。",
      tradeoff: "追撃は軽い。技のあとは乗らない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 3, atk: 2, speed: 9 }),
      describe(level, stats) {
        return [
          "通常攻撃のあと、追撃が1回入る。",
          multText(0.35, 0.02, level, stats),
        ];
      },
      afterPlayerNormal(ctx, level) {
        if (ctx.enemy.hp <= 0) return;
        const r = ctx.damage(scaled(0.35, 0.02, level), { amp: false, fromPassive: true });
        ctx.log(`針継。追撃で${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "cleave",
      name: "薙ぎ",
      group: "攻撃",
      blurb: "体力が多い敵ほど通りやすい。",
      tradeoff: "削れた相手には普通以下。",
      cooldown: 2,
      gain: gain({ maxHp: 3, atk: 2, def: 1 }),
      describe(level, stats) {
        return [
          `敵の体力割合が高いほど強い。満タン付近で${atkMult(scaled(1.55, 0.05, level), stats)}。`,
          `尽きかけでは${atkMult(scaled(0.7, 0.02, level), stats)}。`,
          dualMultGrowth(1.55, 0.05, 0.7, 0.02, level),
        ];
      },
      use(ctx, level) {
        const rate = ctx.enemy.hp / ctx.enemy.maxHp;
        const mult = scaled(0.7, 0.02, level) + rate * scaled(0.85, 0.03, level);
        const r = ctx.damage(mult);
        ctx.log(`${ctx.p}薙ぎ。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "crush",
      name: "圧打",
      group: "攻撃",
      blurb: "防御をかなり無視する重い一撃。",
      tradeoff: "間隔が長く、素の防御は上がらない。",
      cooldown: 4,
      gain: gain({ maxHp: 4, atk: 3, atkEff: 0.02 }),
      describe(level, stats) {
        return [
          multText(1.35, 0.05, level, stats),
          "敵の防御を45%無視する。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(1.35, 0.05, level), { ignore: 0.45 });
        ctx.log(`${ctx.p}圧打。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "burst",
      name: "爆裂",
      group: "攻撃",
      blurb: "自分の体力を削って大ダメージ。",
      tradeoff: "捨て身より即時の代償は軽いが、威力もやや劣る。",
      cooldown: 3,
      gain: gain({ atk: 4, maxHp: 2, dmgReduction: -0.008 }),
      describe(level, stats) {
        return [multText(1.88, 0.07, level, stats), `自分の最大体力の${maxHpPct(0.06, stats)}を失う。`];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(1.88, 0.07, level));
        const hurt = ctx.hurt(ctx.player, ctx.player.maxHp * 0.06, "self");
        const cost = hurt.dealt;
        ctx.log(`${ctx.p}爆裂。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}自分も${cost}削った。${ctx.overNote(hurt.over)}`, "attack");
      },
    },
    {
      id: "drain",
      name: "血吸印",
      group: "攻撃",
      blurb: "与えた傷の一部が、静かに体力へ戻る。",
      tradeoff: "単発の回復技より弱い。通らない相手では戻らない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 7, atk: 2, healEff: 0.03 }),
      describe(level, stats) {
        const ratio = scaled(0.12, 0.01, level);
        const next = scaled(0.12, 0.01, level + 1);
        return [
          `自分が敵に与えたダメージの${pctNowLabel(ratio)}を基礎に回復する。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.01)
          )}`,
        ];
      },
      afterPlayerDeal(ctx, level, hit) {
        if (!hit || hit.dmg <= 0) return;
        const healed = ctx.heal(ctx.player, hit.dmg * scaled(0.12, 0.01, level));
        if (healed.got > 0) {
          ctx.log(`血吸印。${healed.got}回復した。${ctx.overNote(healed.over)}`, "heal");
        }
      },
    },
    {
      id: "ambush",
      name: "奇襲",
      group: "攻撃",
      blurb: "戦闘序盤に強い。長引くと弱い。",
      tradeoff: "開幕寄り。終盤専用の手順には向かない。",
      cooldown: 2,
      gain: gain({ maxHp: 2, atk: 3, speed: 5 }),
      describe(level, stats) {
        return [
          `自分の行動が4回目までなら${atkMult(scaled(1.78, 0.06, level), stats)}。`,
          `それ以降は${atkMult(scaled(0.95, 0.025, level), stats)}。`,
          dualMultGrowth(1.78, 0.06, 0.95, 0.025, level),
        ];
      },
      use(ctx, level) {
        const early = ctx.player.actionCount <= 4;
        const mult = early ? scaled(1.78, 0.06, level) : scaled(0.95, 0.025, level);
        const r = ctx.damage(mult);
        ctx.log(`${ctx.p}奇襲。${early ? "先手を取り、" : "時機を逸し、"}${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "reprise",
      name: "返し刃",
      group: "攻撃",
      blurb: "直前にダメージを受けていれば強い。",
      tradeoff: "無傷だと弱い。",
      cooldown: 2,
      gain: gain({ maxHp: 3, atk: 2, def: 2 }),
      describe(level, stats) {
        return [
          `直前にダメージを受けていれば${atkMult(scaled(1.75, 0.06, level), stats)}。`,
          `受けていなければ${atkMult(scaled(0.72, 0.02, level), stats)}。`,
          dualMultGrowth(1.75, 0.06, 0.72, 0.02, level),
        ];
      },
      use(ctx, level) {
        const hit = ctx.sawHit;
        const mult = hit ? scaled(1.75, 0.06, level) : scaled(0.72, 0.02, level);
        const r = ctx.damage(mult);
        ctx.log(`${ctx.p}返し刃。${hit ? "反撃し、" : "空振りに近く、"}${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "overpower",
      name: "圧倒",
      group: "攻撃",
      blurb: "自分の攻撃が敵の防御を上回るとき強い。",
      tradeoff: "硬い相手には破城や貫打に負ける。",
      cooldown: 2,
      gain: gain({ maxHp: 2, atk: 4, atkEff: 0.02 }),
      describe(level, stats) {
        return [
          `自分の攻撃が敵の防御より高ければ${atkMult(scaled(1.6, 0.05, level), stats)}。`,
          `そうでなければ${atkMult(scaled(0.85, 0.02, level), stats)}。`,
          dualMultGrowth(1.6, 0.05, 0.85, 0.02, level),
        ];
      },
      use(ctx, level) {
        const win = ctx.effectiveAtk(ctx.player) > ctx.effectiveDef(ctx.enemy);
        const mult = win ? scaled(1.6, 0.05, level) : scaled(0.85, 0.02, level);
        const r = ctx.damage(mult);
        ctx.log(`${ctx.p}圧倒。${win ? "押し切り、" : "弾かれ、"}${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "rift",
      name: "裂甲",
      group: "崩し",
      blurb: "崩甲より深く防御を裂く。攻撃はしない。",
      tradeoff: "単体では削れない。後続と組む前提。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 1, def: 2, atkEff: 0.02 }),
      describe(level) {
        const down = scaled(0.44, 0.025, level);
        const next = scaled(0.44, 0.025, level + 1);
        return [
          `敵の防御力を${pctNowLabel(down)}下げる（敵の5行動）。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.025)
          )}`,
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.enemy, {
          id: "rift",
          kind: "defPct",
          value: -scaled(0.44, 0.025, level),
          turns: 5,
          negative: true,
        });
        ctx.log(`${ctx.p}裂甲。${ctx.enemy.name}の防御を大きく下げた。`, "buff");
      },
    },
    {
      id: "plague",
      name: "疫刃",
      group: "崩し",
      blurb: "毒刃より長い毒。即時の一撃はない。",
      tradeoff: "短期決戦ではほぼ役に立たない。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 2, speed: 2, healEff: -0.02 }),
      describe(level, stats) {
        const ratio = scaled(0.42, 0.025, level);
        const next = scaled(0.42, 0.025, level + 1);
        return [
          `8行動のあいだ、行動ごとに付与時の攻撃力で${atkMult(ratio, stats)}相当（発生時の防御・軽減で減衰）。${growthTail(
            `×${next.toFixed(2)}`,
            "0.025"
          )}`,
          "即時ダメージはない。打ち直すと残りが更新される。",
        ];
      },
      use(ctx, level) {
        const offense = ctx.snapshotOffense({ consumeAmp: false });
        ctx.addEffect(ctx.enemy, {
          id: "plague",
          kind: "dot",
          mult: scaled(0.42, 0.025, level),
          offense,
          turns: 8,
          negative: true,
        });
        ctx.log(`${ctx.p}疫刃。${ctx.enemy.name}に長い毒が回る。`, "buff");
      },
    },
    {
      id: "sap",
      name: "削気",
      group: "崩し",
      blurb: "敵の攻撃力を大きく下げる。攻撃はしない。",
      tradeoff: "その行動では削らない。刺客・耐久向き。",
      cooldown: 3,
      gain: gain({ maxHp: 5, def: 3, defEff: 0.03 }),
      describe(level) {
        const down = scaled(0.36, 0.025, level);
        const next = scaled(0.36, 0.025, level + 1);
        return [
          `敵の攻撃力を${pctNowLabel(down)}下げる（敵の5行動）。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.025)
          )}`,
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.enemy, {
          id: "sap",
          kind: "atkPct",
          value: -scaled(0.36, 0.025, level),
          turns: 5,
          negative: true,
        });
        ctx.log(`${ctx.p}削気。${ctx.enemy.name}の攻撃力を下げた。`, "buff");
      },
    },
    {
      id: "expose",
      name: "露呈",
      group: "崩し",
      blurb: "敵の被ダメージ軽減を引き剥がす。攻撃はしない。",
      tradeoff: "軽減がない相手には効果が薄い。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 2, dmgBonus: 0.01 }),
      describe(level) {
        const down = scaled(0.28, 0.02, level);
        const next = scaled(0.28, 0.02, level + 1);
        return [
          `敵の被ダメージ軽減を${pctNowLabel(down)}下げる（敵の5行動）。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.02)
          )}`,
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.enemy, {
          id: "expose",
          kind: "dr",
          value: -scaled(0.28, 0.02, level),
          turns: 5,
          negative: true,
        });
        ctx.log(`${ctx.p}露呈。${ctx.enemy.name}の守りを開いた。`, "buff");
      },
    },
    {
      id: "silence",
      name: "封痕",
      group: "崩し",
      blurb: "最初の自動回復を潰し、再生する敵へ短い封印を刻む。",
      tradeoff: "再生しない相手にはほぼ効かない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 6, atk: 2, regenAmount: 2 }),
      describe(level) {
        const turns = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        const next = Math.max(1, Math.floor(scaled(1, 0.35, level + 1)));
        return [
          "戦闘中、敵の自動回復の最初の1回を封じる。",
          `その後、自動回復持ちの敵への攻撃命中で、短い自動回復封じ（敵の${turns}行動）を付与する。${growthTail(
            `${next}行動`,
            "0.35切捨"
          )}`,
        ];
      },
      beforeEnemyRegen(ctx, level, unit) {
        const mem = ctx.player.passiveMem;
        if (mem.silenceBlocked) return false;
        mem.silenceBlocked = true;
        ctx.log(`封痕。${unit.name}の最初の自動回復を封じた。`, "buff");
        return true;
      },
      afterPlayerDeal(ctx, level, hit) {
        if (!hit || hit.dmg <= 0) return;
        if ((ctx.enemy.regenAmount || 0) <= 0) return;
        const turns = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        const existing = ctx.findEffectById(ctx.enemy, "silence");
        ctx.addEffect(ctx.enemy, {
          id: "silence",
          kind: "noRegen",
          value: 1,
          turns,
          negative: true,
        });
        if (!existing) {
          ctx.log(`封痕。${ctx.enemy.name}の自動回復に短い傷を刻んだ。`, "buff");
        }
      },
    },
    {
      id: "mark",
      name: "印継",
      group: "崩し",
      blurb: "最初の攻撃技で印を刻み、次の一撃で爆発させる。",
      tradeoff: "戦闘中に印の付与は一度きり。単発では伸びない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 4, atk: 4, speed: 3 }),
      describe(level, stats) {
        return [
          "戦闘中、攻撃グループの技で初めて命中したとき、敵に印を刻む。",
          `印のある敵への次の攻撃命中で追加ダメージ（${atkMult(scaled(0.45, 0.03, level), stats)}）を与え、印を消費する。`,
          growthTail(`追撃×${scaled(0.45, 0.03, level + 1).toFixed(2)}`, "0.03"),
        ];
      },
      afterPlayerDeal(ctx, level, hit) {
        if (!hit || hit.dmg <= 0 || ctx.enemy.hp <= 0) return;
        const mem = ctx.player.passiveMem;
        const marked = ctx.findEffectById(ctx.enemy, "mark-passive");
        if (marked) {
          ctx.enemy.effects = ctx.enemy.effects.filter((e) => e !== marked);
          const r = ctx.damage(scaled(0.45, 0.03, level), { amp: false, fromPassive: true });
          ctx.log(`印継。印が弾け、${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
          return;
        }
        const casting = ctx._castingSkill;
        if (casting && casting.group === "攻撃" && !mem.markOnce) {
          mem.markOnce = true;
          ctx.addEffect(ctx.enemy, {
            id: "mark-passive",
            kind: "marked",
            value: 1,
            turns: 8,
            negative: true,
          });
          ctx.log(`印継。${ctx.enemy.name}に印を刻んだ。`, "buff");
        }
      },
    },
    {
      id: "bulwark",
      name: "防壁",
      group: "守り",
      blurb: "鉄身より短いが、上昇幅は大きい。",
      tradeoff: "攻撃しない。",
      cooldown: 3,
      gain: gain({ maxHp: 6, def: 5, defEff: 0.02 }),
      describe(level, stats) {
        return [`次の3行動、${defBuffText(0.7, 0.03, level, stats)}`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "bulwark",
          kind: "defPct",
          value: scaled(0.7, 0.03, level),
          turns: 3,
          scale: "def",
        });
        ctx.log(`${ctx.p}防壁。短いあいだ、防御力が大きく上がった。`, "buff");
      },
    },
    {
      id: "aegis",
      name: "聖壁",
      group: "守り",
      blurb: "堅守より長い割合軽減。攻撃力は下がる。",
      tradeoff: "火力が落ちる。",
      cooldown: 4,
      gain: gain({ maxHp: 5, atk: -2, def: 4, dmgReduction: 0.015 }),
      describe(level, stats) {
        return [`次の4行動、${drText(0.32, 0.018, level)}`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "aegis",
          kind: "dr",
          value: scaled(0.32, 0.018, level),
          turns: 4,
        });
        ctx.log(`${ctx.p}聖壁。打撃をいなす壁を張った。`, "buff");
      },
    },
    {
      id: "mirror",
      name: "鏡応",
      group: "守り",
      blurb: "受けた打撃の三つに一度、一部が跳ね返る。",
      tradeoff: "毎回は返らない。軽減そのものはない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 7, def: 5, speed: 2 }),
      describe(level) {
        const ratio = scaled(0.28, 0.02, level);
        const next = scaled(0.28, 0.02, level + 1);
        return [
          `被弾3回ごとに、その打撃の${pctNowLabel(ratio)}を相手へ返す。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.02)
          )}`,
        ];
      },
      afterPlayerTake(ctx, level, hit) {
        if (!hit || hit.dmg <= 0 || ctx.enemy.hp <= 0) return;
        const mem = ctx.player.passiveMem;
        mem.mirrorHits = (mem.mirrorHits || 0) + 1;
        if (mem.mirrorHits % 3 !== 0) return;
        const back = Math.max(1, Math.floor(hit.dmg * scaled(0.28, 0.02, level)));
        const hurt = ctx.hurt(ctx.enemy, back, "mirror");
        if (hurt.dealt > 0) {
          ctx.log(`鏡応。打撃が跳ね返り、${ctx.enemy.name}に${hurt.dealt}のダメージ。${ctx.overNote(hurt.over)}`, "attack");
        }
      },
    },
    {
      id: "endure",
      name: "耐忍",
      group: "守り",
      blurb: "体力が少ないときだけ使える短い軽減。",
      tradeoff: "余裕があるときは飛ばされる。",
      cooldown: 3,
      gain: gain({ maxHp: 8, def: 2, defEff: 0.03 }),
      available(ctx) {
        return ctx.player.hp / ctx.player.maxHp <= 0.45;
      },
      describe(level, stats) {
        return [
          `体力が45%以下のときだけ使える。次の2行動、${drText(0.35, 0.02, level)}`,
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "endure",
          kind: "dr",
          value: scaled(0.35, 0.02, level),
          turns: 2,
        });
        ctx.log(`${ctx.p}耐忍。死線で体を固めた。`, "buff");
      },
    },
    {
      id: "secondwind",
      name: "息継",
      group: "回復",
      blurb: "体力が尽きかけたとき、一度だけ大きく息を継ぐ。",
      tradeoff: "戦闘中に一度きり。早めに落とされると間に合わない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 10, healEff: 0.035, regenAmount: 1 }),
      describe(level, stats) {
        return [
          "戦闘中、体力が最大の35%以下へ落ちた最初の瞬間に一度だけ発動する。",
          healPctText(0.14, 0.008, level, stats),
        ];
      },
      afterPlayerTake(ctx, level, hit) {
        if (!hit || hit.dmg <= 0) return;
        const mem = ctx.player.passiveMem;
        if (mem.secondwindTriggered) return;
        const max = ctx.player.maxHp;
        const now = ctx.player.hp;
        const before = now + hit.dmg;
        if (before / max > 0.35 && now / max <= 0.35) {
          mem.secondwindTriggered = true;
          const healed = ctx.heal(ctx.player, ctx.player.maxHp * scaled(0.14, 0.008, level));
          ctx.log(`息継。体力が${healed.got}回復した。${ctx.overNote(healed.over)}`, "heal");
        }
      },
    },
    {
      id: "warcry",
      name: "戦吼",
      group: "補助",
      blurb: "鼓舞より短い攻撃上昇。",
      tradeoff: "持続が短い。",
      cooldown: 2,
      gain: gain({ maxHp: 2, atk: 2, atkEff: 0.02 }),
      describe(level, stats) {
        return [`次の2行動、${atkBuffText(0.3, 0.02, level, stats)}`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "warcry",
          kind: "atkPct",
          value: scaled(0.3, 0.02, level),
          turns: 2,
          scale: "atk",
        });
        ctx.log(`${ctx.p}戦吼。攻撃力が短く上がった。`, "buff");
      },
    },
    {
      id: "keen",
      name: "余刃",
      group: "補助",
      blurb: "攻撃技のあと、次の一撃に切れ味が残る。",
      tradeoff: "攻撃技以外では貯まらない。通常攻撃にも乗る。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 4, atk: 4, atkEff: 0.05 }),
      describe(level, stats) {
        return [
          "攻撃グループの技を使ったあと、次に出す攻撃技の威力上乗せが乗る（通常攻撃では消費しない）。",
          ampText(0.28, 0.025, level, stats),
        ];
      },
      afterPlayerSkill(ctx, level, skill) {
        if (!skill || skill.group !== "攻撃") return;
        ctx.addEffect(ctx.player, {
          id: "keen",
          kind: "skillAmp",
          value: scaled(0.28, 0.025, level),
          turns: null,
        });
        ctx.log(`余刃。次の攻撃技に切れ味が残った。`, "buff");
      },
    },
    {
      id: "tempo",
      name: "拍子",
      group: "補助",
      blurb: "短い拍で待ちを進め、直後に撃つ技の再使用も軽くする。",
      tradeoff: "加速より持続は短い。待ちが空いていると即時短縮の恩恵は薄い。",
      cooldown: 2,
      gain: gain({ maxHp: 3, speed: 10, atk: 2, atkEff: 0.03 }),
      describe(level, stats) {
        const instant = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        const nextInstant = Math.max(1, Math.floor(scaled(1, 0.35, level + 1)));
        const haste = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        const nextHaste = Math.max(1, Math.floor(scaled(1, 0.35, level + 1)));
        const turns = Math.max(3, Math.floor(scaled(3, 0.5, level)));
        const nextTurns = Math.max(3, Math.floor(scaled(3, 0.5, level + 1)));
        const kick = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        const nextKick = Math.max(1, Math.floor(scaled(1, 0.35, level + 1)));
        return [
          `使用時、他の技の待ちを${instant}進める。${growthTail(`${nextInstant}`, "0.35切捨")}`,
          `その後${turns}行動、待ちが「1」ではなく「${1 + haste}」進む。${growthTail(
            `待ち+${nextHaste}／${nextTurns}行動`,
            "0.35／0.5切捨"
          )}`,
          `効果中に撃った技は、再使用の空きが最初から${kick}少ない。${growthTail(
            `${nextKick}`,
            "0.35切捨"
          )}`,
        ];
      },
      use(ctx, level) {
        const instant = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        const haste = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        const turns = Math.max(3, Math.floor(scaled(3, 0.5, level)));
        const kick = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        const advanced = ctx.advanceCds(ctx.player, instant, "tempo");
        ctx.addEffect(ctx.player, {
          id: "tempo",
          kind: "cdHaste",
          value: haste,
          turns,
        });
        ctx.addEffect(ctx.player, {
          id: "tempo-kick",
          kind: "cdKick",
          value: kick,
          turns,
        });
        ctx.log(
          `${ctx.p}拍子。${
            advanced > 0 ? `待ちを${instant}進め、` : ""
          }次に撃つ技の再使用も軽くなった。`,
          "buff"
        );
      },
    },
    {
      id: "latebloom",
      name: "晩成",
      group: "攻撃",
      blurb: "初期は弱いが、重ねるほど威力が伸びる大器晩成の一撃。",
      tradeoff: "1枚目は通常攻撃以下。4枚付近で同系統の斬撃4重に匹敵する。",
      cooldown: 2,
      gain: gain({ maxHp: 10, atk: 6, def: 2, atkEff: 0.02 }),
      describe(level, stats) {
        return [
          multText(0.55, 0.55, level, stats),
          "初期値は低い。4枚前後で同系統の斬撃を4枚重ねた水準に届く想定（再使用の長さも織り込み）。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.55, 0.55, level));
        ctx.log(`${ctx.p}晩成。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "apexblow",
      name: "極撃",
      group: "攻撃",
      blurb: "初期は控えめな大技。重複で頂点が跳ね上がる。",
      tradeoff: "間隔が長い。低レベルでは強打に負ける。4枚付近で強打4重に匹敵。",
      cooldown: 4,
      gain: gain({ maxHp: 8, atk: 7, atkEff: 0.04, dmgBonus: 0.01 }),
      describe(level, stats) {
        return [
          multText(0.9, 0.55, level, stats),
          "再使用は遅い。4枚前後で同系統の強打を4枚重ねた水準に届く想定。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.9, 0.55, level));
        ctx.log(`${ctx.p}極撃。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "stackmight",
      name: "積威",
      group: "補助",
      blurb: "弱い攻撃バフから始まり、重ねるほど厚くなる。",
      tradeoff: "1枚目の上昇は薄い。4枚付近で鼓舞4重に匹敵する。",
      cooldown: 3,
      gain: gain({ maxHp: 5, atk: 5, atkEff: 0.07, speed: 1 }),
      describe(level, stats) {
        return [
          `次の4行動、${atkBuffText(0.1, 0.12, level, stats)}`,
          "初期の上昇は小さい。4枚前後で同系統の鼓舞を4枚重ねた水準に届く想定。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "stackmight",
          kind: "atkPct",
          value: scaled(0.1, 0.12, level),
          turns: 4,
          scale: "atk",
        });
        ctx.log(`${ctx.p}積威。攻撃力がわずかに、しかし着実に上がった。`, "buff");
      },
    },
    {
      id: "temper",
      name: "錬鋭",
      group: "補助",
      blurb: "次の攻撃技への上乗せは最初は薄い。重複で鋭くなる。",
      tradeoff: "集中より初手は弱い。4枚付近で集中4重に匹敵する。",
      cooldown: 2,
      gain: gain({ maxHp: 4, atk: 4, atkEff: 0.09, def: 1 }),
      describe(level, stats) {
        return [
          ampText(0.15, 0.23, level, stats),
          "通常攻撃では消費しない。4枚前後で同系統の集中を4枚重ねた水準に届く想定。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "temper",
          kind: "skillAmp",
          value: scaled(0.15, 0.23, level),
          turns: null,
        });
        ctx.log(`${ctx.p}錬鋭。次の攻撃技へ、薄い刃を重ねた。`, "buff");
      },
    },
    {
      id: "thickshield",
      name: "厚盾",
      group: "守り",
      blurb: "初期の防御上昇は薄いが、重ねると鉄壁になる。",
      tradeoff: "攻撃しない。低レベルでは鉄身に劣る。4枚付近で鉄身4重に匹敵。",
      cooldown: 3,
      gain: gain({ maxHp: 14, def: 7, defEff: 0.05, atk: -1 }),
      describe(level, stats) {
        return [
          `次の4行動、${defBuffText(0.14, 0.17, level, stats)}`,
          "この行動では攻撃しない。4枚前後で同系統の鉄身を4枚重ねた水準に届く想定。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "thickshield",
          kind: "defPct",
          value: scaled(0.14, 0.17, level),
          turns: 4,
          scale: "def",
        });
        ctx.log(`${ctx.p}厚盾。盾が少し厚くなった。`, "buff");
      },
    },
    {
      id: "spring",
      name: "泉湧",
      group: "回復",
      blurb: "しばらく自動回復量を底上げする。即時回復はない。",
      tradeoff: "戦闘が短いと間に合わない。",
      cooldown: 5,
      gain: gain({ maxHp: 7, regenAmount: 3, healEff: 0.01 }),
      describe(level, stats) {
        const extra = scaled(4, 1.5, level);
        const next = scaled(4, 1.5, level + 1);
        return [
          `次の4行動、自動回復量+${extra.toFixed(1)}。${growthTail(`+${next.toFixed(1)}`, "1.5")}`,
          "即時回復はない。自動回復量そのものも習得で伸びる。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "spring",
          kind: "regenFlat",
          value: scaled(4, 1.5, level),
          turns: 4,
        });
        ctx.log(`${ctx.p}泉湧。自動回復が厚くなり始めた。`, "heal");
      },
    },
    {
      id: "quickpulse",
      name: "速脈",
      group: "補助",
      blurb: "自動回復の間隔を一時的に短くする。",
      tradeoff: "回復量そのものは増やさない。量がないと効果は薄い。",
      cooldown: 4,
      gain: gain({ maxHp: 5, regenInterval: -1, regenAmount: 1, speed: 2, atk: -1 }),
      describe(level, stats) {
        const cut = Math.min(2, Math.floor(scaled(1, 0.25, level)));
        const nextCut = Math.min(2, Math.floor(scaled(1, 0.25, level + 1)));
        const every = stats ? Math.max(1, (stats.regenInterval || 4) - cut) : null;
        return [
          `次の4行動、自動回復までの必要行動が${cut}回分短くなる${
            every != null ? `（今なら${every}行動ごと）` : ""
          }。`,
          `次の強化で短縮${nextCut}回（段階+0.25、表示は切り捨て、上限2回）。`,
          "短縮は下限1行動まで。自動回復量が0だと意味が薄い。",
        ];
      },
      use(ctx, level) {
        const cut = Math.min(2, Math.floor(scaled(1, 0.25, level)));
        ctx.addEffect(ctx.player, {
          id: "quickpulse",
          kind: "regenHaste",
          value: cut,
          turns: 4,
        });
        ctx.log(`${ctx.p}速脈。傷の塞がりが早くなる。`, "buff");
      },
    },
    {
      id: "lifeblood",
      name: "生命刃",
      group: "攻撃",
      blurb: "自動回復量が高いほど通る一撃。",
      tradeoff: "回復を捨てた構成では弱い。",
      cooldown: 2,
      gain: gain({ maxHp: 6, regenAmount: 2, atk: 2, healEff: 0.01 }),
      describe(level, stats) {
        const base = scaled(0.62, 0.03, level);
        const per = scaled(0.035, 0.008, level);
        const regen = stats ? Math.max(0, stats.regenAmount || 0) : 0;
        const now = base + regen * per;
        const nextBase = scaled(0.62, 0.03, level + 1);
        const nextPer = scaled(0.035, 0.008, level + 1);
        return [
          `基礎は${atkMult(base, stats)}。自動回復量1ごとに威力+${per.toFixed(3)}。`,
          stats
            ? `今の自動回復量${regen}なら${atkMult(now, stats)}。`
            : "自動回復量に応じて威力が上乗せされる。",
          growthTail(
            `基礎×${nextBase.toFixed(2)}／+${nextPer.toFixed(3)}毎`,
            `0.03／0.008`
          ),
        ];
      },
      use(ctx, level) {
        const base = scaled(0.62, 0.03, level);
        const per = scaled(0.035, 0.008, level);
        const mult = base + Math.max(0, ctx.player.regenAmount || 0) * per;
        const r = ctx.damage(mult);
        ctx.log(`${ctx.p}生命刃。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "revitalize",
      name: "回春",
      group: "回復",
      blurb: "自動回復量を基礎に、すぐ戻してから脈を残す。",
      tradeoff: "自動回復量が低いとほぼ効かない。",
      cooldown: 5,
      gain: gain({ maxHp: 6, regenAmount: 3, healEff: 0.02, regenInterval: -1 }),
      describe(level, stats) {
        const mult = scaled(1.1, 0.2, level);
        const next = scaled(1.1, 0.2, level + 1);
        const flat = scaled(2, 0.8, level);
        const nextFlat = scaled(2, 0.8, level + 1);
        const regen = stats ? Math.max(0, stats.regenAmount || 0) : 0;
        const expect = stats ? Math.floor(regen * mult * (stats.healEff || 1)) : null;
        return [
          `自動回復量×${mult.toFixed(2)}を基礎にすぐ回復する${
            expect != null ? `（今なら約${expect}）` : ""
          }。${growthTail(`×${next.toFixed(2)}`, "0.20")}`,
          `その後3行動、自動回復量+${flat.toFixed(1)}。${growthTail(
            `+${nextFlat.toFixed(1)}`,
            "0.8"
          )}`,
        ];
      },
      use(ctx, level) {
        const mult = scaled(1.1, 0.2, level);
        const healed = ctx.heal(ctx.player, Math.max(0, ctx.player.regenAmount) * mult);
        ctx.addEffect(ctx.player, {
          id: "revitalize",
          kind: "regenFlat",
          value: scaled(2, 0.8, level),
          turns: 3,
        });
        ctx.log(
          `${ctx.p}回春。体力が${healed.got}回復した。${ctx.overNote(healed.over)}自動回復が続く。`,
          "heal"
        );
      },
    },
    {
      id: "cycle",
      name: "循環",
      group: "補助",
      blurb: "自動回復量に応じて、短い攻撃上昇を得る。",
      tradeoff: "回復量が少ないとバフが薄い。ダメージはない。",
      cooldown: 3,
      gain: gain({ maxHp: 5, regenAmount: 2, atkEff: 0.04, atk: 1, speed: 1 }),
      describe(level, stats) {
        const per = scaled(0.018, 0.005, level);
        const nextPer = scaled(0.018, 0.005, level + 1);
        const regen = stats ? Math.max(0, stats.regenAmount || 0) : 0;
        const rate = Math.min(0.65, regen * per);
        const flat =
          stats && rate > 0
            ? Math.floor(Math.max(1, stats.atk) * rate * (stats.atkEff || 1))
            : null;
        return [
          `次の3行動、自動回復量×${per.toFixed(3)}分の攻撃力上昇（上限65%、攻撃力補助効率も乗る）${
            flat != null ? `。今なら+${pctNowLabel(rate)}(+${flat})` : ""
          }。`,
          growthTail(`係数${nextPer.toFixed(3)}`, "0.005"),
          "この行動では攻撃しない。",
        ];
      },
      use(ctx, level) {
        const per = scaled(0.018, 0.005, level);
        const rate = Math.min(0.65, Math.max(0, ctx.player.regenAmount || 0) * per);
        if (rate > 0) {
          ctx.addEffect(ctx.player, {
            id: "cycle",
            kind: "atkPct",
            value: rate,
            turns: 3,
            scale: "atk",
          });
        }
        ctx.log(
          `${ctx.p}循環。${rate > 0 ? "回復の勢いが刃へ回った。" : "回す勢いが足りなかった。"}`,
          "buff"
        );
      },
    },
    {
      id: "corrodeheal",
      name: "蝕癒",
      group: "崩し",
      blurb: "回復の効きそのものを腐らせる。再生型へのメタ。",
      tradeoff: "回復しない相手には効果が薄い。即時ダメージはない。",
      cooldown: 3,
      gain: gain({ maxHp: 4, atk: 1, def: 2, regenAmount: 1 }),
      describe(level) {
        const down = scaled(0.34, 0.045, level);
        const next = scaled(0.34, 0.045, level + 1);
        return [
          `敵の回復効率を${pctNowLabel(down)}下げる（敵の5行動）。即時・自動・再生すべてに掛かる。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.045)
          )}`,
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.enemy, {
          id: "corrodeheal",
          kind: "healDown",
          value: Math.min(0.85, scaled(0.34, 0.045, level)),
          turns: 5,
          negative: true,
        });
        ctx.log(`${ctx.p}蝕癒。${ctx.enemy.name}の回復の効きを腐らせた。`, "buff");
      },
    },
    {
      id: "drytide",
      name: "干潟",
      group: "崩し",
      blurb: "長く自動回復を封じる。枯渇より間が長い。",
      tradeoff: "即時ダメージはない。再生しない相手には過剰。",
      cooldown: 4,
      gain: gain({ maxHp: 5, atk: 1, def: 2, regenAmount: 1 }),
      describe(level) {
        return [
          "敵の自動回復を、敵の7行動のあいだ止める。",
          "継続回復そのものは消さない。止めたあいだだけ働かない。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.enemy, {
          id: "drytide",
          kind: "noRegen",
          value: 1,
          turns: 7,
          negative: true,
        });
        ctx.log(`${ctx.p}干潟。${ctx.enemy.name}の泉を干した。`, "buff");
      },
    },
    {
      id: "backlash",
      name: "逆療",
      group: "攻撃",
      blurb: "敵の自動回復量が高いほど通る。再生型への直撃。",
      tradeoff: "回復しない相手にはただの弱い攻撃。",
      cooldown: 2,
      gain: gain({ maxHp: 3, atk: 3, speed: 2, dmgBonus: 0.005 }),
      describe(level, stats) {
        const base = scaled(0.7, 0.03, level);
        const per = scaled(0.045, 0.01, level);
        const nextBase = scaled(0.7, 0.03, level + 1);
        const nextPer = scaled(0.045, 0.01, level + 1);
        return [
          `基礎は${atkMult(base, stats)}。敵の自動回復量1ごとに威力+${per.toFixed(3)}。`,
          "再生する敵ほど重い。回復量0なら基礎のみ。",
          growthTail(`基礎×${nextBase.toFixed(2)}／+${nextPer.toFixed(3)}毎`, `0.03／0.01`),
        ];
      },
      use(ctx, level) {
        const base = scaled(0.7, 0.03, level);
        const per = scaled(0.045, 0.01, level);
        const mult = base + Math.max(0, ctx.enemy.regenAmount || 0) * per;
        const r = ctx.damage(mult);
        ctx.log(`${ctx.p}逆療。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    {
      id: "stealpulse",
      name: "奪脈",
      group: "崩し",
      blurb: "敵の自動回復量を削り、自分の脈へ回す。攻撃はしない。",
      tradeoff: "削る量は固定寄り。回復しない相手には効果が薄い。",
      cooldown: 3,
      gain: gain({ maxHp: 5, atk: 1, regenAmount: 2, healEff: 0.015 }),
      describe(level) {
        const sap = Math.max(1, Math.floor(scaled(5.5, 1.5, level)));
        const nextSap = Math.max(1, Math.floor(scaled(5.5, 1.5, level + 1)));
        const selfFlat = scaled(3, 1, level);
        const nextFlat = scaled(3, 1, level + 1);
        return [
          `敵の自動回復量を${sap}削る（敵の5行動）。下限0。${growthTail(`${nextSap}`, "1.5")}`,
          `次の4行動、自分の自動回復量+${selfFlat.toFixed(1)}。${growthTail(`+${nextFlat.toFixed(1)}`, "1")}`,
        ];
      },
      use(ctx, level) {
        const sap = Math.max(1, Math.floor(scaled(5.5, 1.5, level)));
        ctx.addEffect(ctx.enemy, {
          id: "stealpulse",
          kind: "regenSap",
          value: sap,
          turns: 5,
          negative: true,
        });
        ctx.addEffect(ctx.player, {
          id: "stealpulse-self",
          kind: "regenFlat",
          value: scaled(3, 1, level),
          turns: 4,
        });
        ctx.log(`${ctx.p}奪脈。${ctx.enemy.name}から脈を奪った。`, "buff");
      },
    },
    {
      id: "healpunish",
      name: "癒罰",
      group: "攻撃",
      blurb: "回復するたびに罰が乗る呪いの一撃。",
      tradeoff: "回復しない相手には呪いは空振り。素の火力も控えめ。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 2, def: 1, dmgBonus: 0.006 }),
      describe(level, stats) {
        const ratio = scaled(0.55, 0.05, level);
        const next = scaled(0.55, 0.05, level + 1);
        return [
          multText(0.8, 0.035, level, stats),
          `敵が回復した量の${pctNowLabel(ratio)}を、その場でダメージに返す呪い（敵の5行動）。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.05)
          )}`,
          "自動回復・継続回復・その他の回復すべてに掛かる。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.8, 0.035, level));
        ctx.addEffect(ctx.enemy, {
          id: "healpunish",
          kind: "healPunish",
          value: Math.min(1.2, scaled(0.55, 0.05, level)),
          turns: 5,
          negative: true,
        });
        ctx.log(
          `${ctx.p}癒罰。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}回復に罰を刻んだ。`,
          "attack"
        );
      },
    },
    {
      id: "underdog",
      name: "劣勢",
      group: "攻撃",
      blurb: "自分の体力割合が相手以下のとき強い。",
      tradeoff: "体力割合で負けている（または互角の）とき限定。勝ち越していると弱い。",
      cooldown: 2,
      gain: gain({ maxHp: 4, atk: 3, speed: 2 }),
      describe(level, stats) {
        const even = scaled(0.7, 0.03, level);
        const behind = scaled(1.75, 0.07, level);
        return [
          `自分の体力割合が相手以下なら${atkMult(behind, stats)}。`,
          `相手より高いときは${atkMult(even, stats)}。`,
          dualMultGrowth(1.75, 0.07, 0.7, 0.03, level),
        ];
      },
      use(ctx, level) {
        const pRate = ctx.player.hp / ctx.player.maxHp;
        const eRate = ctx.enemy.hp / ctx.enemy.maxHp;
        const behind = pRate <= eRate;
        const mult = behind ? scaled(1.75, 0.07, level) : scaled(0.7, 0.03, level);
        const r = ctx.damage(mult);
        ctx.log(
          `${ctx.p}劣勢。${behind ? "追い詰められながら" : "余裕がありすぎて"}${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
      },
    },
    {
      id: "overbear",
      name: "圧潰",
      group: "攻撃",
      blurb: "自分の体力割合が相手より高いほど通る。",
      tradeoff: "自分が削られていると弱い。守りと組む前提。",
      cooldown: 2,
      gain: gain({ maxHp: 5, atk: 2, def: 2 }),
      describe(level, stats) {
        const lead = scaled(1.7, 0.065, level);
        const trail = scaled(0.68, 0.025, level);
        return [
          `自分の体力割合が相手より高いとき${atkMult(lead, stats)}。`,
          `相手以下（互角を含む）のときは${atkMult(trail, stats)}。`,
          dualMultGrowth(1.7, 0.065, 0.68, 0.025, level),
        ];
      },
      use(ctx, level) {
        const pRate = ctx.player.hp / ctx.player.maxHp;
        const eRate = ctx.enemy.hp / ctx.enemy.maxHp;
        const ahead = pRate > eRate;
        const mult = ahead ? scaled(1.7, 0.065, level) : scaled(0.68, 0.025, level);
        const r = ctx.damage(mult);
        ctx.log(
          `${ctx.p}圧潰。${ahead ? "余力で押し潰し、" : "余力がなく、"}${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
      },
    },
    {
      id: "standoff",
      name: "拮抗牙",
      group: "攻撃",
      blurb: "互いの体力割合が近いとき、打撃のあとに牙が追う。",
      tradeoff: "差が開くと追撃は出ない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 5, atk: 4, atkEff: 0.035, speed: 2 }),
      describe(level, stats) {
        return [
          "自分と敵の体力割合の差が18%以内のとき、命中のあとに追撃が入る。",
          multText(0.28, 0.02, level, stats),
        ];
      },
      afterPlayerDeal(ctx, level, hit) {
        if (!hit || hit.dmg <= 0 || ctx.enemy.hp <= 0) return;
        const pRate = ctx.player.hp / ctx.player.maxHp;
        const eRate = ctx.enemy.hp / ctx.enemy.maxHp;
        if (Math.abs(pRate - eRate) > 0.18) return;
        const r = ctx.damage(scaled(0.28, 0.02, level), { amp: false, fromPassive: true });
        ctx.log(`拮抗牙。互角の隙を噛み、${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
      },
    },
    // ---- 革新的ユニーク10種 ----
    {
      id: "echo",
      name: "残響",
      group: "攻撃",
      blurb: "一撃を残し、次の残響で重ねて爆発させる。積み重ねるほど主役になる。",
      tradeoff: "単発では普通。残響を貯めない手順では伸びない。",
      cooldown: 3,
      gain: gain({ maxHp: 4, atk: 4, atkEff: 0.03, dmgBonus: 0.008 }),
      describe(level, stats) {
        const base = scaled(0.95, 0.04, level);
        const store = scaled(0.55, 0.06, level);
        const nextStore = scaled(0.55, 0.06, level + 1);
        return [
          `威力は${atkMult(base, stats)}。与えたダメージの${pctNowLabel(store)}を残響として記憶する。`,
          "残響が残っているときにもう一度使うと、記憶した分を上乗せして放ち、新たに記憶し直す。",
          growthTail(`記憶${pctNowLabel(nextStore)}`, pctStepLabel(0.06)),
        ];
      },
      use(ctx, level) {
        const base = scaled(0.95, 0.04, level);
        const storeRate = scaled(0.55, 0.06, level);
        const prev = ctx.findEffect(ctx.player, "echo");
        const bonus = prev ? Math.max(0, Math.floor(prev.value || 0)) : 0;
        const r = ctx.damage(base);
        const total = r.dmg + bonus;
        if (bonus > 0) {
          const hurt = ctx.hurt(ctx.enemy, bonus, "echo");
          ctx.log(
            `${ctx.p}残響。本撃${r.dmg}に残響${hurt.dealt}が重なり、合計${r.dmg + hurt.dealt}。${ctx.overNote(r.over + hurt.over)}`,
            "attack"
          );
        } else {
          ctx.log(
            `${ctx.p}残響。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}響きを残した。`,
            "attack"
          );
        }
        const stored = Math.max(1, Math.floor(total * storeRate));
        ctx.addEffect(ctx.player, {
          id: "echo",
          kind: "echo",
          value: stored,
          turns: 8,
        });
      },
    },
    {
      id: "crescendo",
      name: "階調",
      group: "補助",
      blurb: "技を重ねるほど次の攻撃が膨らむ。手順の陰の立役者。",
      tradeoff: "それ自体はダメージを出さない。攻撃技で解放する前提。",
      cooldown: 4,
      gain: gain({ maxHp: 3, atk: 2, atkEff: 0.06, speed: 3 }),
      describe(level, stats) {
        const per = scaled(0.1, 0.025, level);
        const turns = Math.max(5, Math.floor(scaled(5, 0.5, level)));
        const cap = Math.max(4, Math.floor(scaled(4, 0.5, level)));
        return [
          `次の${turns}行動、技を使うたびに階調チャージ+1（上限${cap}）。`,
          `次の攻撃技はチャージをすべて消費し、威力にチャージ×${pctNowLabel(per)}を乗せる（攻撃力補助効率も乗る）。`,
          growthTail(
            `+${pctNowLabel(scaled(0.1, 0.025, level + 1))}／${Math.max(5, Math.floor(scaled(5, 0.5, level + 1)))}行動／上限${Math.max(
              4,
              Math.floor(scaled(4, 0.5, level + 1))
            )}`,
            "2.5%／0.5／0.5"
          ),
        ];
      },
      use(ctx, level) {
        const per = scaled(0.1, 0.025, level) * (ctx.effectiveAtkEff
          ? ctx.effectiveAtkEff(ctx.player)
          : ctx.player.atkEff || 1);
        const turns = Math.max(5, Math.floor(scaled(5, 0.5, level)));
        const cap = Math.max(4, Math.floor(scaled(4, 0.5, level)));
        ctx.addEffect(ctx.player, {
          id: "crescendo",
          kind: "crescendo",
          value: per,
          perCharge: per,
          charges: 0,
          cap,
          turns,
        });
        ctx.log(`${ctx.p}階調。技の響きが段々と厚くなり始める。`, "buff");
      },
    },
    {
      id: "bloodpact",
      name: "血契",
      group: "攻撃",
      blurb: "今の体力を賭け、払った血ごとぶん殴るド級の一打。",
      tradeoff: "体力を大きく削る。回復や守りがないと自滅する。",
      cooldown: 4,
      gain: gain({ maxHp: 8, atk: 5, healEff: 0.02, dmgBonus: 0.01 }),
      describe(level, stats) {
        const pay = scaled(0.18, 0.015, level);
        const convert = scaled(2.4, 0.2, level);
        const base = scaled(0.7, 0.04, level);
        return [
          `自分の現在体力の${pctNowLabel(pay)}を支払う。`,
          `威力は${atkMult(base, stats)}に加え、支払った量×${convert.toFixed(2)}を追加ダメージにする。`,
          growthTail(
            `支払い${pctNowLabel(scaled(0.18, 0.015, level + 1))}／×${scaled(2.4, 0.2, level + 1).toFixed(2)}`,
            "1.5%／0.20"
          ),
        ];
      },
      use(ctx, level) {
        const payRate = scaled(0.18, 0.015, level);
        const convert = scaled(2.4, 0.2, level);
        const base = scaled(0.7, 0.04, level);
        const cost = Math.max(1, Math.floor(ctx.player.hp * payRate));
        const paid = ctx.hurt(ctx.player, cost, "self");
        const r = ctx.damage(base);
        const bonus = Math.max(0, Math.floor(paid.dealt * convert));
        const extra = bonus > 0 ? ctx.hurt(ctx.enemy, bonus, "bloodpact") : { dealt: 0, over: 0 };
        ctx.log(
          `${ctx.p}血契。${paid.dealt}を捧げ、${ctx.enemy.name}に${r.dmg + extra.dealt}のダメージ。${ctx.overNote(
            r.over + extra.over
          )}`,
          "attack"
        );
      },
    },
    {
      id: "repay",
      name: "返礼",
      group: "攻撃",
      blurb: "受けた傷をすべて刃に変えて返す。耐えるほど主役になる。",
      tradeoff: "傷を受けていないと弱い。開幕単体では伸びない。",
      cooldown: 3,
      gain: gain({ maxHp: 6, atk: 3, def: 2, dmgReduction: 0.01 }),
      describe(level, stats) {
        const base = scaled(0.65, 0.03, level);
        const rate = scaled(0.85, 0.08, level);
        return [
          `基礎は${atkMult(base, stats)}。戦闘中に受けたダメージ累計×${rate.toFixed(2)}を追加する。`,
          "使うと累計は半分になる（すべて消しはしない）。",
          growthTail(`基礎×${scaled(0.65, 0.03, level + 1).toFixed(2)}／×${scaled(0.85, 0.08, level + 1).toFixed(2)}`, "0.03／0.08"),
        ];
      },
      use(ctx, level) {
        const base = scaled(0.65, 0.03, level);
        const rate = scaled(0.85, 0.08, level);
        const pain = Math.max(0, ctx.player.pain || 0);
        const bonus = Math.floor(pain * rate);
        const r = ctx.damage(base);
        const extra = bonus > 0 ? ctx.hurt(ctx.enemy, bonus, "repay") : { dealt: 0, over: 0 };
        ctx.player.pain = Math.floor(pain * 0.5);
        ctx.log(
          `${ctx.p}返礼。受けた傷${pain}を刃に変え、${ctx.enemy.name}に${r.dmg + extra.dealt}のダメージ。${ctx.overNote(
            r.over + extra.over
          )}`,
          "attack"
        );
      },
    },
    {
      id: "resonance",
      name: "共鳴",
      group: "攻撃",
      blurb: "自分の強化と敵の弱体の数だけ鳴る。バフ／崩しビルドの影の主役。",
      tradeoff: "強化も弱体もないとただの弱い攻撃。",
      cooldown: 2,
      gain: gain({ maxHp: 3, atk: 3, atkEff: 0.04, defEff: 0.02 }),
      describe(level, stats) {
        const base = scaled(0.8, 0.03, level);
        const per = scaled(0.16, 0.03, level);
        return [
          `基礎は${atkMult(base, stats)}。自分の強化1つ・敵の弱体1つごとに威力+${pctNowLabel(per)}。`,
          growthTail(
            `×${scaled(0.8, 0.03, level + 1).toFixed(2)}／+${pctNowLabel(scaled(0.16, 0.03, level + 1))}`,
            "0.03／3%"
          ),
        ];
      },
      use(ctx, level) {
        const base = scaled(0.8, 0.03, level);
        const per = scaled(0.16, 0.03, level);
        const buffs = ctx.countBuffs(ctx.player);
        const debuffs = ctx.countDebuffs(ctx.enemy);
        const mult = base + (buffs + debuffs) * per;
        const r = ctx.damage(mult);
        ctx.log(
          `${ctx.p}共鳴。強化${buffs}・弱体${debuffs}が響き、${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
      },
    },
    {
      id: "timestitch",
      name: "時縫い",
      group: "補助",
      blurb: "待ちを一気に縫い合わせ、次の技を連打できる余白を作る。",
      tradeoff: "再使用が長い。待ちが空いていると恩恵が薄い。",
      cooldown: 5,
      gain: gain({ maxHp: 4, speed: 8, atkEff: 0.03, atk: 1 }),
      describe(level, stats) {
        const cut = Math.max(2, Math.floor(scaled(2, 0.5, level)));
        const free = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        return [
          `使用時、他の技の待ちを${cut}進める。`,
          `そのあと、次に撃つ技${free}回ぶんは再使用待ちが発生しない。`,
          growthTail(
            `待ち${Math.max(2, Math.floor(scaled(2, 0.5, level + 1)))}／無料${Math.max(
              1,
              Math.floor(scaled(1, 0.35, level + 1))
            )}回`,
            "0.5／0.35切捨"
          ),
        ];
      },
      use(ctx, level) {
        const cut = Math.max(2, Math.floor(scaled(2, 0.5, level)));
        const free = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        const advanced = ctx.advanceCds(ctx.player, cut, "timestitch");
        ctx.addEffect(ctx.player, {
          id: "timestitch",
          kind: "freeCast",
          value: free,
          turns: 6,
        });
        ctx.log(
          `${ctx.p}時縫い。${advanced > 0 ? `待ちを${cut}縫い、` : ""}次の技${free}回が切れ目なく続く。`,
          "buff"
        );
      },
    },
    {
      id: "doommark",
      name: "終焔",
      group: "崩し",
      blurb: "敵に終末の印を押し、時が来たときド級の爆発を起こす。",
      tradeoff: "すぐには削れない。倒す前に爆発しないと取りこぼす。即時の一撃はない。",
      cooldown: 4,
      gain: gain({ maxHp: 3, atk: 3, def: 1, dmgBonus: 0.012 }),
      describe(level, stats) {
        const boom = scaled(2.35, 0.18, level);
        const delay = Math.max(2, Math.floor(scaled(3, -0.25, level)));
        return [
          `終焔の印を付与する（即時ダメージなし）。爆発の攻撃力・与ダメ補正・集中／階調は付与時に固定される。`,
          `敵の行動がおよそ${delay}回終わると印が弾け、付与時基準で${atkMult(boom, stats)}相当（発生時の防御・軽減で減衰）。`,
          "打ち直すと爆発倍率と攻撃スナップは更新され、残り時間も振り直される。",
          growthTail(
            `爆発×${scaled(2.35, 0.18, level + 1).toFixed(2)}`,
            "0.18"
          ),
        ];
      },
      use(ctx, level) {
        const boom = scaled(2.35, 0.18, level);
        const delay = Math.max(2, Math.floor(scaled(3, -0.25, level)));
        const offense = ctx.snapshotOffense({ consumeAmp: true });
        ctx.addEffect(ctx.enemy, {
          id: "doommark",
          kind: "doom",
          mult: boom,
          offense,
          stored: 0,
          value: boom,
          turns: delay,
          negative: true,
        });
        ctx.log(`${ctx.p}終焔。${ctx.enemy.name}に終末の印を押した。`, "buff");
      },
    },
    {
      id: "voidguard",
      name: "虚盾",
      group: "守り",
      blurb: "次の被弾の大半を虚無に飲み、回復と攻撃へ転化する。",
      tradeoff: "一度きり。攻撃を受けないと何も起きない。",
      cooldown: 5,
      gain: gain({ maxHp: 6, def: 3, defEff: 0.03, dmgReduction: 0.012 }),
      describe(level, stats) {
        const rate = scaled(0.7, 0.04, level);
        const heal = scaled(0.6, 0.05, level);
        const atk = scaled(0.2, 0.04, level);
        return [
          `次に受ける一撃のダメージを${pctNowLabel(rate)}減らす（最低1は残る）。`,
          `減らした分の${pctNowLabel(heal)}を回復し、${atkBuffText(0.2, 0.04, level, stats)}`,
          growthTail(`軽減${pctNowLabel(scaled(0.7, 0.04, level + 1))}／回復${pctNowLabel(scaled(0.6, 0.05, level + 1))}`, "4%／5%"),
        ];
      },
      use(ctx, level) {
        const rate = scaled(0.7, 0.04, level);
        const heal = scaled(0.6, 0.05, level);
        const atk = scaled(0.2, 0.04, level);
        ctx.addEffect(ctx.player, {
          id: "voidguard",
          kind: "absorb",
          value: rate,
          convertHeal: heal,
          convertAtk: atk,
          convertTurns: 3,
          turns: 5,
        });
        ctx.log(`${ctx.p}虚盾。次の衝撃を虚無へ落とす構え。`, "buff");
      },
    },
    {
      id: "overglow",
      name: "溢光",
      group: "回復",
      blurb: "溢れ出た回復を光として蓄え、次の一撃に乗せる。",
      tradeoff: "体力が減っていないと光が貯まらない。回復ビルド向き。",
      cooldown: 4,
      gain: gain({ maxHp: 7, healEff: 0.03, regenAmount: 2, atk: 1 }),
      describe(level, stats) {
        const heal = scaled(0.14, 0.012, level);
        const bank = scaled(0.9, 0.05, level);
        return [
          healPctText(0.14, 0.012, level, stats),
          `回復しきれなかった分（オーバー）の${pctNowLabel(bank)}を溢光として蓄え、次の攻撃技のダメージに加算する。`,
          growthTail(`オーバー${pctNowLabel(scaled(0.9, 0.05, level + 1))}`, "5%"),
        ];
      },
      use(ctx, level) {
        const rate = scaled(0.14, 0.012, level);
        const bankRate = scaled(0.9, 0.05, level);
        const healed = ctx.heal(ctx.player, ctx.player.maxHp * rate);
        const banked = Math.max(0, Math.floor(healed.over * bankRate));
        if (banked > 0) {
          ctx.addEffect(ctx.player, {
            id: "overglow",
            kind: "overglow",
            value: banked,
            turns: 6,
          });
        }
        ctx.log(
          `${ctx.p}溢光。体力が${healed.got}回復した。${ctx.overNote(healed.over)}${
            banked > 0 ? `溢れ${banked}が光になった。` : ""
          }`,
          "heal"
        );
      },
    },
    {
      id: "endless",
      name: "無限廊",
      group: "補助",
      blurb: "短いあいだ、技の再使用という概念を廊下の向こうへ捨てる。",
      tradeoff: "再使用が非常に長い。使いどころを誤ると死に技。",
      cooldown: 7,
      gain: gain({ maxHp: 5, speed: 6, atk: 2, atkEff: 0.05 }),
      describe(level, stats) {
        const free = Math.max(2, Math.floor(scaled(2, 0.5, level)));
        const haste = Math.max(1, Math.floor(scaled(1, 0.25, level)));
        const turns = Math.max(3, Math.floor(scaled(4, 0.25, level)));
        return [
          `次に撃つ技${free}回ぶんは再使用待ちが発生しない。`,
          `同時に${turns}行動、待ちが「1」ではなく「${1 + haste}」進む。`,
          growthTail(
            `無料${Math.max(2, Math.floor(scaled(2, 0.5, level + 1)))}回／待ち+${Math.max(
              1,
              Math.floor(scaled(1, 0.25, level + 1))
            )}／${Math.max(3, Math.floor(scaled(4, 0.25, level + 1)))}行動`,
            "0.5／0.25／0.25切捨"
          ),
        ];
      },
      use(ctx, level) {
        const free = Math.max(2, Math.floor(scaled(2, 0.5, level)));
        const haste = Math.max(1, Math.floor(scaled(1, 0.25, level)));
        const turns = Math.max(3, Math.floor(scaled(4, 0.25, level)));
        ctx.addEffect(ctx.player, {
          id: "endless",
          kind: "freeCast",
          value: free,
          turns: 8,
        });
        ctx.addEffect(ctx.player, {
          id: "endless-haste",
          kind: "cdHaste",
          value: haste,
          turns,
        });
        ctx.log(`${ctx.p}無限廊。再使用の壁が、しばらく消えた。`, "buff");
      },
    },
    // ---- 速度・効率・与ダメ補正・被ダメ軽減のバフ／デバフ ----
    {
      id: "gale",
      name: "疾風",
      group: "補助",
      blurb: "しばらく行動速度を上げ、手番を奪いやすくする。",
      tradeoff: "攻撃そのものはしない。",
      cooldown: 3,
      gain: gain({ maxHp: 2, speed: 8, atk: 1 }),
      describe(level) {
        return [`次の4行動、${speedBuffText(0.22, 0.03, level)}`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "gale",
          kind: "speedPct",
          value: scaled(0.22, 0.03, level),
          turns: 4,
        });
        ctx.log(`${ctx.p}疾風。足が軽くなった。`, "buff");
      },
    },
    {
      id: "fetter",
      name: "足枷",
      group: "崩し",
      blurb: "敵の行動速度を落とす。速い相手へのメタ。攻撃はしない。",
      tradeoff: "すでに遅い相手にはご褒美が薄い。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 1, speed: 4 }),
      describe(level) {
        return [`敵の次の5行動、${speedBuffText(-0.26, -0.03, level)}`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.enemy, {
          id: "fetter",
          kind: "speedPct",
          value: -scaled(0.26, 0.03, level),
          turns: 5,
          negative: true,
        });
        ctx.log(`${ctx.p}足枷。${ctx.enemy.name}の動きが鈍った。`, "buff");
      },
    },
    {
      id: "sharplaw",
      name: "鋭律",
      group: "補助",
      blurb: "攻撃力補助効率を一段上げ、バフの乗りを厚くする。",
      tradeoff: "攻撃力そのものは上げない。バフ技と組む前提。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atkEff: 0.05, atk: 1 }),
      describe(level) {
        return [`次の4行動、${flatEffText("攻撃力補助効率", 0.22, 0.03, level)}`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "sharplaw",
          kind: "atkEffFlat",
          value: scaled(0.22, 0.03, level),
          turns: 4,
        });
        ctx.log(`${ctx.p}鋭律。刃への乗りが鋭くなった。`, "buff");
      },
    },
    {
      id: "dullhex",
      name: "鈍視",
      group: "崩し",
      blurb: "敵が攻撃を高めた瞬間、その乗りを鈍らせる。",
      tradeoff: "敵が攻撃バフを張らないと発動しない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 5, atk: 2, def: 4 }),
      describe(level) {
        return [
          "敵が攻撃力上昇（割合）を得たとき、攻撃力補助効率を下げる弱体を付与する。",
          `敵の次の4行動、${flatEffText("攻撃力補助効率", -0.22, -0.025, level)}`,
        ];
      },
      afterEnemyGainEffect(ctx, level, effect) {
        if (!effect || effect.kind !== "atkPct" || !(effect.value > 0) || effect.negative) return;
        ctx.addEffect(ctx.enemy, {
          id: "dullhex",
          kind: "atkEffFlat",
          value: -scaled(0.22, 0.025, level),
          turns: 4,
          negative: true,
        });
        ctx.log(`鈍視。${ctx.enemy.name}の刃の乗りが鈍った。`, "buff");
      },
    },
    {
      id: "guardlaw",
      name: "守律",
      group: "補助",
      blurb: "防御力補助効率を上げ、守りのバフを厚くする。",
      tradeoff: "防御そのものは上げない。鉄身などと組む前提。",
      cooldown: 3,
      gain: gain({ maxHp: 4, defEff: 0.05, def: 1 }),
      describe(level) {
        return [`次の4行動、${flatEffText("防御力補助効率", 0.22, 0.03, level)}`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "guardlaw",
          kind: "defEffFlat",
          value: scaled(0.22, 0.03, level),
          turns: 4,
        });
        ctx.log(`${ctx.p}守律。盾への乗りが厚くなった。`, "buff");
      },
    },
    {
      id: "frailty",
      name: "脆視",
      group: "崩し",
      blurb: "敵が守りを厚くした瞬間、その乗りを脆くする。",
      tradeoff: "敵が防御バフを張らないと発動しない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 5, atk: 2, def: 5 }),
      describe(level) {
        return [
          "敵が防御力上昇（割合）を得たとき、防御力補助効率を下げる弱体を付与する。",
          `敵の次の4行動、${flatEffText("防御力補助効率", -0.22, -0.025, level)}`,
        ];
      },
      afterEnemyGainEffect(ctx, level, effect) {
        if (!effect || effect.kind !== "defPct" || !(effect.value > 0) || effect.negative) return;
        ctx.addEffect(ctx.enemy, {
          id: "frailty",
          kind: "defEffFlat",
          value: -scaled(0.22, 0.025, level),
          turns: 4,
          negative: true,
        });
        ctx.log(`脆視。${ctx.enemy.name}の守りの乗りが脆くなった。`, "buff");
      },
    },
    {
      id: "healrite",
      name: "癒律",
      group: "回復",
      blurb: "体力回復効率を上げ、回復技と自動回復を厚くする。",
      tradeoff: "即時の大きな回復はない。回復ビルド向き。",
      cooldown: 4,
      gain: gain({ maxHp: 5, healEff: 0.04, regenAmount: 1 }),
      describe(level) {
        return [`次の4行動、${flatEffText("体力回復効率", 0.2, 0.03, level)}`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "healrite",
          kind: "healEffFlat",
          value: scaled(0.2, 0.03, level),
          turns: 4,
        });
        ctx.log(`${ctx.p}癒律。傷の塞がり方が良くなった。`, "heal");
      },
    },
    {
      id: "healsap",
      name: "癒腐",
      group: "崩し",
      blurb: "自動回復する敵への一撃が、回復の効きを腐らせる。",
      tradeoff: "再生しない相手には発動しない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 7, atk: 2, regenAmount: 2 }),
      describe(level) {
        const down = scaled(0.22, 0.025, level);
        const next = scaled(0.22, 0.025, level + 1);
        return [
          `自動回復を持つ敵への攻撃命中で、回復効率を${pctNowLabel(down)}下げる（敵の3行動）。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.025)
          )}`,
        ];
      },
      afterPlayerDeal(ctx, level, hit) {
        if (!hit || hit.dmg <= 0) return;
        if ((ctx.enemy.regenAmount || 0) <= 0) return;
        const existing = ctx.findEffectById(ctx.enemy, "healsap");
        ctx.addEffect(ctx.enemy, {
          id: "healsap",
          kind: "healDown",
          value: scaled(0.22, 0.025, level),
          turns: 3,
          negative: true,
        });
        if (!existing) {
          ctx.log(`癒腐。${ctx.enemy.name}の回復の効きが腐った。`, "buff");
        }
      },
    },
    {
      id: "ruinflash",
      name: "凶閃",
      group: "補助",
      blurb: "与ダメージ補正を一時的に押し上げる。",
      tradeoff: "攻撃力や技倍率そのものは上げない。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 2, dmgBonus: 0.01 }),
      describe(level) {
        return [`次の4行動、${dmgBonusText(0.14, 0.02, level)}`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "ruinflash",
          kind: "dmgBonus",
          value: scaled(0.14, 0.02, level),
          turns: 4,
        });
        ctx.log(`${ctx.p}凶閃。刃が凶々しく光った。`, "buff");
      },
    },
    {
      id: "enfeeble",
      name: "無力",
      group: "崩し",
      blurb: "敵の与ダメージ補正を下げ、打撃を軽くする。攻撃はしない。",
      tradeoff: "防御を上げるわけではない。",
      cooldown: 3,
      gain: gain({ maxHp: 5, def: 2, dmgReduction: 0.01 }),
      describe(level) {
        return [`敵の次の5行動、${dmgBonusText(-0.18, -0.025, level)}`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.enemy, {
          id: "enfeeble",
          kind: "dmgBonus",
          value: -scaled(0.18, 0.025, level),
          turns: 5,
          negative: true,
        });
        ctx.log(`${ctx.p}無力。${ctx.enemy.name}の打撃が軽くなった。`, "buff");
      },
    },
    {
      id: "ironveil",
      name: "鉄衣",
      group: "守り",
      blurb: "打撃を受けるたび、短い鉄の衣が肌を覆う。",
      tradeoff: "再発動まで自分の行動2回を空ける。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 8, def: 4, dmgReduction: 0.015 }),
      describe(level) {
        const now = scaled(0.14, 0.015, level);
        const next = scaled(0.14, 0.015, level + 1);
        return [
          `被弾時、次の2行動の被ダメージ軽減+${pctNowLabel(now)}。自分の行動2回空けるまで再発動しない。${growthTail(
            `+${pctNowLabel(next)}`,
            pctStepLabel(0.015)
          )}`,
        ];
      },
      afterPlayerTake(ctx, level, hit) {
        if (!hit || hit.dmg <= 0) return;
        const mem = ctx.player.passiveMem;
        const readyAt = mem.ironveilReadyAt || 0;
        if (ctx.player.actionCount < readyAt) return;
        mem.ironveilReadyAt = ctx.player.actionCount + 2;
        ctx.addEffect(ctx.player, {
          id: "ironveil",
          kind: "dr",
          value: scaled(0.14, 0.015, level),
          turns: 2,
        });
        ctx.log(`鉄衣。短い鉄が肌を覆った。`, "buff");
      },
    },
    {
      id: "rendveil",
      name: "裂膜",
      group: "崩し",
      blurb: "敵の被ダメージ軽減を大きく引き剥がす。負の領域まで落とせる。攻撃はしない。",
      tradeoff: "敵の軽減がもともと低いと伸びしろは限られる。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 2, dmgBonus: 0.01 }),
      describe(level) {
        const down = scaled(0.26, 0.025, level);
        const next = scaled(0.26, 0.025, level + 1);
        return [
          `敵の被ダメージ軽減を${pctNowLabel(down)}下げる（敵の5行動）。下限はさらに低い負の領域まで。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.025)
          )}`,
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.enemy, {
          id: "rendveil",
          kind: "dr",
          value: -scaled(0.26, 0.025, level),
          turns: 5,
          negative: true,
        });
        ctx.log(`${ctx.p}裂膜。${ctx.enemy.name}の防護の膜を裂いた。`, "buff");
      },
    },
    // ---- 穴埋め12種（剥印〜戒律）----
    {
      id: "stripseal",
      name: "剥印",
      group: "崩し",
      blurb: "敵の強化を引き剥がす。攻撃はしない。",
      tradeoff: "強化していない相手には何も起きない。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 1, def: 2, atkEff: 0.02 }),
      describe(level) {
        const n = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        const next = Math.max(1, Math.floor(scaled(1, 0.35, level + 1)));
        return [
          `敵の強化を最大${n}つ外す。${growthTail(`${next}つ`, "0.35切捨")}`,
          "弱体や毒は対象外。強化がなければ何もしない。",
        ];
      },
      use(ctx, level) {
        const n = Math.max(1, Math.floor(scaled(1, 0.35, level)));
        const stripped = ctx.stripBuffs(ctx.enemy, n);
        ctx.log(
          stripped > 0
            ? `${ctx.p}剥印。${ctx.enemy.name}の強化を${stripped}つ剥がした。`
            : `${ctx.p}剥印。剥がす強化がなかった。`,
          "buff"
        );
      },
    },
    {
      id: "triumph",
      name: "凱斬",
      group: "攻撃",
      blurb: "敵が強化中なら大きく斬る。何もなければ弱い。",
      tradeoff: "剥印や弱体のあとでは伸びない。強化を残して斬るかが腕。",
      cooldown: 2,
      gain: gain({ maxHp: 2, atk: 3, speed: 2, atkEff: 0.02 }),
      describe(level, stats) {
        return [
          `敵が強化中なら${atkMult(scaled(2.2, 0.08, level), stats)}。`,
          `強化がなければ${atkMult(scaled(0.9, 0.03, level), stats)}。`,
          dualMultGrowth(2.2, 0.08, 0.9, 0.03, level),
        ];
      },
      use(ctx, level) {
        const buffed = ctx.hasBuff(ctx.enemy);
        const mult = buffed ? scaled(2.2, 0.08, level) : scaled(0.9, 0.03, level);
        const r = ctx.damage(mult);
        ctx.log(
          `${ctx.p}凱斬。${buffed ? "盛り上がった隙を斬り、" : "勢いがなく、"}${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
      },
    },
    {
      id: "hexblade",
      name: "呪継",
      group: "攻撃",
      blurb: "自分が弱体を負っているあいだ、打撃が呪いに継がれる。",
      tradeoff: "弱体がないと沈黙する。浄化と両立しにくい。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 5, atk: 4, def: 2, atkEff: 0.035 }),
      describe(level, stats) {
        return [
          "自分が弱体中の攻撃命中で、短い追撃が入る。",
          multText(0.22, 0.02, level, stats),
          "あわせて敵の攻撃力を短く下げる（敵の2行動）。",
        ];
      },
      afterPlayerDeal(ctx, level, hit) {
        if (!hit || hit.dmg <= 0 || ctx.enemy.hp <= 0) return;
        if (!ctx.hasDebuff(ctx.player)) return;
        const r = ctx.damage(scaled(0.22, 0.02, level), { amp: false, fromPassive: true });
        ctx.addEffect(ctx.enemy, {
          id: "hexblade",
          kind: "atkPct",
          value: -scaled(0.12, 0.01, level),
          turns: 2,
          negative: true,
        });
        ctx.log(
          `呪継。呪いを継ぎ、${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
      },
    },
    {
      id: "twinflash",
      name: "双閃",
      group: "攻撃",
      blurb: "二連の閃光。一発目で反射を消費しやすい。",
      tradeoff: "一発あたりは控えめ。単発の大技には劣る。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 3, speed: 3, dmgBonus: 0.006 }),
      describe(level, stats) {
        const each = scaled(0.72, 0.03, level);
        return [
          `二回攻撃。各${atkMult(each, stats)}。`,
          growthTail(`各×${scaled(0.72, 0.03, level + 1).toFixed(2)}`, "0.03"),
          "反射や一度きりの防護は、一発目で落ちることが多い。",
        ];
      },
      use(ctx, level) {
        const each = scaled(0.72, 0.03, level);
        const a = ctx.damage(each);
        if (ctx.enemy.hp <= 0) {
          ctx.log(`${ctx.p}双閃。一閃で${ctx.enemy.name}に${a.dmg}。${ctx.overNote(a.over)}`, "attack");
          return;
        }
        const b = ctx.damage(each, { amp: false });
        ctx.log(
          `${ctx.p}双閃。${ctx.enemy.name}に${a.dmg}と${b.dmg}、合計${a.dmg + b.dmg}。${ctx.overNote(a.over + b.over)}`,
          "attack"
        );
      },
    },
    {
      id: "layerguard",
      name: "層盾",
      group: "守り",
      blurb: "何発分かの薄い盾を重ね、連続攻撃に耐える。",
      tradeoff: "一発の大技には弱い。攻撃はしない。",
      cooldown: 4,
      gain: gain({ maxHp: 6, def: 3, defEff: 0.02, dmgReduction: 0.01 }),
      describe(level) {
        const charges = Math.max(2, Math.floor(scaled(2, 0.4, level)));
        const rate = scaled(0.28, 0.03, level);
        return [
          `次の被弾を最大${charges}回、各${pctNowLabel(rate)}軽減する。`,
          growthTail(
            `${Math.max(2, Math.floor(scaled(2, 0.4, level + 1)))}回／${pctNowLabel(scaled(0.28, 0.03, level + 1))}`,
            "0.4切捨／3%"
          ),
        ];
      },
      use(ctx, level) {
        const charges = Math.max(2, Math.floor(scaled(2, 0.4, level)));
        const rate = scaled(0.28, 0.03, level);
        ctx.addEffect(ctx.player, {
          id: "layerguard",
          kind: "hitShield",
          value: rate,
          charges,
          turns: 6,
        });
        ctx.log(`${ctx.p}層盾。薄い盾を${charges}枚重ねた。`, "buff");
      },
    },
    {
      id: "outpace",
      name: "先制牙",
      group: "攻撃",
      blurb: "自分が速いあいだ、打撃が鋭く、たまに牙が追う。",
      tradeoff: "敵より遅いと発動しない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 4, atk: 3, atkEff: 0.035, speed: 8 }),
      describe(level, stats) {
        const bonus = scaled(0.1, 0.012, level);
        const next = scaled(0.1, 0.012, level + 1);
        return [
          `自分の行動速度が敵より高いとき、命中ダメージの${pctNowLabel(bonus)}を追加で与える。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.012)
          )}`,
          `さらに3回に1回、追撃（${atkMult(scaled(0.3, 0.02, level), stats)}）が入る。`,
        ];
      },
      afterPlayerDeal(ctx, level, hit) {
        if (!hit || hit.dmg <= 0 || ctx.enemy.hp <= 0) return;
        if (ctx.effectiveSpeed(ctx.player) <= ctx.effectiveSpeed(ctx.enemy)) return;
        const bonus = Math.max(1, Math.floor(hit.dmg * scaled(0.1, 0.012, level)));
        const hurt = ctx.hurt(ctx.enemy, bonus, "outpace");
        const mem = ctx.player.passiveMem;
        mem.outpaceHits = (mem.outpaceHits || 0) + 1;
        let extra = "";
        if (mem.outpaceHits % 3 === 0 && ctx.enemy.hp > 0) {
          const r = ctx.damage(scaled(0.3, 0.02, level), { amp: false, fromPassive: true });
          extra = `追撃${r.dmg}。${ctx.overNote(r.over)}`;
        }
        ctx.log(
          `先制牙。${hurt.dealt}の追い打ち。${ctx.overNote(hurt.over)}${extra}`,
          "attack"
        );
      },
    },
    {
      id: "wardfocus",
      name: "守継",
      group: "補助",
      blurb: "守り技の厚みが、常に一段継がれる。",
      tradeoff: "守りを張らないビルドでは沈黙する。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 7, def: 4, defEff: 0.06 }),
      describe(level) {
        const now = scaled(0.22, 0.03, level);
        const next = scaled(0.22, 0.03, level + 1);
        return [
          `自分に付く守り効果（防御上昇・軽減・層盾・反射・吸収）の効果量が常に${pctNowLabel(now)}上乗せされる。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.03)
          )}`,
          "バフ枠は消費しない。所持しているだけで働く。",
        ];
      },
    },
    {
      id: "stackvenom",
      name: "積毒",
      group: "崩し",
      blurb: "すでに毒がある相手には毒を濃くする。なければ新しい毒を回す。",
      tradeoff: "毒がない開幕でも毒刃級。濃縮でさらに伸びる。",
      cooldown: 2,
      gain: gain({ maxHp: 2, atk: 3, speed: 2, healEff: -0.015 }),
      describe(level, stats) {
        const base = scaled(0.5, 0.035, level);
        const boost = scaled(0.68, 0.045, level);
        return [
          `毒がなければ、6行動の毒（${atkMult(base, stats)}／回）。`,
          `すでに毒があるときは上書きして濃くし、7行動の毒（${atkMult(boost, stats)}／回）。`,
          growthTail(
            `基礎×${scaled(0.5, 0.035, level + 1).toFixed(2)}／濃縮×${scaled(0.68, 0.045, level + 1).toFixed(2)}`,
            "0.035／0.045"
          ),
        ];
      },
      use(ctx, level) {
        const existing = ctx.findEffect(ctx.enemy, "dot");
        const boosted = !!existing;
        const ratio = boosted ? scaled(0.68, 0.045, level) : scaled(0.5, 0.035, level);
        const turns = boosted ? 7 : 6;
        const offense = ctx.snapshotOffense({ consumeAmp: false });
        ctx.addEffect(ctx.enemy, {
          id: "stackvenom",
          kind: "dot",
          mult: ratio,
          offense,
          turns,
          negative: true,
        });
        ctx.log(
          boosted
            ? `${ctx.p}積毒。${ctx.enemy.name}の毒を濃くした。`
            : `${ctx.p}積毒。${ctx.enemy.name}に毒が回る。`,
          "buff"
        );
      },
    },
    {
      id: "breakglass",
      name: "碎映",
      group: "崩し",
      blurb: "反射や吸収に触れた打撃が、構えを砕いて追撃する。",
      tradeoff: "構えがない相手には発動しない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 4, atk: 5, def: 2, dmgBonus: 0.012 }),
      describe(level, stats) {
        return [
          "攻撃命中時、敵に反射または吸収があればそれを外し、追撃する。",
          multText(0.55, 0.04, level, stats),
        ];
      },
      afterPlayerDeal(ctx, level, hit) {
        if (!hit || ctx.enemy.hp <= 0) return;
        const touched = (hit.reflect || 0) > 0 || (hit.absorbed || 0) > 0;
        const remains = ctx.enemy.effects.some((e) => e.kind === "reflect" || e.kind === "absorb");
        if (!touched && !remains) return;
        if (remains) ctx.purgeKinds(ctx.enemy, ["reflect", "absorb"]);
        const r = ctx.damage(scaled(0.55, 0.04, level), { amp: false, fromPassive: true });
        ctx.log(
          `碎映。構えを砕き、${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
      },
    },
    {
      id: "burnbright",
      name: "献閃",
      group: "攻撃",
      blurb: "自分の強化をすべて燃やし、一瞬の大技にする。",
      tradeoff: "強化を空にする。何もなければ弱い。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 4, atkEff: 0.03, dmgBonus: 0.01 }),
      describe(level, stats) {
        const base = scaled(0.7, 0.03, level);
        const per = scaled(0.35, 0.04, level);
        return [
          `基礎${atkMult(base, stats)}。自分の強化1つにつき威力+${per.toFixed(2)}（すべて消費）。`,
          growthTail(
            `基礎×${scaled(0.7, 0.03, level + 1).toFixed(2)}／+${scaled(0.35, 0.04, level + 1).toFixed(2)}毎`,
            "0.03／0.04"
          ),
        ];
      },
      use(ctx, level) {
        const n = ctx.countBuffs(ctx.player);
        ctx.stripBuffs(ctx.player, 99);
        const mult = scaled(0.7, 0.03, level) + n * scaled(0.35, 0.04, level);
        const r = ctx.damage(mult, { amp: false });
        ctx.log(
          `${ctx.p}献閃。強化${n}つを燃やし、${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
      },
    },
    {
      id: "punishwall",
      name: "療刃",
      group: "守り",
      blurb: "回復した分の一部が、光の刃となって敵へ向かう。",
      tradeoff: "回復しないと光も出ない。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 8, def: 3, regenAmount: 2, healEff: 0.03 }),
      describe(level) {
        const rate = scaled(0.2, 0.025, level);
        const next = scaled(0.2, 0.025, level + 1);
        return [
          `自分が回復した量の${pctNowLabel(rate)}を、常に敵へのダメージにする。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.025)
          )}`,
        ];
      },
    },
    {
      id: "vow",
      name: "戒律",
      group: "回復",
      blurb: "攻撃を控えたあとほど、大きく回復する。",
      tradeoff: "攻撃し続けているとほとんど回復しない。",
      cooldown: 4,
      gain: gain({ maxHp: 7, healEff: 0.03, def: 1, regenAmount: 1 }),
      describe(level, stats) {
        const base = scaled(0.06, 0.008, level);
        const per = scaled(0.04, 0.006, level);
        return [
          `最大体力の${pctNowLabel(base)}を回復し、直近で攻撃技（または通常攻撃）を使っていない自分の行動1回ごとに+${pctNowLabel(per)}。`,
          "攻撃技や通常攻撃を挟むとカウントは戻る。",
          growthTail(
            `${pctNowLabel(scaled(0.06, 0.008, level + 1))}＋毎${pctNowLabel(scaled(0.04, 0.006, level + 1))}`,
            "0.8%／0.6%"
          ),
        ];
      },
      use(ctx, level) {
        const wait = Math.max(0, ctx.player.sinceAttackSkill || 0);
        const rate = scaled(0.06, 0.008, level) + wait * scaled(0.04, 0.006, level);
        const healed = ctx.heal(ctx.player, ctx.player.maxHp * Math.min(0.55, rate));
        ctx.log(
          `${ctx.p}戒律。静かさ${wait}を糧に、体力が${healed.got}回復した。${ctx.overNote(healed.over)}`,
          "heal"
        );
      },
    },
    {
      id: "siphonseal",
      name: "奪気",
      group: "崩し",
      blurb: "強化中の敵への一撃が、その気を奪い取る。",
      tradeoff: "強化がない相手には発動しない。再発動まで自分の行動2回。",
      passive: true,
      cooldown: 0,
      gain: gain({ maxHp: 5, atk: 3, def: 2, atkEff: 0.035, speed: 2 }),
      describe(level) {
        const keep = scaled(0.55, 0.04, level);
        return [
          `強化中の敵への攻撃命中で、強化を1つ奪い自分へ移す（残り行動は約${pctNowLabel(keep)}）。`,
          growthTail(pctNowLabel(scaled(0.55, 0.04, level + 1)), "4%"),
          "自分の行動2回空けるまで再発動しない。",
        ];
      },
      afterPlayerDeal(ctx, level, hit) {
        if (!hit || hit.dmg <= 0) return;
        if (!ctx.hasBuff(ctx.enemy)) return;
        const mem = ctx.player.passiveMem;
        const readyAt = mem.siphonReadyAt || 0;
        if (ctx.player.actionCount < readyAt) return;
        const keep = scaled(0.55, 0.04, level);
        const stolen = ctx.stealBuff(ctx.enemy, ctx.player, keep);
        if (!stolen) return;
        mem.siphonReadyAt = ctx.player.actionCount + 2;
        ctx.log(`奪気。${ctx.enemy.name}の強化を奪い取った。`, "buff");
      },
    },
  ];

  const GROUPS = ["攻撃", "崩し", "守り", "回復", "補助"];
  const BY_ID = {};
  SKILLS.forEach((skill) => {
    BY_ID[skill.id] = skill;
  });

  const STAT_KEYS = Object.keys(BASE_STATS);
  const OFFER_COUNT = 5;
  /** 2枚目以降に乗る付随ステータス係数（1枚目は満額、追加分は基礎gain×この値） */
  const STACK_GAIN_BONUS = 0.3;

  function gainFromSkill(skill, level) {
    const lv = Math.max(0, Math.floor(level || 0));
    const stacks = Math.max(0, lv - 1);
    const out = {};
    STAT_KEYS.forEach((key) => {
      const g = (skill && skill.gain && skill.gain[key]) || 0;
      // 例: gain 6 / 2枚 → 6 + 6×0.3 = 7.8（線形の 6+6 より抑えめ）
      out[key] = lv > 0 ? g + g * stacks * STACK_GAIN_BONUS : 0;
    });
    return out;
  }

  function computeStats(levels) {
    const stats = { ...BASE_STATS };
    Object.keys(levels || {}).forEach((id) => {
      const level = levels[id] || 0;
      const skill = BY_ID[id];
      if (!skill || level <= 0) return;
      const contrib = gainFromSkill(skill, level);
      STAT_KEYS.forEach((key) => {
        stats[key] += contrib[key] || 0;
      });
    });
    stats.maxHp = Math.max(40, Math.floor(stats.maxHp));
    stats.atk = Math.max(1, Math.floor(stats.atk));
    stats.def = Math.max(0, Math.floor(stats.def));
    stats.regenInterval = Math.max(1, Math.floor(stats.regenInterval));
    stats.regenAmount = Math.max(0, Math.floor(stats.regenAmount));
    stats.healEff = Math.max(0.25, stats.healEff);
    stats.atkEff = Math.max(0.25, stats.atkEff);
    stats.defEff = Math.max(0.25, stats.defEff);
    stats.speed = Math.max(50, Math.floor(stats.speed));
    stats.dmgReduction = Math.max(-0.6, Math.min(0.45, stats.dmgReduction));
    return stats;
  }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function next() {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rollOffer(seed, count) {
    const n = Math.min(count || OFFER_COUNT, SKILLS.length);
    const rand = mulberry32(seed >>> 0 || 1);
    const pool = SKILLS.map((skill) => skill.id);
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, n);
  }

  W.BASE_STATS = BASE_STATS;
  W.SKILLS = SKILLS;
  W.SKILL_GROUPS = GROUPS;
  W.SKILL_BY_ID = BY_ID;
  W.OFFER_COUNT = OFFER_COUNT;
  W.STACK_GAIN_BONUS = STACK_GAIN_BONUS;
  W.gainFromSkill = gainFromSkill;
  W.computeStats = computeStats;
  W.rollOffer = rollOffer;
  W.scaled = scaled;
  W.overNote = overNote;
  W.maxHpPct = maxHpPct;
  W.atkMult = atkMult;
  W.cooldownReuseText = cooldownReuseText;
  W.cooldownShort = cooldownShort;
  W.passiveReuseText = passiveReuseText;
  W.passiveShort = passiveShort;
})(typeof window !== "undefined" ? window : globalThis);
