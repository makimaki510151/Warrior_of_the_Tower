(function (root) {
  const W = root.Wot || (root.Wot = {});

  const TOWER_HEIGHT = 30;
  const SCALE_STEP = 0.5;

  /**
   * 成長曲線: 序盤は緩やか。30階の素値（倍率前）は旧30階前後をやや上回り、
   * hp 約1600 / atk 約50 / def 約36 を狙う。
   */
  const KEYS = [
    { f: 1, hp: 55, atk: 7, def: 3 },
    { f: 5, hp: 98, atk: 12, def: 6 },
    { f: 10, hp: 210, atk: 21, def: 11 },
    { f: 15, hp: 400, atk: 30, def: 17 },
    { f: 20, hp: 720, atk: 38, def: 24 },
    { f: 25, hp: 1120, atk: 44, def: 30 },
    { f: 30, hp: 1600, atk: 50, def: 36 },
  ];

  function growth(floor) {
    const f = Math.max(1, Math.min(TOWER_HEIGHT, floor));
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

  /**
   * 階層ごとに1体。pattern は戦闘AIの識別子。
   * hp/atk/def は成長曲線への倍率。regenPct は素の最大HP比（スケール前）。
   */
  const FLOOR_FOES = [
    {
      floor: 1,
      pattern: "trainee",
      name: "塔の見習い",
      badge: "見習",
      hint: "まだ型が浅い。素直な打撃だけを繰り返す。",
      specials: ["通常の打撃を繰り返す。"],
      hp: 1,
      atk: 1,
      def: 1,
      speed: 100,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      floor: 2,
      pattern: "stoneguard",
      name: "石像兵",
      badge: "重装",
      hint: "防御が厚く、打点は軽い。",
      specials: ["3行動ごとに身を固める。"],
      hp: 1.1,
      atk: 0.78,
      def: 1.7,
      speed: 88,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      floor: 3,
      pattern: "shadowcut",
      name: "影切り",
      badge: "刺客",
      hint: "体力は低いが、間を置いて急所を突く。",
      specials: ["3行動ごとに重い急所狙い。"],
      hp: 0.74,
      atk: 1.48,
      def: 0.58,
      speed: 120,
      regenInterval: 6,
      regenPct: 0,
    },
    {
      floor: 4,
      pattern: "mossgolem",
      name: "苔巨人",
      badge: "再生",
      hint: "自動で体力を戻す。削り切る前に回復される。",
      specials: ["2行動ごとに大きく自動回復する。"],
      hp: 1.2,
      atk: 0.84,
      def: 1.05,
      speed: 86,
      regenInterval: 2,
      regenPct: 0.05,
    },
    {
      floor: 5,
      pattern: "needlebug",
      name: "毒針虫",
      badge: "毒",
      hint: "打撃は軽いが、毒でじわじわ削る。",
      specials: ["3行動ごとに毒を付与する。"],
      hp: 0.92,
      atk: 0.86,
      def: 0.84,
      speed: 106,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      floor: 6,
      pattern: "madblade",
      name: "狂刃",
      badge: "狂戦",
      hint: "体力が減るほど打撃が重くなる。",
      specials: ["傷ついているほど次の攻撃が強くなる。"],
      hp: 1.05,
      atk: 1.1,
      def: 0.72,
      speed: 104,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      floor: 7,
      pattern: "gatekeep",
      name: "門番",
      badge: "堅守",
      hint: "体力と防御が高い。窮地で守りを起こす。",
      specials: ["体力が50%以下になると守りを固める。"],
      hp: 1.35,
      atk: 0.82,
      def: 1.45,
      speed: 78,
      regenInterval: 4,
      regenPct: 0,
    },
    {
      floor: 8,
      pattern: "cursechant",
      name: "呪言師",
      badge: "呪",
      hint: "攻撃力と回復の効きを落とす呪いを使う。",
      specials: ["4行動ごとに攻撃と回復効率を下げる。"],
      hp: 0.9,
      atk: 1.0,
      def: 0.82,
      speed: 102,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      floor: 9,
      pattern: "drumfist",
      name: "連槌兵",
      badge: "連打",
      hint: "単発を捨て、リズムよく二連で押す。",
      specials: ["3行動ごとに二段連打を振るう。"],
      hp: 0.95,
      atk: 1.05,
      def: 0.88,
      speed: 112,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      floor: 10,
      pattern: "tenthward",
      name: "第十の番人",
      badge: "番人",
      hint: "中盤への門。守りを足してから重い一発を落とす。",
      specials: ["2行動周期: 防壁→番人の一撃。"],
      hp: 1.25,
      atk: 1.05,
      def: 1.35,
      speed: 84,
      regenInterval: 4,
      regenPct: 0,
      dmgReduction: 0.04,
    },
    {
      floor: 11,
      pattern: "bloodsip",
      name: "血啜り",
      badge: "吸血",
      hint: "与えた傷の一部を自分の体力に変える。",
      specials: ["打撃のたびに与ダメージの一部を回復する。"],
      hp: 1.05,
      atk: 1.12,
      def: 0.9,
      speed: 108,
      regenInterval: 5,
      regenPct: 0,
      healEff: 1.1,
    },
    {
      floor: 12,
      pattern: "armorcrush",
      name: "鎧裂き",
      badge: "破防",
      hint: "防御を貫き、こちらの守りを削る。",
      specials: ["3行動ごとに防御無視の一撃と防御低下。"],
      hp: 0.96,
      atk: 1.14,
      def: 0.95,
      speed: 100,
      regenInterval: 5,
      regenPct: 0,
      dmgBonus: 0.03,
    },
    {
      floor: 13,
      pattern: "prayer",
      name: "塔の僧",
      badge: "僧兵",
      hint: "自らを癒やしながら戦う。再生封じが効く。",
      specials: ["3行動ごとに大きく自己回復する。"],
      hp: 1.12,
      atk: 0.9,
      def: 1.08,
      speed: 92,
      regenInterval: 3,
      regenPct: 0.028,
      healEff: 1.12,
    },
    {
      floor: 14,
      pattern: "galeblade",
      name: "風刃",
      badge: "連撃",
      hint: "速い二連撃で押してくる。",
      specials: ["3行動ごとに二段の連撃を振るう。"],
      hp: 0.86,
      atk: 1.06,
      def: 0.72,
      speed: 126,
      regenInterval: 6,
      regenPct: 0,
    },
    {
      floor: 15,
      pattern: "glassmirror",
      name: "鏡面士",
      badge: "反射",
      hint: "一撃を跳ね返す構えを取る。",
      specials: ["4行動ごとに次の被弾を反射する構えに入る。"],
      hp: 0.94,
      atk: 0.96,
      def: 1.12,
      speed: 98,
      regenInterval: 5,
      regenPct: 0,
      dmgReduction: 0.05,
    },
    {
      floor: 16,
      pattern: "rambeast",
      name: "衝角獣",
      badge: "突進",
      hint: "加速してから重い突進を落とす。",
      specials: ["3行動周期: 加速構え→軽い接触→衝角撃。"],
      hp: 1.15,
      atk: 1.08,
      def: 1.05,
      speed: 90,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      floor: 17,
      pattern: "rotcaller",
      name: "腐敗呼び",
      badge: "枯死",
      hint: "回復そのものを封じ、効きを腐らせる。",
      specials: ["4行動ごとに自動回復封じと回復効率低下。"],
      hp: 0.92,
      atk: 1.02,
      def: 0.86,
      speed: 104,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      floor: 18,
      pattern: "plaguefly",
      name: "疫羽",
      badge: "疫",
      hint: "頻繁に濃い毒を回す。",
      specials: ["2行動ごとに強い毒を付与する。"],
      hp: 1.0,
      atk: 0.92,
      def: 0.88,
      speed: 110,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      floor: 19,
      pattern: "frostbind",
      name: "霜枷",
      badge: "凍",
      hint: "足を止め、隙間に霜の刃を入れる。",
      specials: ["3行動周期: 凍てつき→霜刃→砕氷撃。"],
      hp: 1.0,
      atk: 1.05,
      def: 1.0,
      speed: 96,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      floor: 20,
      pattern: "ironward",
      name: "第二十の番人",
      badge: "鉄番",
      hint: "鉄壁を起こし、地響きで押し、仕上げを落とす。",
      specials: ["3行動周期: 鉄壁→地響き→番人圧。"],
      hp: 1.4,
      atk: 1.08,
      def: 1.55,
      speed: 76,
      regenInterval: 4,
      regenPct: 0,
      dmgReduction: 0.08,
      defEff: 1.08,
    },
    {
      floor: 21,
      pattern: "thornwall",
      name: "茨壁",
      badge: "茨",
      hint: "逆立→鞭→刺突。触れた相手に刺を残す。",
      specials: ["3行動周期: 茨逆立（反射）→茨鞭→鉄茨刺突。"],
      hp: 1.22,
      atk: 0.98,
      def: 1.48,
      speed: 86,
      regenInterval: 5,
      regenPct: 0,
      dmgReduction: 0.07,
      defEff: 1.1,
    },
    {
      floor: 22,
      pattern: "timesplit",
      name: "刻裂き",
      badge: "時",
      hint: "自分を早め、あなたを遅らせ、隙間に連撃を入れる。",
      specials: ["3行動周期: 加速歪み→足枷→時裂き二連。"],
      hp: 0.92,
      atk: 1.1,
      def: 0.82,
      speed: 118,
      regenInterval: 5,
      regenPct: 0,
      atkEff: 1.05,
    },
    {
      floor: 23,
      pattern: "soulshear",
      name: "魂裂き",
      badge: "魂裂",
      hint: "与ダメと補助効率を削ぎ、仕上げの裂撃を落とす。",
      specials: ["3行動周期: 魂削り→無力化→裂魂撃。"],
      hp: 1.05,
      atk: 1.16,
      def: 0.95,
      speed: 102,
      regenInterval: 5,
      regenPct: 0,
      dmgBonus: 0.04,
    },
    {
      floor: 24,
      pattern: "eclipseveil",
      name: "蝕の帳",
      badge: "蝕",
      hint: "霧で封じ、脈で戻り、蝕で削る長期戦殺し。",
      specials: ["4行動周期: 蝕の霧→再生脈→蝕撃→深蝕。"],
      hp: 1.28,
      atk: 1.1,
      def: 1.2,
      speed: 96,
      regenInterval: 2,
      regenPct: 0.045,
      healEff: 1.2,
      defEff: 1.08,
    },
    {
      floor: 25,
      pattern: "bloodmail",
      name: "血鎧兵",
      badge: "血装",
      hint: "血で吸い、怒り、装を纏う。瀕死で鉄壁化する。",
      specials: ["体力40%以下で血装発動。通常は吸命→血怒→血装殴打。"],
      hp: 1.25,
      atk: 1.12,
      def: 1.22,
      speed: 92,
      regenInterval: 3,
      regenPct: 0.022,
      healEff: 1.12,
      defEff: 1.08,
    },
    {
      floor: 26,
      pattern: "drainseer",
      name: "吸呪眼",
      badge: "吸呪",
      hint: "印→吸命→腐打→大呪。回復と攻撃バフを腐らせる。",
      specials: ["4行動周期で呪いと吸収を交互に掛ける。"],
      hp: 0.98,
      atk: 1.14,
      def: 0.9,
      speed: 110,
      regenInterval: 5,
      regenPct: 0,
      atkEff: 1.06,
      dmgBonus: 0.03,
    },
    {
      floor: 27,
      pattern: "phantomedge",
      name: "残像剣",
      badge: "幻影",
      hint: "残像で加速し、二連と急所で削るガラスの剣士。",
      specials: ["3行動周期: 残像構え→二連幻斬→急所幻撃。"],
      hp: 0.74,
      atk: 1.32,
      def: 0.58,
      speed: 138,
      regenInterval: 6,
      regenPct: 0,
      atkEff: 1.08,
      dmgBonus: 0.04,
    },
    {
      floor: 28,
      pattern: "siegecolossus",
      name: "攻城巨像",
      badge: "巨像",
      hint: "守りを起こしてから、地響き→踏み砕き→巨圧で潰す。",
      specials: ["4行動周期: 鉄壁→地響き→踏み砕き→巨圧。"],
      hp: 1.55,
      atk: 1.08,
      def: 1.75,
      speed: 66,
      regenInterval: 5,
      regenPct: 0,
      dmgReduction: 0.1,
      defEff: 1.12,
    },
    {
      floor: 29,
      pattern: "twinreaver",
      name: "双裂鬼",
      badge: "双剣",
      hint: "単発を捨て、常に二刀で押す。",
      specials: ["3行動周期: 双閃→交差連撃→終焉二閃。常に二段。"],
      hp: 0.9,
      atk: 1.2,
      def: 0.78,
      speed: 126,
      regenInterval: 6,
      regenPct: 0,
      dmgBonus: 0.05,
      atkEff: 1.12,
    },
    {
      floor: 30,
      pattern: "towerlord",
      name: "塔頂の覇者",
      badge: "覇者",
      hint: "目付け→昂揚→覇斬。削れた相手を決して逃さない塔の頂点。",
      specials: [
        "3行動周期: 死の目付け→覇の昂揚→覇斬。",
        "体力が低い相手ほど覇斬が重い。",
      ],
      hp: 1.08,
      atk: 1.18,
      def: 1.05,
      speed: 108,
      regenInterval: 4,
      regenPct: 0.015,
      dmgBonus: 0.06,
      atkEff: 1.1,
      healEff: 1.08,
    },
  ];

  const FOE_BY_FLOOR = Object.create(null);
  FLOOR_FOES.forEach((foe) => {
    FOE_BY_FLOOR[foe.floor] = foe;
  });

  function clampFloor(floor) {
    const n = Math.floor(Number(floor) || 1);
    return Math.max(1, Math.min(TOWER_HEIGHT, n));
  }

  function getFloorFoe(floor) {
    return FOE_BY_FLOOR[clampFloor(floor)];
  }

  function enemyScaleMul(scaleTier) {
    const t = Math.max(0, Math.floor(Number(scaleTier) || 0));
    return 1 + t * SCALE_STEP;
  }

  function createEnemy(floor, scaleTier) {
    const f = clampFloor(floor);
    const foe = getFloorFoe(f);
    const g = growth(f);
    const tier = Math.max(0, Math.floor(Number(scaleTier) || 0));
    const scaleMul = enemyScaleMul(tier);

    const baseMaxHp = Math.max(1, Math.round(g.hp * foe.hp));
    const baseAtk = Math.max(1, Math.round(g.atk * foe.atk));
    const baseDef = Math.max(0, Math.round(g.def * foe.def));
    const regenPct = foe.regenPct || 0;
    const baseRegen = regenPct ? Math.max(1, Math.round(baseMaxHp * regenPct)) : 0;

    return {
      floor: f,
      pattern: foe.pattern,
      boss: f % 10 === 0,
      buildTier: f,
      name: foe.name,
      badge: foe.badge,
      hint: foe.hint,
      specials: foe.specials.slice(),
      special: foe.specials.join(" "),
      maxHp: Math.max(1, Math.round(baseMaxHp * scaleMul)),
      atk: Math.max(1, Math.round(baseAtk * scaleMul)),
      def: Math.max(0, Math.round(baseDef * scaleMul)),
      regenInterval: foe.regenInterval,
      regenAmount: baseRegen ? Math.max(1, Math.round(baseRegen * scaleMul)) : 0,
      healEff: foe.healEff == null ? 1 : foe.healEff,
      atkEff: foe.atkEff == null ? 1 : foe.atkEff,
      defEff: foe.defEff == null ? 1 : foe.defEff,
      speed: foe.speed,
      dmgBonus: foe.dmgBonus || 0,
      dmgReduction: foe.dmgReduction || 0,
      scaleTier: tier,
      scalePct: Math.round((scaleMul - 1) * 100),
    };
  }

  function previewEnemy(floor, scaleTier) {
    const e = createEnemy(floor, scaleTier);
    return {
      name: e.name,
      badge: e.badge,
      hint: e.hint,
      specials: e.specials,
      maxHp: e.maxHp,
      atk: e.atk,
      def: e.def,
      speed: e.speed,
      regenInterval: e.regenInterval,
      regenAmount: e.regenAmount,
      scaleTier: e.scaleTier,
      scalePct: e.scalePct,
      floor: e.floor,
      pattern: e.pattern,
    };
  }

  W.TOWER_HEIGHT = TOWER_HEIGHT;
  W.SCALE_STEP = SCALE_STEP;
  W.FLOOR_FOES = FLOOR_FOES;
  W.enemyGrowth = growth;
  W.getFloorFoe = getFloorFoe;
  W.enemyScaleMul = enemyScaleMul;
  W.createEnemy = createEnemy;
  W.previewEnemy = previewEnemy;
})(typeof window !== "undefined" ? window : globalThis);
