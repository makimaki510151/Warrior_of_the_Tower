(function (root) {
  const W = root.Wot || (root.Wot = {});

  const CURVE = {
    hpBase: 52,
    hpPer: 12.5,
    hpQuad: 0.2,
    atkBase: 6.5,
    atkPer: 0.92,
    atkQuad: 0.014,
    defBase: 2.5,
    defPer: 0.62,
    defQuad: 0.007,
    bossHp: 1.3,
    bossAtk: 1.18,
    bossDef: 1.1,
  };

  const ARCHETYPES = [
    {
      id: "soldier",
      name: "塔兵",
      badge: "均衡",
      hint: "攻守のバランスが取れている。大きな癖はない。",
      special: "通常の打撃を繰り返す。",
      hp: 1,
      atk: 1,
      def: 1,
      speed: 100,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      id: "armor",
      name: "石像兵",
      badge: "重装",
      hint: "防御が厚く、打点は軽い。",
      special: "3行動ごとに防御を固める。",
      hp: 1.12,
      atk: 0.74,
      def: 1.85,
      speed: 88,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      id: "assassin",
      name: "影殺し",
      badge: "刺客",
      hint: "体力は低いが、打撃が鋭い。",
      special: "3行動ごとに重い一撃を振るう。",
      hp: 0.72,
      atk: 1.48,
      def: 0.55,
      speed: 118,
      regenInterval: 6,
      regenPct: 0,
    },
    {
      id: "regen",
      name: "苔巨人",
      badge: "再生",
      hint: "自動で体力を戻す。削り切る前に回復される。",
      special: "2行動ごとに、大きく自動回復する。",
      hp: 1.18,
      atk: 0.8,
      def: 1.05,
      speed: 86,
      regenInterval: 2,
      regenPct: 0.042,
    },
    {
      id: "venom",
      name: "毒針虫",
      badge: "毒",
      hint: "打撃は軽く、毒でじわじわ削る。",
      special: "3行動ごとに毒を付与する。",
      hp: 0.9,
      atk: 0.8,
      def: 0.82,
      speed: 104,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      id: "berserk",
      name: "狂戦士",
      badge: "狂戦",
      hint: "体力が減るほど打撃が重くなる。",
      special: "傷ついているほど、次の攻撃が強くなる。",
      hp: 1.02,
      atk: 1.02,
      def: 0.74,
      speed: 102,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      id: "warden",
      name: "門番",
      badge: "堅守",
      hint: "体力と防御が高い。動きは遅い。",
      special: "体力が半分近くまで減ると、守りを固める。",
      hp: 1.34,
      atk: 0.78,
      def: 1.42,
      speed: 78,
      regenInterval: 4,
      regenPct: 0,
    },
    {
      id: "hex",
      name: "呪術師",
      badge: "呪",
      hint: "攻撃力と回復の効きを落とす呪いを使う。",
      special: "4行動ごとに、攻撃と回復効率を下げる。",
      hp: 0.86,
      atk: 0.96,
      def: 0.78,
      speed: 100,
      regenInterval: 5,
      regenPct: 0,
    },
  ];

  /** 階層 n の敵は常に同じ。並びは ARCHETYPES を (n-1) で巡回し、10の倍数は番人化。 */
  function archetypeForFloor(floor) {
    return ARCHETYPES[(floor - 1) % ARCHETYPES.length];
  }

  function createEnemy(floor) {
    const arch = archetypeForFloor(floor);
    const boss = floor % 10 === 0;
    const hpMul = arch.hp * (boss ? CURVE.bossHp : 1);
    const atkMul = arch.atk * (boss ? CURVE.bossAtk : 1);
    const defMul = arch.def * (boss ? CURVE.bossDef : 1);
    const maxHp = Math.max(
      1,
      Math.round((CURVE.hpBase + CURVE.hpPer * floor + CURVE.hpQuad * floor * floor) * hpMul)
    );
    const atk = Math.max(
      1,
      Math.round((CURVE.atkBase + CURVE.atkPer * floor + CURVE.atkQuad * floor * floor) * atkMul)
    );
    const def = Math.max(
      0,
      Math.round((CURVE.defBase + CURVE.defPer * floor + CURVE.defQuad * floor * floor) * defMul)
    );
    const regenAmount = arch.regenPct ? Math.max(1, Math.round(maxHp * arch.regenPct)) : 0;
    const bossLine = "数行動ごとに、通常より重い一撃を振るう。";
    return {
      floor,
      pattern: arch.id,
      boss,
      name: boss ? `第${floor}階層の番人` : arch.name,
      badge: boss ? "番人" : arch.badge,
      hint: boss ? `${arch.hint}${bossLine}` : arch.hint,
      special: boss ? `${arch.special}${bossLine}` : arch.special,
      maxHp,
      atk,
      def,
      regenInterval: arch.regenInterval,
      regenAmount,
      healEff: 1,
      atkEff: 1,
      defEff: 1,
      speed: arch.speed,
      dmgBonus: 0,
      dmgReduction: 0,
    };
  }

  W.CURVE = CURVE;
  W.ARCHETYPES = ARCHETYPES;
  W.archetypeForFloor = archetypeForFloor;
  W.createEnemy = createEnemy;
})(typeof window !== "undefined" ? window : globalThis);
