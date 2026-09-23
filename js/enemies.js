(function (root) {
  const W = root.Wot || (root.Wot = {});

  /**
   * 1〜3層は導入用に弱め。以後は急勾配。
   * 素の能力のままでは中盤以降すぐ落ち、100層は育成と手順が必須。
   */
  const CURVE = {
    bossHp: 1.38,
    bossAtk: 1.28,
    bossDef: 1.2,
  };

  const KEYS = [
    { f: 1, hp: 58, atk: 7, def: 3 },
    { f: 3, hp: 78, atk: 11, def: 5 },
    { f: 6, hp: 150, atk: 19, def: 10 },
    { f: 10, hp: 280, atk: 30, def: 15 },
    { f: 20, hp: 720, atk: 40, def: 24 },
    { f: 35, hp: 1400, atk: 46, def: 32 },
    { f: 50, hp: 2400, atk: 50, def: 38 },
    { f: 70, hp: 4200, atk: 54, def: 46 },
    { f: 85, hp: 6500, atk: 58, def: 54 },
    { f: 100, hp: 11000, atk: 62, def: 64 },
  ];

  function growth(floor) {
    const f = Math.max(1, Math.min(100, floor));
    if (f <= KEYS[0].f) return { hp: KEYS[0].hp, atk: KEYS[0].atk, def: KEYS[0].def };
    for (let i = 1; i < KEYS.length; i += 1) {
      const a = KEYS[i - 1];
      const b = KEYS[i];
      if (f <= b.f) {
        const t = (f - a.f) / (b.f - a.f);
        const ease = t * t * (3 - 2 * t);
        return {
          hp: a.hp + (b.hp - a.hp) * ease,
          atk: a.atk + (b.atk - a.atk) * ease,
          def: a.def + (b.def - a.def) * ease,
        };
      }
    }
    const last = KEYS[KEYS.length - 1];
    return { hp: last.hp, atk: last.atk, def: last.def };
  }

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
      atk: 1.55,
      def: 0.55,
      speed: 122,
      regenInterval: 6,
      regenPct: 0,
    },
    {
      id: "regen",
      name: "苔巨人",
      badge: "再生",
      hint: "自動で体力を戻す。削り切る前に回復される。",
      special: "2行動ごとに、大きく自動回復する。",
      hp: 1.22,
      atk: 0.82,
      def: 1.08,
      speed: 86,
      regenInterval: 2,
      regenPct: 0.055,
    },
    {
      id: "venom",
      name: "毒針虫",
      badge: "毒",
      hint: "打撃は軽く、毒でじわじわ削る。",
      special: "3行動ごとに毒を付与する。",
      hp: 0.9,
      atk: 0.84,
      def: 0.82,
      speed: 106,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      id: "berserk",
      name: "狂戦士",
      badge: "狂戦",
      hint: "体力が減るほど打撃が重くなる。",
      special: "傷ついているほど、次の攻撃が強くなる。",
      hp: 1.05,
      atk: 1.08,
      def: 0.74,
      speed: 104,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      id: "warden",
      name: "門番",
      badge: "堅守",
      hint: "体力と防御が高い。動きは遅い。",
      special: "体力が半分近くまで減ると、守りを固める。",
      hp: 1.4,
      atk: 0.8,
      def: 1.5,
      speed: 76,
      regenInterval: 4,
      regenPct: 0,
    },
    {
      id: "hex",
      name: "呪術師",
      badge: "呪",
      hint: "攻撃力と回復の効きを落とす呪いを使う。",
      special: "4行動ごとに、攻撃と回復効率を下げる。",
      hp: 0.88,
      atk: 1.0,
      def: 0.8,
      speed: 102,
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
    const g = growth(floor);
    const hpMul = arch.hp * (boss ? CURVE.bossHp : 1);
    const atkMul = arch.atk * (boss ? CURVE.bossAtk : 1);
    const defMul = arch.def * (boss ? CURVE.bossDef : 1);
    const maxHp = Math.max(1, Math.round(g.hp * hpMul));
    const atk = Math.max(1, Math.round(g.atk * atkMul));
    const def = Math.max(0, Math.round(g.def * defMul));
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
  W.enemyGrowth = growth;
  W.ARCHETYPES = ARCHETYPES;
  W.archetypeForFloor = archetypeForFloor;
  W.createEnemy = createEnemy;
})(typeof window !== "undefined" ? window : globalThis);
