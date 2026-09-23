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
          "強化しても、得意な条件と苦手な条件の差は埋まらない。",
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
        return [
          `満タン時は${atkMult(full, stats)}。体力が尽きかけたとき${atkMult(empty, stats).replace("攻撃×", "最大×")}。`,
          "減っている体力の割合だけ、威力が一定幅で上乗せされる。",
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
        return [
          multText(2.02, 0.08, level, stats),
          `自分の最大体力の${maxHpPct(cost, stats)}を失う。防御無視や軽減は乗らない。`,
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
      tradeoff: "硬い敵には回復量が落ちる。応急のような安定はない。",
      cooldown: 2,
      gain: gain({ maxHp: 4, atk: 2, healEff: 0.02 }),
      describe(level, stats) {
        const ratio = scaled(0.34, 0.015, level);
        return [
          multText(1.02, 0.04, level, stats),
          `与ダメージの${Math.floor(ratio * 100)}%を基礎に回復する。回復効率がさらにかかる。`,
        ];
      },
      use(ctx, level) {
        const ratio = scaled(0.34, 0.015, level);
        const r = ctx.damage(scaled(1.02, 0.04, level));
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
          "手順の並びで強さが変わる。",
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
        const down = scaled(0.16, 0.01, level);
        return [
          multText(0.78, 0.03, level, stats),
          `敵の防御力を${Math.floor(down * 100)}%下げる（敵の3行動）。`,
          "この低下に、自分の補助効率は乗らない。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.78, 0.03, level));
        const down = scaled(0.16, 0.01, level);
        ctx.addEffect(ctx.enemy, {
          id: "sunder",
          kind: "defPct",
          value: -down,
          turns: 3,
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
          `敵が弱体中なら${atkMult(scaled(1.86, 0.07, level), stats)}。`,
          `何もなければ${atkMult(scaled(0.8, 0.02, level), stats)}。`,
        ];
      },
      use(ctx, level) {
        const debuffed = ctx.hasDebuff(ctx.enemy);
        const mult = debuffed ? scaled(1.86, 0.07, level) : scaled(0.8, 0.02, level);
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
        const ratio = scaled(0.26, 0.02, level);
        return [
          multText(0.5, 0.025, level, stats),
          `その後、敵は4行動のあいだ行動ごとに${atkMult(ratio, stats)}の毒を受ける。`,
          "毒は重ねがけせず、打ち直すと残りが更新される。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.5, 0.025, level));
        const dot = Math.max(1, Math.floor(ctx.effectiveAtk(ctx.player) * scaled(0.26, 0.02, level)));
        ctx.addEffect(ctx.enemy, {
          id: "venom",
          kind: "dot",
          value: dot,
          turns: 4,
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
        const rate = scaled(0.42, 0.02, level);
        return [
          `次の3行動、一時的な防御力+${Math.floor(rate * 100)}%（防御力補助効率も乗る）。`,
          "この行動では攻撃しない。",
        ];
      },
      use(ctx, level) {
        const rate = scaled(0.42, 0.02, level);
        ctx.addEffect(ctx.player, {
          id: "guard",
          kind: "defPct",
          value: rate,
          turns: 3,
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
        const rate = scaled(0.26, 0.015, level);
        return [
          `次の2行動、受けるダメージを${Math.floor(rate * 100)}%減らす。`,
          "軽減は防御計算のあとでかかる。上限75%。",
        ];
      },
      use(ctx, level) {
        const rate = scaled(0.26, 0.015, level);
        ctx.addEffect(ctx.player, {
          id: "fortress",
          kind: "dr",
          value: rate,
          turns: 2,
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
        return [
          "次に受ける打撃を22%軽減し、軽減後の55%前後を相手へ返す。",
          `返しの割合は今${Math.floor(ratio * 100)}%。3行動以内に受けなければ消える。`,
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
        const rate = scaled(0.5, 0.02, level);
        return [
          "現在体力の13%を払い、次の3行動、防御力を大きく上げる。",
          `上昇の基礎は+${Math.floor(rate * 100)}%（防御力補助効率も乗る）。`,
          "体力が32%以下のときは手順にあっても飛ばされる。",
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
      blurb: "その場で体力を戻す。総量は再生より少ない。",
      tradeoff: "今すぐ足りるが、長い戦いでは再生や脈動に総量で負ける。",
      cooldown: 3,
      gain: gain({ maxHp: 10, def: 1, healEff: 0.04 }),
      describe(level, stats) {
        const rate = scaled(0.15, 0.008, level);
        return [
          `最大体力の${maxHpPct(rate, stats)}を基礎に、すぐ回復する。`,
          "回復効率がさらにかかる。",
        ];
      },
      use(ctx, level) {
        const healed = ctx.heal(ctx.player, ctx.player.maxHp * scaled(0.15, 0.008, level));
        const got = healed.got;
        ctx.log(`${ctx.p}応急。体力が${got}回復した。${ctx.overNote(healed.over)}`, "heal");
      },
    },
    {
      id: "weave",
      name: "再生",
      group: "回復",
      blurb: "時間をかけて大きく回復する。今すぐ足りないときには遅い。",
      tradeoff: "総量は応急より多いが、途中で倒れると取りこぼす。攻撃力は下がる。",
      cooldown: 4,
      gain: gain({ maxHp: 8, atk: -1, def: 1, regenAmount: 2, healEff: 0.02 }),
      describe(level, stats) {
        const each = scaled(0.055, 0.004, level);
        return [
          `4行動にわたり、行動ごとに最大体力の${maxHpPct(each, stats)}を基礎に回復する。`,
          "打ち直すと残り時間は更新される。回復効率がかかる。",
        ];
      },
      use(ctx, level) {
        const each = Math.max(1, Math.floor(ctx.player.maxHp * scaled(0.055, 0.004, level)));
        ctx.addEffect(ctx.player, {
          id: "weave",
          kind: "hot",
          value: each,
          turns: 4,
        });
        ctx.log(`${ctx.p}再生。傷がゆっくり塞がり始める。`, "heal");
      },
    },
    {
      id: "pulse",
      name: "脈動",
      group: "回復",
      blurb: "しばらく自動回復が増える。短い戦いでは間に合わない。",
      tradeoff: "即時回復はない。行動速度がわずかに落ちる。",
      cooldown: 3,
      gain: gain({ maxHp: 6, def: 1, regenAmount: 2, regenInterval: -1, speed: -1 }),
      describe(level, stats) {
        const extra = scaled(6, 1, level);
        return [
          `次の4行動、自動回復量+${extra}。`,
          "習得のたびに自動回復の間隔が1行動短くなる。間隔は1行動より短くならない。",
        ];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "pulse",
          kind: "regenFlat",
          value: scaled(6, 1, level),
          turns: 4,
        });
        ctx.log(`${ctx.p}脈動。自動回復が強くなった。`, "heal");
      },
    },
    {
      id: "purify",
      name: "浄化",
      group: "回復",
      blurb: "弱体を払い、少し回復する。何も受けていなければ応急に劣る。",
      tradeoff: "毒や呪いに強い。何もない戦いでは回復量が足りない。",
      cooldown: 3,
      gain: gain({ maxHp: 7, def: 2, healEff: 0.03 }),
      describe(level, stats) {
        const rate = scaled(0.09, 0.005, level);
        return [
          "自分の弱体をすべて消す。",
          `最大体力の${maxHpPct(rate, stats)}を基礎に回復する。`,
          "弱体を1つでも消したときは、さらに最大体力の7%が基礎に加わる。",
        ];
      },
      use(ctx, level) {
        const removed = ctx.cleanse(ctx.player);
        const rate = scaled(0.09, 0.005, level) + (removed > 0 ? 0.07 : 0);
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
        const rate = scaled(0.22, 0.015, level);
        return [
          `次の3行動、一時的な攻撃力+${Math.floor(rate * 100)}%（攻撃力補助効率も乗る）。`,
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
        const rate = scaled(0.42, 0.03, level);
        return [
          `次に出す攻撃技の威力を${Math.floor(rate * 100)}%上乗せする。`,
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
      blurb: "しばらく技の再使用が早まる。自身はダメージを与えない。",
      tradeoff: "行動速度そのものは連撃ほど上がらない。技の回転だけが速くなる。",
      cooldown: 4,
      gain: gain({ maxHp: 3, atk: 1, speed: 9 }),
      describe(level, stats) {
        return [
          "効果中、自分の行動が終わるたびに、他の技の待ちが「1」ではなく「2」進む（空き回数があと少なくなる）。",
          "自分へのダメージはない。レベルでは加速の強さは変わらず、伸びるのは基礎ステータスだけ。",
        ];
      },
      use(ctx) {
        ctx.addEffect(ctx.player, {
          id: "haste",
          kind: "cdHaste",
          value: 1,
          turns: 3,
        });
        ctx.log(`${ctx.p}加速。技の待ちが進みやすくなる。`, "buff");
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
        return [multText(1.35, 0.05, level, stats), "敵の防御を45%無視する。"];
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
      tradeoff: "通らない相手では回復も薄い。",
      cooldown: 2,
      gain: gain({ maxHp: 5, atk: 1, healEff: 0.03 }),
      describe(level, stats) {
        const ratio = scaled(0.48, 0.02, level);
        return [multText(0.88, 0.03, level, stats), `与ダメージの${Math.floor(ratio * 100)}%を基礎に回復する。`];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.88, 0.03, level));
        const healed = ctx.heal(ctx.player, r.dmg * scaled(0.48, 0.02, level));
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
        const down = scaled(0.24, 0.012, level);
        return [multText(0.4, 0.02, level, stats), `敵の防御力を${Math.floor(down * 100)}%下げる（敵の3行動）。`];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.4, 0.02, level));
        ctx.addEffect(ctx.enemy, {
          id: "rift",
          kind: "defPct",
          value: -scaled(0.24, 0.012, level),
          turns: 3,
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
        const ratio = scaled(0.2, 0.015, level);
        return [multText(0.35, 0.02, level, stats), `6行動のあいだ、行動ごとに${atkMult(ratio, stats)}の毒。`];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.35, 0.02, level));
        const dot = Math.max(1, Math.floor(ctx.effectiveAtk(ctx.player) * scaled(0.2, 0.015, level)));
        ctx.addEffect(ctx.enemy, {
          id: "plague",
          kind: "dot",
          value: dot,
          turns: 6,
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
        const down = scaled(0.18, 0.01, level);
        return [multText(0.55, 0.025, level, stats), `敵の攻撃力を${Math.floor(down * 100)}%下げる（敵の3行動）。`];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.55, 0.025, level));
        ctx.addEffect(ctx.enemy, {
          id: "sap",
          kind: "atkPct",
          value: -scaled(0.18, 0.01, level),
          turns: 3,
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
        const down = scaled(0.12, 0.01, level);
        return [multText(0.7, 0.03, level, stats), `敵の被ダメージ軽減を${Math.floor(down * 100)}%下げる（敵の3行動）。`];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.7, 0.03, level));
        ctx.addEffect(ctx.enemy, {
          id: "expose",
          kind: "dr",
          value: -scaled(0.12, 0.01, level),
          turns: 3,
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
        return [multText(0.6, 0.025, level, stats), "敵に軽微な攻撃低下を付ける（敵の2行動）。弱体判定に乗る。"];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.6, 0.025, level));
        ctx.addEffect(ctx.enemy, {
          id: "mark",
          kind: "atkPct",
          value: -scaled(0.08, 0.005, level),
          turns: 2,
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
        const rate = scaled(0.55, 0.025, level);
        return [`次の2行動、一時的な防御力+${Math.floor(rate * 100)}%。`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "bulwark",
          kind: "defPct",
          value: scaled(0.55, 0.025, level),
          turns: 2,
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
        const rate = scaled(0.2, 0.012, level);
        return [`次の3行動、受けるダメージを${Math.floor(rate * 100)}%減らす。`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "aegis",
          kind: "dr",
          value: scaled(0.2, 0.012, level),
          turns: 3,
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
        return [
          "次に受ける打撃を28%軽減し、軽減後の一部を返す。",
          `返しの割合は${Math.floor(scaled(0.35, 0.02, level) * 100)}%。`,
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
        const rate = scaled(0.35, 0.02, level);
        return [
          `体力が45%以下のときだけ使える。次の2行動、被ダメージ-${Math.floor(rate * 100)}%。`,
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
      id: "salve",
      name: "軟膏",
      group: "回復",
      blurb: "応急より軽い即時回復。再使用は早い。",
      tradeoff: "大きな穴は塞げない。",
      cooldown: 2,
      gain: gain({ maxHp: 6, healEff: 0.03 }),
      describe(level, stats) {
        const rate = scaled(0.09, 0.006, level);
        return [`最大体力の${maxHpPct(rate, stats)}を基礎にすぐ回復する。`];
      },
      use(ctx, level) {
        const healed = ctx.heal(ctx.player, ctx.player.maxHp * scaled(0.09, 0.006, level));
        const got = healed.got;
        ctx.log(`${ctx.p}軟膏。体力が${got}回復した。${ctx.overNote(healed.over)}`, "heal");
      },
    },
    {
      id: "bloom",
      name: "芽吹き",
      group: "回復",
      blurb: "再生より短い継続回復。",
      tradeoff: "総量は再生に負ける。",
      cooldown: 3,
      gain: gain({ maxHp: 5, def: 1, regenAmount: 1, healEff: 0.02 }),
      describe(level, stats) {
        const each = scaled(0.07, 0.005, level);
        return [`3行動にわたり、行動ごとに最大体力の${maxHpPct(each, stats)}を基礎に回復する。`];
      },
      use(ctx, level) {
        const each = Math.max(1, Math.floor(ctx.player.maxHp * scaled(0.07, 0.005, level)));
        ctx.addEffect(ctx.player, {
          id: "bloom",
          kind: "hot",
          value: each,
          turns: 3,
        });
        ctx.log(`${ctx.p}芽吹き。短い再生が始まった。`, "heal");
      },
    },
    {
      id: "tide",
      name: "潮汐",
      group: "回復",
      blurb: "脈動より強い自動回復増強。速度は下がる。",
      tradeoff: "即時回復はない。",
      cooldown: 4,
      gain: gain({ maxHp: 7, regenAmount: 3, speed: -3 }),
      describe(level, stats) {
        return [`次の5行動、自動回復量+${scaled(8, 1.2, level).toFixed(0)}。`];
      },
      use(ctx, level) {
        ctx.addEffect(ctx.player, {
          id: "tide",
          kind: "regenFlat",
          value: scaled(8, 1.2, level),
          turns: 5,
        });
        ctx.log(`${ctx.p}潮汐。自動回復が大きくなった。`, "heal");
      },
    },
    {
      id: "cleanse",
      name: "祓い",
      group: "回復",
      blurb: "浄化より回復は少ないが、弱体除去は同じ。",
      tradeoff: "弱体がないと応急に負ける。",
      cooldown: 2,
      gain: gain({ maxHp: 5, def: 1, healEff: 0.02 }),
      describe(level, stats) {
        const rate = scaled(0.05, 0.004, level);
        return [
          "自分の弱体をすべて消す。",
          `最大体力の${maxHpPct(rate, stats)}を基礎に回復。弱体を消したとき+5%。`,
        ];
      },
      use(ctx, level) {
        const removed = ctx.cleanse(ctx.player);
        const rate = scaled(0.05, 0.004, level) + (removed > 0 ? 0.05 : 0);
        const healed = ctx.heal(ctx.player, ctx.player.maxHp * rate);
        const got = healed.got;
        ctx.log(
          `${ctx.p}祓い。${removed > 0 ? `弱体を${removed}つ払い、` : ""}体力が${got}回復した。${ctx.overNote(healed.over)}`,
          "heal"
        );
      },
    },
    {
      id: "secondwind",
      name: "息吹",
      group: "回復",
      blurb: "体力が半分以下のときだけ大きく戻す。",
      tradeoff: "余裕があるときは使えない。",
      cooldown: 4,
      gain: gain({ maxHp: 9, healEff: 0.04 }),
      available(ctx) {
        return ctx.player.hp / ctx.player.maxHp <= 0.5;
      },
      describe(level, stats) {
        const rate = scaled(0.22, 0.01, level);
        return [`体力50%以下のときだけ。最大体力の${maxHpPct(rate, stats)}を基礎に回復する。`];
      },
      use(ctx, level) {
        const healed = ctx.heal(ctx.player, ctx.player.maxHp * scaled(0.22, 0.01, level));
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
        const rate = scaled(0.3, 0.02, level);
        return [`次の2行動、一時的な攻撃力+${Math.floor(rate * 100)}%。`];
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
        const rate = scaled(0.18, 0.012, level);
        return [`次の3行動、一時的な攻撃力+${Math.floor(rate * 100)}%。通常攻撃にも乗る。`];
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
      blurb: "加速より短い再使用促進。",
      tradeoff: "ダメージはない。",
      cooldown: 3,
      gain: gain({ maxHp: 2, speed: 7, atk: 1 }),
      describe(level, stats) {
        return [
          "効果中、自分の行動が終わるたびに、他の技の待ちが「1」ではなく「2」進む。",
          "加速より短い。レベルでは拍子の強さは変わらない。",
        ];
      },
      use(ctx) {
        ctx.addEffect(ctx.player, {
          id: "tempo",
          kind: "cdHaste",
          value: 1,
          turns: 2,
        });
        ctx.log(`${ctx.p}拍子。技の待ちが少し早く進む。`, "buff");
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

  function computeStats(levels) {
    const stats = { ...BASE_STATS };
    Object.keys(levels || {}).forEach((id) => {
      const level = levels[id] || 0;
      const skill = BY_ID[id];
      if (!skill || level <= 0) return;
      STAT_KEYS.forEach((key) => {
        stats[key] += (skill.gain[key] || 0) * level;
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
    stats.dmgReduction = Math.max(-0.3, Math.min(0.45, stats.dmgReduction));
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
  W.computeStats = computeStats;
  W.rollOffer = rollOffer;
  W.scaled = scaled;
  W.overNote = overNote;
  W.maxHpPct = maxHpPct;
  W.atkMult = atkMult;
  W.cooldownReuseText = cooldownReuseText;
  W.cooldownShort = cooldownShort;
})(typeof window !== "undefined" ? window : globalThis);
