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

  function multText(base, step, level) {
    const now = scaled(base, step, level);
    const next = scaled(base, step, level + 1);
    return `威力は攻撃×${now.toFixed(2)}。次の強化で×${next.toFixed(2)}（+${step.toFixed(2)}）`;
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
      describe(level) {
        return [multText(1.16, 0.04, level), "使用後、1行動あけると再使用できる。"];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(1.16, 0.04, level));
        ctx.log(`${ctx.p}斬撃。${ctx.enemy.name}に${r.dmg}のダメージ。`, "attack");
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
      describe(level) {
        return [multText(1.28, 0.05, level), "使用後、1行動あけると再使用できる。", "体が速くなる代わりに、守りは伸びない。"];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(1.28, 0.05, level));
        ctx.log(`${ctx.p}連撃。${ctx.enemy.name}に${r.dmg}のダメージ。`, "attack");
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
      describe(level) {
        return [multText(1.72, 0.06, level), "使用後、3行動あけると再使用できる。"];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(1.72, 0.06, level));
        ctx.log(`${ctx.p}強打。${ctx.enemy.name}に${r.dmg}のダメージ。`, "attack");
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
      describe(level) {
        const ignore = Math.min(0.6, scaled(0.28, 0.01, level));
        return [
          multText(1.22, 0.05, level),
          `敵の防御を${Math.round(ignore * 100)}%無視する。次は+1%。`,
          "使用後、3行動あけると再使用できる。",
        ];
      },
      use(ctx, level) {
        const ignore = Math.min(0.6, scaled(0.28, 0.01, level));
        const r = ctx.damage(scaled(1.22, 0.05, level), { ignore });
        ctx.log(`${ctx.p}貫打。防御を貫き、${ctx.enemy.name}に${r.dmg}のダメージ。`, "attack");
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
      describe(level) {
        return [
          `敵の体力が50%未満なら攻撃×${scaled(1.68, 0.06, level).toFixed(2)}。`,
          `それ以外は攻撃×${scaled(0.62, 0.02, level).toFixed(2)}。`,
          "強化しても、得意な条件と苦手な条件の差は埋まらない。",
        ];
      },
      use(ctx, level) {
        const low = ctx.enemy.hp / ctx.enemy.maxHp < 0.5;
        const mult = low ? scaled(1.68, 0.06, level) : scaled(0.62, 0.02, level);
        const r = ctx.damage(mult);
        ctx.log(
          `${ctx.p}追撃。${low ? "隙を突いて" : "手応えは薄く、"}${ctx.enemy.name}に${r.dmg}のダメージ。`,
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
      describe(level) {
        const full = scaled(0.5, 0.02, level);
        const empty = full + scaled(1.2, 0.05, level);
        return [
          `満タン時は攻撃×${full.toFixed(2)}。体力が尽きかけたとき最大×${empty.toFixed(2)}。`,
          "減っている体力の割合だけ、威力が一定幅で上乗せされる。",
        ];
      },
      use(ctx, level) {
        const missing = 1 - ctx.player.hp / ctx.player.maxHp;
        const mult = scaled(0.5, 0.02, level) + missing * scaled(1.2, 0.05, level);
        const r = ctx.damage(mult);
        ctx.log(`${ctx.p}背水。${ctx.enemy.name}に${r.dmg}のダメージ。`, "attack");
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
      describe(level) {
        const cost = scaled(0.08, 0.003, level);
        return [
          multText(2.02, 0.08, level),
          `自分の最大体力の${Math.round(cost * 1000) / 10}%を失う。防御無視や軽減は乗らない。`,
          "習得のたびに防御が下がり、受けるダメージも増える。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(2.02, 0.08, level));
        const cost = ctx.hurt(ctx.player, ctx.player.maxHp * scaled(0.08, 0.003, level), "self");
        ctx.log(`${ctx.p}捨て身。${ctx.enemy.name}に${r.dmg}のダメージ。自分も${cost}削った。`, "attack");
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
      describe(level) {
        const ratio = scaled(0.34, 0.015, level);
        return [
          multText(1.02, 0.04, level),
          `与ダメージの${Math.round(ratio * 100)}%を基礎に回復する。回復効率がさらにかかる。`,
        ];
      },
      use(ctx, level) {
        const ratio = scaled(0.34, 0.015, level);
        const r = ctx.damage(scaled(1.02, 0.04, level));
        const got = ctx.heal(ctx.player, r.dmg * ratio);
        ctx.log(`${ctx.p}吸血。${ctx.enemy.name}に${r.dmg}のダメージ。${got}回復した。`, "attack");
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
      describe(level) {
        return [
          `直前の行動が技なら攻撃×${scaled(1.52, 0.05, level).toFixed(2)}。`,
          `通常攻撃の直後なら攻撃×${scaled(0.7, 0.02, level).toFixed(2)}。`,
          "手順の並びで強さが変わる。",
        ];
      },
      use(ctx, level) {
        const follow = ctx.player.lastAction === "skill";
        const mult = follow ? scaled(1.52, 0.05, level) : scaled(0.7, 0.02, level);
        const r = ctx.damage(mult);
        ctx.log(
          `${ctx.p}連技。${follow ? "流れに乗って" : "間が空いて"}${ctx.enemy.name}に${r.dmg}のダメージ。`,
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
      describe(level) {
        return [
          `敵の防御が自分の攻撃以上なら、攻撃×${scaled(1.58, 0.06, level).toFixed(2)}かつ防御20%無視。`,
          `そうでなければ攻撃×${scaled(0.88, 0.025, level).toFixed(2)}。`,
        ];
      },
      use(ctx, level) {
        const tank = ctx.effectiveDef(ctx.enemy) >= ctx.effectiveAtk(ctx.player);
        const mult = tank ? scaled(1.58, 0.06, level) : scaled(0.88, 0.025, level);
        const r = ctx.damage(mult, { ignore: tank ? 0.22 : 0 });
        ctx.log(
          `${ctx.p}破城。${tank ? "硬い守りを砕き、" : "手応えは軽く、"}${ctx.enemy.name}に${r.dmg}のダメージ。`,
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
      describe(level) {
        const down = scaled(0.16, 0.01, level);
        return [
          multText(0.78, 0.03, level),
          `敵の防御の働きを${Math.round(down * 100)}%下げる（敵の3行動）。`,
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
        ctx.log(`${ctx.p}崩甲。${ctx.enemy.name}に${r.dmg}のダメージ。防御の働きを下げた。`, "attack");
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
      describe(level) {
        return [
          `敵が弱体中なら攻撃×${scaled(1.86, 0.07, level).toFixed(2)}。`,
          `何もなければ攻撃×${scaled(0.8, 0.02, level).toFixed(2)}。`,
        ];
      },
      use(ctx, level) {
        const debuffed = ctx.hasDebuff(ctx.enemy);
        const mult = debuffed ? scaled(1.86, 0.07, level) : scaled(0.8, 0.02, level);
        const r = ctx.damage(mult);
        ctx.log(
          `${ctx.p}弱点。${debuffed ? "隙を広げて" : "狙いが外れ、"}${ctx.enemy.name}に${r.dmg}のダメージ。`,
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
      describe(level) {
        const ratio = scaled(0.26, 0.02, level);
        return [
          multText(0.5, 0.025, level),
          `その後、敵は4行動のあいだ行動ごとに攻撃×${ratio.toFixed(2)}の毒を受ける。`,
          "毒は重ねがけせず、打ち直すと残りが更新される。",
        ];
      },
      use(ctx, level) {
        const r = ctx.damage(scaled(0.5, 0.025, level));
        const dot = Math.max(1, Math.round(ctx.effectiveAtk(ctx.player) * scaled(0.26, 0.02, level)));
        ctx.addEffect(ctx.enemy, {
          id: "venom",
          kind: "dot",
          value: dot,
          turns: 4,
          negative: true,
        });
        ctx.log(`${ctx.p}毒刃。${ctx.enemy.name}に${r.dmg}のダメージ。毒が回る。`, "attack");
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
      describe(level) {
        return [
          multText(0.64, 0.03, level),
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
        ctx.log(`${ctx.p}枯渇。${ctx.enemy.name}に${r.dmg}のダメージ。自動回復を封じた。`, "attack");
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
      describe(level) {
        const rate = scaled(0.42, 0.02, level);
        return [
          `次の3行動、防御の働き+${Math.round(rate * 100)}%。防御力補助効率がさらにかかる。`,
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
        ctx.log(`${ctx.p}鉄身。防御の働きが上がった。`, "buff");
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
      describe(level) {
        const rate = scaled(0.26, 0.015, level);
        return [
          `次の2行動、受けるダメージを${Math.round(rate * 100)}%減らす。`,
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
      describe(level) {
        const ratio = scaled(0.5, 0.03, level);
        return [
          "次に受ける打撃を22%軽減し、軽減後の55%前後を相手へ返す。",
          `返しの割合は今${Math.round(ratio * 100)}%。3行動以内に受けなければ消える。`,
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
      describe(level) {
        const rate = scaled(0.5, 0.02, level);
        return [
          "現在体力の13%を払い、次の3行動、防御の働きを大きく上げる。",
          `上昇の基礎は+${Math.round(rate * 100)}%。防御力補助効率がさらにかかる。`,
          "体力が32%以下のときは手順にあっても飛ばされる。",
        ];
      },
      use(ctx, level) {
        const cost = ctx.hurt(ctx.player, ctx.player.hp * 0.13, "self");
        ctx.addEffect(ctx.player, {
          id: "blood",
          kind: "defPct",
          value: scaled(0.5, 0.02, level),
          turns: 3,
          scale: "def",
        });
        ctx.log(`${ctx.p}血誓。${cost}を払い、防御の働きが上がった。`, "buff");
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
      describe(level) {
        const rate = scaled(0.15, 0.008, level);
        return [
          `最大体力の${Math.round(rate * 1000) / 10}%を基礎に、すぐ回復する。`,
          "回復効率がさらにかかる。",
        ];
      },
      use(ctx, level) {
        const got = ctx.heal(ctx.player, ctx.player.maxHp * scaled(0.15, 0.008, level));
        ctx.log(`${ctx.p}応急。体力が${got}回復した。`, "heal");
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
      describe(level) {
        const each = scaled(0.055, 0.004, level);
        return [
          `4行動にわたり、行動ごとに最大体力の${Math.round(each * 1000) / 10}%を基礎に回復する。`,
          "打ち直すと残り時間は更新される。回復効率がかかる。",
        ];
      },
      use(ctx, level) {
        const each = Math.max(1, Math.round(ctx.player.maxHp * scaled(0.055, 0.004, level)));
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
      describe(level) {
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
      describe(level) {
        const rate = scaled(0.09, 0.005, level);
        return [
          "自分の弱体をすべて消す。",
          `最大体力の${Math.round(rate * 1000) / 10}%を基礎に回復する。`,
          "弱体を1つでも消したときは、さらに最大体力の7%が基礎に加わる。",
        ];
      },
      use(ctx, level) {
        const removed = ctx.cleanse(ctx.player);
        const rate = scaled(0.09, 0.005, level) + (removed > 0 ? 0.07 : 0);
        const got = ctx.heal(ctx.player, ctx.player.maxHp * rate);
        ctx.log(
          `${ctx.p}浄化。${removed > 0 ? `弱体を${removed}つ払い、` : ""}体力が${got}回復した。`,
          "heal"
        );
      },
    },
    {
      id: "rally",
      name: "鼓舞",
      group: "補助",
      blurb: "しばらく攻撃の働きが上がる。一撃の伸びは集中より小さい。",
      tradeoff: "通常攻撃にも乗るが、捨て身のような単発は集中に劣る。",
      cooldown: 3,
      gain: gain({ maxHp: 4, atk: 1, def: 2, atkEff: 0.03, speed: 2 }),
      describe(level) {
        const rate = scaled(0.22, 0.015, level);
        return [
          `次の3行動、攻撃の働き+${Math.round(rate * 100)}%。攻撃力補助効率がさらにかかる。`,
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
        ctx.log(`${ctx.p}鼓舞。攻撃の働きが上がった。`, "buff");
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
      describe(level) {
        const rate = scaled(0.42, 0.03, level);
        return [
          `次に出す攻撃技の威力を${Math.round(rate * 100)}%上乗せする。`,
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
      describe(level) {
        return [
          "次の3行動の終わりに、他の技の再使用カウントが余分に1進む。",
          "ダメージはない。レベルが上がっても加速の中身は同じで、伸びるのは基礎ステータスだけ。",
        ];
      },
      use(ctx) {
        ctx.addEffect(ctx.player, {
          id: "haste",
          kind: "cdHaste",
          value: 1,
          turns: 3,
        });
        ctx.log(`${ctx.p}加速。技の再使用が早まる。`, "buff");
      },
    },
  ];

  const GROUPS = ["攻撃", "崩し", "守り", "回復", "補助"];
  const BY_ID = {};
  SKILLS.forEach((skill) => {
    BY_ID[skill.id] = skill;
  });

  const STAT_KEYS = Object.keys(BASE_STATS);

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
    stats.maxHp = Math.max(40, Math.round(stats.maxHp));
    stats.atk = Math.max(1, Math.round(stats.atk));
    stats.def = Math.max(0, Math.round(stats.def));
    stats.regenInterval = Math.max(1, Math.round(stats.regenInterval));
    stats.regenAmount = Math.max(0, Math.round(stats.regenAmount));
    stats.healEff = Math.max(0.25, stats.healEff);
    stats.atkEff = Math.max(0.25, stats.atkEff);
    stats.defEff = Math.max(0.25, stats.defEff);
    stats.speed = Math.max(50, Math.round(stats.speed));
    stats.dmgReduction = Math.max(-0.3, Math.min(0.45, stats.dmgReduction));
    return stats;
  }

  function skillCost(currentLevel) {
    return 3 + (currentLevel || 0);
  }

  W.BASE_STATS = BASE_STATS;
  W.SKILLS = SKILLS;
  W.SKILL_GROUPS = GROUPS;
  W.SKILL_BY_ID = BY_ID;
  W.computeStats = computeStats;
  W.skillCost = skillCost;
  W.scaled = scaled;
})(typeof window !== "undefined" ? window : globalThis);
