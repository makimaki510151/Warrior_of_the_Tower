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
      blurb: "小さな傷と引き換えに、敵の防御をしばらく下げる。",
      tradeoff: "その一撃は弱い。後続の攻撃や弱点と組んで初めて活きる。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 2, def: 1, atkEff: 0.03 }),
      describe(level, stats) {
        const down = scaled(0.3, 0.02, level);
        const next = scaled(0.3, 0.02, level + 1);
        return [
          multText(0.95, 0.035, level, stats),
          `敵の防御力を${pctNowLabel(down)}下げる（敵の4行動）。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.02)
          )}`,
          "この低下に、自分の補助効率は乗らない。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.95, 0.035, level));
        const down = scaled(0.3, 0.02, level);
        ctx.addEffect(ctx.enemy, {
          id: "sunder",
          kind: "defPct",
          value: -down,
          turns: 4,
          negative: true,
        });
        ctx.log(`${ctx.p}崩甲。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}防御力を下げた。`, "attack");
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
      blurb: "直後の威力は低いが、毒が長く効く。短期決戦には向かない。",
      tradeoff: "回復効率が下がり、自分の回復技と相性が悪い。",
      cooldown: 2,
      gain: gain({ maxHp: 2, atk: 3, speed: 4, healEff: -0.02 }),
      describe(level, stats) {
        const ratio = scaled(0.4, 0.03, level);
        const next = scaled(0.4, 0.03, level + 1);
        return [
          multText(0.72, 0.03, level, stats),
          `その後、敵は5行動のあいだ行動ごとに${atkMult(ratio, stats)}の毒を受ける。${growthTail(
            `×${next.toFixed(2)}`,
            "0.03"
          )}`,
          "毒は重ねがけせず、打ち直すと残りが更新される。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.72, 0.03, level));
        const dot = Math.max(1, Math.floor(ctx.effectiveAtk(ctx.player) * scaled(0.4, 0.03, level)));
        ctx.addEffect(ctx.enemy, {
          id: "venom",
          kind: "dot",
          value: dot,
          turns: 5,
          negative: true,
        });
        ctx.log(`${ctx.p}毒刃。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}毒が回る。`, "attack");
      },
    },
    {
      id: "wither",
      name: "枯渇",
      group: "崩し",
      blurb: "敵の自動回復を止める。回復しない相手にはただの弱い攻撃。",
      tradeoff: "再生する敵専用に近い。通常の敵には斬撃の方が上。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 1, def: 2, regenAmount: 1 }),
      describe(level, stats) {
        return [
          multText(0.64, 0.03, level, stats),
          "敵の自動回復を、敵の4行動のあいだ止める。",
          "継続回復そのものは消さない。止めたあいだだけ働かない。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.64, 0.03, level));
        ctx.addEffect(ctx.enemy, {
          id: "wither",
          kind: "noRegen",
          value: 1,
          turns: 4,
          negative: true,
        });
        ctx.log(`${ctx.p}枯渇。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}自動回復を封じた。`, "attack");
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
      name: "血誓",
      group: "守り",
      blurb: "体力を代償に防御が大きく上がる。瀕死では使えない。",
      tradeoff: "自動回復が遅く、量も減る。刺客の前で使うと自滅しやすい。",
      cooldown: 4,
      gain: gain({ maxHp: 10, def: 5, regenAmount: -1, regenInterval: 1 }),
      available(ctx) {
        return ctx.player.hp / ctx.player.maxHp > 0.32;
      },
      describe(level, stats) {
        return [
          "現在体力の13%を払い、次の3行動、防御力を大きく上げる。",
          defBuffText(0.5, 0.02, level, stats),
          "体力が32%を超えているときだけ使える（32%以下では飛ばされる）。",
        ];
      },
      use(ctx, level) {
        const hurt = ctx.hurt(ctx.player, ctx.player.hp * 0.13, "self");
        const cost = hurt.dealt;
        ctx.addEffect(ctx.player, {
          id: "blood",
          kind: "defPct",
          value: scaled(0.5, 0.02, level),
          turns: 3,
          scale: "def",
        });
        ctx.log(`${ctx.p}血誓。${cost}を払った。${ctx.overNote(hurt.over)}防御力が上がった。`, "buff");
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
      name: "脈動",
      group: "回復",
      blurb: "しばらく自動回復が増える。短い戦いでは間に合わない。",
      tradeoff: "即時回復はない。行動が大きく遅くなる。",
      cooldown: 5,
      gain: gain({ maxHp: 4, def: 1, regenAmount: 1, speed: -5 }),
      describe(level, stats) {
        const extra = scaled(3, 0.6, level);
        const next = scaled(3, 0.6, level + 1);
        return [
          `次の3行動、自動回復量+${extra.toFixed(1)}。${growthTail(`+${next.toFixed(1)}`, "0.6")}`,
          "即時回復はない。速度低下の代償が大きい。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "pulse",
          kind: "regenFlat",
          value: scaled(3, 0.6, level),
          turns: 3,
        });
        ctx.log(`${ctx.p}脈動。自動回復がわずかに強くなった。`, "heal");
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
      name: "刺突",
      group: "攻撃",
      blurb: "ごく軽い一撃。再使用が早い。",
      tradeoff: "単発は弱い。連続で当てる前提。",
      cooldown: 1,
      gain: gain({ maxHp: 1, atk: 1, speed: 8 }),
      describe(level, stats) {
        return [multText(1.05, 0.03, level, stats)];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(1.05, 0.03, level));
        ctx.log(`${ctx.p}刺突。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`, "attack");
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
      name: "吸命",
      group: "攻撃",
      blurb: "吸血より回復寄り。火力は落ちる。",
      tradeoff: "通らない相手では回復も薄い。火力は低く、再使用も遅い。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 0, healEff: 0.01, speed: -2 }),
      describe(level, stats) {
        const ratio = scaled(0.32, 0.012, level);
        const next = scaled(0.32, 0.012, level + 1);
        return [
          multText(0.82, 0.025, level, stats),
          `与ダメージの${pctNowLabel(ratio)}を基礎に回復する。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.012)
          )}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.82, 0.025, level));
        const healed = ctx.heal(ctx.player, r.dmg * scaled(0.32, 0.012, level));
        const got = healed.got;
        ctx.log(`${ctx.p}吸命。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}${got}回復した。${ctx.overNote(healed.over)}`, "attack");
      },
    },
    {
      id: "ambush",
      name: "奇襲",
      group: "攻撃",
      blurb: "戦闘序盤に強い。長引くと弱い。",
      tradeoff: "開幕専用に近い。",
      cooldown: 2,
      gain: gain({ maxHp: 2, atk: 3, speed: 5 }),
      describe(level, stats) {
        return [
          `自分の行動が3回目までなら${atkMult(scaled(1.7, 0.06, level), stats)}。`,
          `それ以降は${atkMult(scaled(0.75, 0.02, level), stats)}。`,
          dualMultGrowth(1.7, 0.06, 0.75, 0.02, level),
        ];
      },
      use(ctx, level) {
        const early = ctx.player.actionCount <= 3;
        const mult = early ? scaled(1.7, 0.06, level) : scaled(0.75, 0.02, level);
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
      blurb: "崩甲より防御低下は大きいが、ダメージはほぼない。",
      tradeoff: "単体では削れない。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 1, def: 2, atkEff: 0.02 }),
      describe(level, stats) {
        const down = scaled(0.38, 0.02, level);
        const next = scaled(0.38, 0.02, level + 1);
        return [
          multText(0.55, 0.025, level, stats),
          `敵の防御力を${pctNowLabel(down)}下げる（敵の4行動）。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.02)
          )}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.55, 0.025, level));
        ctx.addEffect(ctx.enemy, {
          id: "rift",
          kind: "defPct",
          value: -scaled(0.38, 0.02, level),
          turns: 4,
          negative: true,
        });
        ctx.log(`${ctx.p}裂甲。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}防御を大きく下げた。`, "attack");
      },
    },
    {
      id: "plague",
      name: "疫刃",
      group: "崩し",
      blurb: "毒刃より長い毒。直後の威力はさらに低い。",
      tradeoff: "短期決戦ではほぼ役に立たない。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 2, speed: 2, healEff: -0.02 }),
      describe(level, stats) {
        const ratio = scaled(0.32, 0.02, level);
        const next = scaled(0.32, 0.02, level + 1);
        return [
          multText(0.55, 0.025, level, stats),
          `7行動のあいだ、行動ごとに${atkMult(ratio, stats)}の毒。${growthTail(
            `×${next.toFixed(2)}`,
            "0.02"
          )}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.55, 0.025, level));
        const dot = Math.max(1, Math.floor(ctx.effectiveAtk(ctx.player) * scaled(0.32, 0.02, level)));
        ctx.addEffect(ctx.enemy, {
          id: "plague",
          kind: "dot",
          value: dot,
          turns: 7,
          negative: true,
        });
        ctx.log(`${ctx.p}疫刃。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}長い毒が回る。`, "attack");
      },
    },
    {
      id: "sap",
      name: "削気",
      group: "崩し",
      blurb: "敵の攻撃力を下げる。",
      tradeoff: "ダメージは弱い。刺客向き。",
      cooldown: 3,
      gain: gain({ maxHp: 4, def: 3, defEff: 0.02 }),
      describe(level, stats) {
        const down = scaled(0.3, 0.02, level);
        const next = scaled(0.3, 0.02, level + 1);
        return [
          multText(0.75, 0.03, level, stats),
          `敵の攻撃力を${pctNowLabel(down)}下げる（敵の4行動）。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.02)
          )}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.75, 0.03, level));
        ctx.addEffect(ctx.enemy, {
          id: "sap",
          kind: "atkPct",
          value: -scaled(0.3, 0.02, level),
          turns: 4,
          negative: true,
        });
        ctx.log(`${ctx.p}削気。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}攻撃力を下げた。`, "attack");
      },
    },
    {
      id: "expose",
      name: "露呈",
      group: "崩し",
      blurb: "敵の被ダメージ軽減を下げ、少し削る。",
      tradeoff: "軽減がない相手にはただの弱い攻撃。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 2, dmgBonus: 0.008 }),
      describe(level, stats) {
        const down = scaled(0.22, 0.015, level);
        const next = scaled(0.22, 0.015, level + 1);
        return [
          multText(0.9, 0.035, level, stats),
          `敵の被ダメージ軽減を${pctNowLabel(down)}下げる（敵の4行動）。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.015)
          )}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.9, 0.035, level));
        ctx.addEffect(ctx.enemy, {
          id: "expose",
          kind: "dr",
          value: -scaled(0.22, 0.015, level),
          turns: 4,
          negative: true,
        });
        ctx.log(`${ctx.p}露呈。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}守りを開いた。`, "attack");
      },
    },
    {
      id: "silence",
      name: "封脈",
      group: "崩し",
      blurb: "枯渇より短いが、即時ダメージはやや高い。",
      tradeoff: "再生しない相手には過剰。",
      cooldown: 2,
      gain: gain({ maxHp: 2, atk: 2, regenAmount: 1 }),
      describe(level, stats) {
        return [multText(0.9, 0.035, level, stats), "敵の自動回復を、敵の2行動のあいだ止める。"];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.9, 0.035, level));
        ctx.addEffect(ctx.enemy, {
          id: "silence",
          kind: "noRegen",
          value: 1,
          turns: 2,
          negative: true,
        });
        ctx.log(`${ctx.p}封脈。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}自動回復を短く封じた。`, "attack");
      },
    },
    {
      id: "mark",
      name: "印刻",
      group: "崩し",
      blurb: "弱体を付けたあと、弱点と組むための印。",
      tradeoff: "単独では弱い。",
      cooldown: 2,
      gain: gain({ maxHp: 1, atk: 2, speed: 3 }),
      describe(level, stats) {
        return [multText(0.8, 0.03, level, stats), "敵に攻撃低下を付ける（敵の3行動）。弱体判定に乗る。"];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.8, 0.03, level));
        ctx.addEffect(ctx.enemy, {
          id: "mark",
          kind: "atkPct",
          value: -scaled(0.18, 0.015, level),
          turns: 3,
          negative: true,
        });
        ctx.log(`${ctx.p}印刻。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}印を刻んだ。`, "attack");
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
      name: "鏡面",
      group: "守り",
      blurb: "反射より返しは弱いが、軽減はやや厚い。",
      tradeoff: "一度返すと解ける。",
      cooldown: 3,
      gain: gain({ maxHp: 4, def: 4, speed: 2 }),
      describe(level, stats) {
        const ratio = scaled(0.35, 0.02, level);
        const next = scaled(0.35, 0.02, level + 1);
        return [
          "次に受ける打撃を28%軽減し、軽減後の一部を返す。",
          `返しの割合は${pctNowLabel(ratio)}。${growthTail(pctNowLabel(next), pctStepLabel(0.02))}`,
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "mirror",
          kind: "reflect",
          value: scaled(0.35, 0.02, level),
          reduction: 0.28,
          once: true,
          turns: 3,
        });
        ctx.log(`${ctx.p}鏡面。次の一撃を受ける構えを取った。`, "buff");
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
      name: "息吹",
      group: "回復",
      blurb: "体力がかなり減ったときだけ戻す。",
      tradeoff: "条件が厳しい。余裕があるときは使えない。",
      cooldown: 6,
      gain: gain({ maxHp: 5, healEff: 0.01, speed: -2 }),
      available(ctx) {
        return ctx.player.hp / ctx.player.maxHp <= 0.35;
      },
      describe(level, stats) {
        return [
          "体力35%以下のときだけ。",
          healPctText(0.12, 0.005, level, stats),
        ];
      },
      use(ctx, level) {
        const healed = ctx.heal(ctx.player, ctx.player.maxHp * scaled(0.12, 0.005, level));
        const got = healed.got;
        ctx.log(`${ctx.p}息吹。体力が${got}回復した。${ctx.overNote(healed.over)}`, "heal");
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
      name: "鋭気",
      group: "補助",
      blurb: "集中より弱いが、通常攻撃にも乗る一時強化。",
      tradeoff: "技専用の集中には単発で負ける。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 2, speed: 2, atkEff: 0.02 }),
      describe(level, stats) {
        return [
          `次の3行動、${atkBuffText(0.18, 0.012, level, stats)}`,
          "通常攻撃にも乗る。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "keen",
          kind: "atkPct",
          value: scaled(0.18, 0.012, level),
          turns: 3,
          scale: "atk",
        });
        ctx.log(`${ctx.p}鋭気。刃が軽く研がれた。`, "buff");
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
        const per = scaled(0.012, 0.004, level);
        const nextPer = scaled(0.012, 0.004, level + 1);
        const regen = stats ? Math.max(0, stats.regenAmount || 0) : 0;
        const rate = Math.min(0.55, regen * per);
        const flat =
          stats && rate > 0
            ? Math.floor(Math.max(1, stats.atk) * rate * (stats.atkEff || 1))
            : null;
        return [
          `次の2行動、自動回復量×${per.toFixed(3)}分の攻撃力上昇（上限55%、攻撃力補助効率も乗る）${
            flat != null ? `。今なら+${pctNowLabel(rate)}(+${flat})` : ""
          }。`,
          growthTail(`係数${nextPer.toFixed(3)}`, "0.004"),
          "この行動では攻撃しない。",
        ];
      },
      use(ctx, level) {
        const per = scaled(0.012, 0.004, level);
        const rate = Math.min(0.55, Math.max(0, ctx.player.regenAmount || 0) * per);
        if (rate > 0) {
          ctx.addEffect(ctx.player, {
            id: "cycle",
            kind: "atkPct",
            value: rate,
            turns: 2,
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
      tradeoff: "回復しない相手には弱い崩しにすぎない。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 2, def: 1, regenAmount: 1 }),
      describe(level, stats) {
        const down = scaled(0.28, 0.04, level);
        const next = scaled(0.28, 0.04, level + 1);
        return [
          multText(0.72, 0.03, level, stats),
          `敵の回復効率を${pctNowLabel(down)}下げる（敵の4行動）。即時・自動・再生すべてに掛かる。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.04)
          )}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.72, 0.03, level));
        ctx.addEffect(ctx.enemy, {
          id: "corrodeheal",
          kind: "healDown",
          value: Math.min(0.85, scaled(0.28, 0.04, level)),
          turns: 4,
          negative: true,
        });
        ctx.log(
          `${ctx.p}蝕癒。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}回復の効きを腐らせた。`,
          "attack"
        );
      },
    },
    {
      id: "drytide",
      name: "干潟",
      group: "崩し",
      blurb: "長く自動回復を封じる。枯渇より間が長い。",
      tradeoff: "即時ダメージはかなり薄い。再生しない相手には過剰。",
      cooldown: 4,
      gain: gain({ maxHp: 4, atk: 1, def: 2, regenAmount: 1 }),
      describe(level, stats) {
        return [
          multText(0.48, 0.025, level, stats),
          "敵の自動回復を、敵の6行動のあいだ止める。",
          "継続回復そのものは消さない。止めたあいだだけ働かない。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.48, 0.025, level));
        ctx.addEffect(ctx.enemy, {
          id: "drytide",
          kind: "noRegen",
          value: 1,
          turns: 6,
          negative: true,
        });
        ctx.log(
          `${ctx.p}干潟。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}泉を干した。`,
          "attack"
        );
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
      blurb: "敵の自動回復量を削り、自分の脈へ少し回す。",
      tradeoff: "削る量は固定寄り。回復しない相手には弱い。",
      cooldown: 3,
      gain: gain({ maxHp: 4, atk: 1, regenAmount: 2, healEff: 0.01 }),
      describe(level, stats) {
        const sap = Math.max(1, Math.floor(scaled(4, 1.2, level)));
        const nextSap = Math.max(1, Math.floor(scaled(4, 1.2, level + 1)));
        const selfFlat = scaled(2, 0.8, level);
        const nextFlat = scaled(2, 0.8, level + 1);
        return [
          multText(0.58, 0.03, level, stats),
          `敵の自動回復量を${sap}削る（敵の4行動）。下限0。${growthTail(`${nextSap}`, "1.2")}`,
          `次の3行動、自分の自動回復量+${selfFlat.toFixed(1)}。${growthTail(`+${nextFlat.toFixed(1)}`, "0.8")}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.58, 0.03, level));
        const sap = Math.max(1, Math.floor(scaled(4, 1.2, level)));
        ctx.addEffect(ctx.enemy, {
          id: "stealpulse",
          kind: "regenSap",
          value: sap,
          turns: 4,
          negative: true,
        });
        ctx.addEffect(ctx.player, {
          id: "stealpulse-self",
          kind: "regenFlat",
          value: scaled(2, 0.8, level),
          turns: 3,
        });
        ctx.log(
          `${ctx.p}奪脈。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}脈を奪った。`,
          "attack"
        );
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
      name: "拮抗",
      group: "攻撃",
      blurb: "互いの体力割合が近いときだけ鋭くなる。",
      tradeoff: "差が開くと一気に弱くなる。手順で体力差を見る技。",
      cooldown: 2,
      gain: gain({ maxHp: 3, atk: 3, atkEff: 0.02, speed: 1 }),
      describe(level, stats) {
        const close = scaled(1.82, 0.07, level);
        const far = scaled(0.6, 0.02, level);
        return [
          `体力割合の差が20%以内なら${atkMult(close, stats)}。`,
          `差が20%を超えるなら${atkMult(far, stats)}。`,
          dualMultGrowth(1.82, 0.07, 0.6, 0.02, level),
        ];
      },
      use(ctx, level) {
        const pRate = ctx.player.hp / ctx.player.maxHp;
        const eRate = ctx.enemy.hp / ctx.enemy.maxHp;
        const close = Math.abs(pRate - eRate) <= 0.2;
        const mult = close ? scaled(1.82, 0.07, level) : scaled(0.6, 0.02, level);
        const r = ctx.damage(mult);
        ctx.log(
          `${ctx.p}拮抗。${close ? "互角の刃が交差し、" : "差が開きすぎて、"}${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}`,
          "attack"
        );
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
      tradeoff: "すぐには削れない。倒す前に爆発しないと取りこぼす。",
      cooldown: 4,
      gain: gain({ maxHp: 3, atk: 3, def: 1, dmgBonus: 0.01 }),
      describe(level, stats) {
        const hit = scaled(0.55, 0.03, level);
        const boom = scaled(2.1, 0.15, level);
        const delay = Math.max(2, Math.floor(scaled(3, -0.25, level)));
        return [
          `軽い一撃（${atkMult(hit, stats)}）と同時に終焔の印を付与する。`,
          `敵の行動がおよそ${delay}回終わると印が弾け、${atkMult(boom, stats)}相当の爆発が起きる。`,
          "打ち直すと爆発倍率は更新され、残り時間も振り直される。",
          growthTail(
            `一撃×${scaled(0.55, 0.03, level + 1).toFixed(2)}／爆発×${scaled(2.1, 0.15, level + 1).toFixed(2)}`,
            "0.03／0.15"
          ),
        ];
      },
      use(ctx, level) {
        const hit = scaled(0.55, 0.03, level);
        const boom = scaled(2.1, 0.15, level);
        const delay = Math.max(2, Math.floor(scaled(3, -0.25, level)));
        const r = ctx.damage(hit);
        ctx.addEffect(ctx.enemy, {
          id: "doommark",
          kind: "doom",
          mult: boom,
          stored: 0,
          value: boom,
          turns: delay,
          negative: true,
        });
        ctx.log(
          `${ctx.p}終焔。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}終末の印を押した。`,
          "attack"
        );
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
      blurb: "敵の行動速度を落とす。速い相手へのメタ。",
      tradeoff: "すでに遅い相手にはご褒美が薄い。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 2, speed: 3 }),
      describe(level, stats) {
        return [
          multText(0.75, 0.03, level, stats),
          `敵の次の4行動、${speedBuffText(-0.2, -0.025, level)}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.75, 0.03, level));
        ctx.addEffect(ctx.enemy, {
          id: "fetter",
          kind: "speedPct",
          value: -scaled(0.2, 0.025, level),
          turns: 4,
          negative: true,
        });
        ctx.log(
          `${ctx.p}足枷。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}動きが鈍った。`,
          "attack"
        );
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
      name: "鈍律",
      group: "崩し",
      blurb: "敵の攻撃力補助効率を削り、バフ型を鈍らせる。",
      tradeoff: "敵がバフを使わないと効果が薄い。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 2, def: 1 }),
      describe(level, stats) {
        return [
          multText(0.78, 0.03, level, stats),
          `敵の次の4行動、${flatEffText("攻撃力補助効率", -0.2, -0.025, level)}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.78, 0.03, level));
        ctx.addEffect(ctx.enemy, {
          id: "dullhex",
          kind: "atkEffFlat",
          value: -scaled(0.2, 0.025, level),
          turns: 4,
          negative: true,
        });
        ctx.log(
          `${ctx.p}鈍律。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}刃が鈍った。`,
          "attack"
        );
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
      name: "脆律",
      group: "崩し",
      blurb: "敵の防御力補助効率を削り、守りバフを効きにくくする。",
      tradeoff: "敵が守りを張らないと恩恵が薄い。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 2, def: 2 }),
      describe(level, stats) {
        return [
          multText(0.78, 0.03, level, stats),
          `敵の次の4行動、${flatEffText("防御力補助効率", -0.2, -0.025, level)}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.78, 0.03, level));
        ctx.addEffect(ctx.enemy, {
          id: "frailty",
          kind: "defEffFlat",
          value: -scaled(0.2, 0.025, level),
          turns: 4,
          negative: true,
        });
        ctx.log(
          `${ctx.p}脆律。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}守りが脆くなった。`,
          "attack"
        );
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
      name: "療削",
      group: "崩し",
      blurb: "敵の体力回復効率そのものを削る。",
      tradeoff: "回復しない相手には弱い崩し。",
      cooldown: 3,
      gain: gain({ maxHp: 3, atk: 2, regenAmount: 1 }),
      describe(level, stats) {
        return [
          multText(0.72, 0.03, level, stats),
          `敵の次の4行動、${flatEffText("体力回復効率", -0.22, -0.03, level)}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.72, 0.03, level));
        ctx.addEffect(ctx.enemy, {
          id: "healsap",
          kind: "healEffFlat",
          value: -scaled(0.22, 0.03, level),
          turns: 4,
          negative: true,
        });
        ctx.log(
          `${ctx.p}療削。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}回復の効きを削った。`,
          "attack"
        );
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
      blurb: "敵の与ダメージ補正を下げ、打撃を軽くする。",
      tradeoff: "防御を上げるわけではない。",
      cooldown: 3,
      gain: gain({ maxHp: 4, def: 2, dmgReduction: 0.008 }),
      describe(level, stats) {
        return [
          multText(0.7, 0.03, level, stats),
          `敵の次の4行動、${dmgBonusText(-0.14, -0.02, level)}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.7, 0.03, level));
        ctx.addEffect(ctx.enemy, {
          id: "enfeeble",
          kind: "dmgBonus",
          value: -scaled(0.14, 0.02, level),
          turns: 4,
          negative: true,
        });
        ctx.log(
          `${ctx.p}無力。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}打撃が軽くなった。`,
          "attack"
        );
      },
    },
    {
      id: "ironveil",
      name: "鉄膜",
      group: "守り",
      blurb: "被ダメージ軽減を直接押し上げる薄い鉄の膜。",
      tradeoff: "防御力バフではない。重ねすぎると頭打ちしやすい。",
      cooldown: 4,
      gain: gain({ maxHp: 5, def: 2, dmgReduction: 0.015 }),
      describe(level) {
        const now = scaled(0.12, 0.015, level);
        const next = scaled(0.12, 0.015, level + 1);
        return [
          `次の4行動、被ダメージ軽減+${pctNowLabel(now)}。${growthTail(
            `+${pctNowLabel(next)}`,
            pctStepLabel(0.015)
          )}`,
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "ironveil",
          kind: "dr",
          value: scaled(0.12, 0.015, level),
          turns: 4,
        });
        ctx.log(`${ctx.p}鉄膜。薄い鉄が肌を覆った。`, "buff");
      },
    },
    {
      id: "rendveil",
      name: "裂膜",
      group: "崩し",
      blurb: "敵の被ダメージ軽減を大きく引き剥がす。負の領域まで落とせる。",
      tradeoff: "敵の軽減がもともと低いと伸びしろは限られる。",
      cooldown: 3,
      gain: gain({ maxHp: 2, atk: 3, dmgBonus: 0.008 }),
      describe(level, stats) {
        const down = scaled(0.2, 0.02, level);
        const next = scaled(0.2, 0.02, level + 1);
        return [
          multText(0.85, 0.03, level, stats),
          `敵の被ダメージ軽減を${pctNowLabel(down)}下げる（敵の4行動）。下限はさらに低い負の領域まで。${growthTail(
            pctNowLabel(next),
            pctStepLabel(0.02)
          )}`,
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.85, 0.03, level));
        ctx.addEffect(ctx.enemy, {
          id: "rendveil",
          kind: "dr",
          value: -scaled(0.2, 0.02, level),
          turns: 4,
          negative: true,
        });
        ctx.log(
          `${ctx.p}裂膜。${ctx.enemy.name}に${r.dmg}のダメージ。${ctx.overNote(r.over)}防護の膜を裂いた。`,
          "attack"
        );
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
})(typeof window !== "undefined" ? window : globalThis);
