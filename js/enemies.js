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

  /**
   * minFloor: この階層から出現プールに入る。
   * 30層以降はビルドの癖が強く、手順とメタ技が要る。
   * 50層以降は浅い層の均衡型を混ぜず、専用ローテで戦う。
   */
  const ARCHETYPES = [
    {
      id: "soldier",
      name: "塔兵",
      badge: "均衡",
      hint: "攻守のバランスが取れている。大きな癖はない。",
      special: "通常の打撃を繰り返す。",
      minFloor: 1,
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
      minFloor: 1,
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
      minFloor: 1,
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
      minFloor: 1,
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
      hint: "打撃は軽いが、毒でじわじわ削る。",
      special: "3行動ごとに毒を付与する。",
      minFloor: 1,
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
      minFloor: 1,
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
      special: "体力が50%以下になると、守りを固める。",
      minFloor: 1,
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
      minFloor: 1,
      hp: 0.88,
      atk: 1.0,
      def: 0.8,
      speed: 102,
      regenInterval: 5,
      regenPct: 0,
    },
    // ---- 30層以降 ----
    {
      id: "vampir",
      name: "血飲み",
      badge: "吸血",
      hint: "与えた傷の一部を自分の体力に変える。",
      special: "打撃のたびに、与ダメージの一部を回復する。",
      minFloor: 30,
      hp: 1.05,
      atk: 1.12,
      def: 0.9,
      speed: 108,
      regenInterval: 5,
      regenPct: 0,
      healEff: 1.1,
    },
    {
      id: "shatter",
      name: "破甲兵",
      badge: "破防",
      hint: "防御を貫き、こちらの守りを削る。",
      special: "3行動ごとに防御無視の一撃と、防御低下を付与する。",
      minFloor: 30,
      hp: 0.95,
      atk: 1.15,
      def: 0.95,
      speed: 100,
      regenInterval: 5,
      regenPct: 0,
      dmgBonus: 0.04,
    },
    {
      id: "priest",
      name: "塔僧",
      badge: "僧兵",
      hint: "自らを癒やしながら戦う。再生封じが効く。",
      special: "3行動ごとに大きく自己回復する。",
      minFloor: 30,
      hp: 1.15,
      atk: 0.88,
      def: 1.1,
      speed: 92,
      regenInterval: 3,
      regenPct: 0.03,
      healEff: 1.15,
    },
    {
      id: "storm",
      name: "嵐呼び",
      badge: "連撃",
      hint: "速い二連撃で押してくる。",
      special: "3行動ごとに二段の連撃を振るう。",
      minFloor: 30,
      hp: 0.85,
      atk: 1.05,
      def: 0.7,
      speed: 128,
      regenInterval: 6,
      regenPct: 0,
    },
    {
      id: "mirror",
      name: "鏡影",
      badge: "反射",
      hint: "一撃を跳ね返す構えを取る。",
      special: "4行動ごとに、次の被弾を反射する構えに入る。",
      minFloor: 30,
      hp: 0.92,
      atk: 0.95,
      def: 1.15,
      speed: 98,
      regenInterval: 5,
      regenPct: 0,
      dmgReduction: 0.05,
    },
    {
      id: "siege",
      name: "攻城獣",
      badge: "攻城",
      hint: "鈍いが、間を置いて重い一発を落とす。",
      special: "4行動ごとに、通常よりはるかに重い一撃。",
      minFloor: 30,
      hp: 1.35,
      atk: 1.05,
      def: 1.25,
      speed: 72,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      id: "abyss",
      name: "深淵使い",
      badge: "枯死",
      hint: "回復そのものを封じ、効きを腐らせる。",
      special: "4行動ごとに自動回復封じと回復効率低下を付与する。",
      minFloor: 30,
      hp: 0.9,
      atk: 1.02,
      def: 0.85,
      speed: 104,
      regenInterval: 5,
      regenPct: 0,
    },
    {
      id: "plaguebearer",
      name: "疫運び",
      badge: "疫",
      hint: "毒針虫より頻繁に、濃い毒を回す。",
      special: "2行動ごとに強い毒を付与する。",
      minFloor: 30,
      hp: 1.0,
      atk: 0.9,
      def: 0.88,
      speed: 110,
      regenInterval: 5,
      regenPct: 0,
    },
    // ---- 50層以降（専用ローテ・浅い層を混ぜない） ----
    {
      id: "colossus",
      name: "鉄巨像",
      badge: "巨像",
      hint: "守りを起こしてから、地響き→踏み砕き→巨圧の型で潰す。",
      special: "4行動周期: 鉄壁→地響き→踏み砕き→巨圧。無駄打ちはない。",
      minFloor: 50,
      hp: 1.7,
      atk: 1.05,
      def: 1.95,
      speed: 64,
      regenInterval: 5,
      regenPct: 0,
      dmgReduction: 0.12,
      defEff: 1.15,
    },
    {
      id: "phantom",
      name: "幻影剣",
      badge: "幻影",
      hint: "残像で加速し、二連と急所で削るガラスの剣士。",
      special: "3行動周期: 残像構え→二連幻斬→急所幻撃。",
      minFloor: 50,
      hp: 0.72,
      atk: 1.35,
      def: 0.55,
      speed: 142,
      regenInterval: 6,
      regenPct: 0,
      atkEff: 1.1,
      dmgBonus: 0.04,
    },
    {
      id: "bloodarmor",
      name: "血装兵",
      badge: "血装",
      hint: "血で吸い、怒り、装を纏う。瀕死で鉄壁化する。",
      special: "体力40%以下で血装発動。通常は吸命→血怒→血装殴打の周期。",
      minFloor: 50,
      hp: 1.28,
      atk: 1.12,
      def: 1.28,
      speed: 92,
      regenInterval: 3,
      regenPct: 0.025,
      healEff: 1.15,
      defEff: 1.1,
    },
    {
      id: "drainhex",
      name: "吸呪術師",
      badge: "吸呪",
      hint: "印→吸命→腐打→大呪。回復と攻撃バフを腐らせる。",
      special: "4行動周期で呪いと吸収を交互に掛ける。",
      minFloor: 50,
      hp: 0.98,
      atk: 1.15,
      def: 0.88,
      speed: 110,
      regenInterval: 5,
      regenPct: 0,
      atkEff: 1.08,
      dmgBonus: 0.03,
    },
    {
      id: "ironthorn",
      name: "鉄茨",
      badge: "茨",
      hint: "逆立→鞭→刺突。触れた相手に刺を残す。",
      special: "3行動周期: 茨逆立（反射）→茨鞭→鉄茨刺突。",
      minFloor: 50,
      hp: 1.25,
      atk: 0.98,
      def: 1.55,
      speed: 86,
      regenInterval: 5,
      regenPct: 0,
      dmgReduction: 0.08,
      defEff: 1.12,
    },
    {
      id: "chrono",
      name: "時歪み",
      badge: "時",
      hint: "自分を早め、あなたを遅らせ、隙間に連撃を入れる。",
      special: "3行動周期: 加速歪み→足枷→時裂き二連。",
      minFloor: 50,
      hp: 0.9,
      atk: 1.1,
      def: 0.8,
      speed: 118,
      regenInterval: 5,
      regenPct: 0,
      atkEff: 1.05,
    },
    {
      id: "soulrend",
      name: "魂裂き",
      badge: "魂裂",
      hint: "与ダメと補助効率を削ぎ、仕上げの裂撃を落とす。",
      special: "3行動周期: 魂削り→無力化→裂魂撃。",
      minFloor: 50,
      hp: 1.05,
      atk: 1.18,
      def: 0.95,
      speed: 102,
      regenInterval: 5,
      regenPct: 0,
      dmgBonus: 0.05,
    },
    // ---- 70層以降 ----
    {
      id: "eclipse",
      name: "蝕みの守護者",
      badge: "蝕",
      hint: "霧で封じ、脈で戻り、蝕で削る長期戦殺し。",
      special: "4行動周期: 蝕の霧→再生脈→蝕撃→深蝕。",
      minFloor: 70,
      hp: 1.4,
      atk: 1.12,
      def: 1.3,
      speed: 96,
      regenInterval: 2,
      regenPct: 0.055,
      healEff: 1.25,
      defEff: 1.1,
    },
    {
      id: "executioner",
      name: "処刑人",
      badge: "処刑",
      hint: "目付け→昂揚→処刑。削れた相手を決して逃さない。",
      special: "3行動周期: 死の目付け→処刑昂揚→処刑斬。",
      minFloor: 70,
      hp: 0.92,
      atk: 1.32,
      def: 0.88,
      speed: 118,
      regenInterval: 5,
      regenPct: 0,
      dmgBonus: 0.08,
      atkEff: 1.12,
    },
    {
      id: "bastion",
      name: "要塞核",
      badge: "要塞",
      hint: "核を顕し、壁を足し、核撃と制圧で押し切る。",
      special: "4行動周期: 要塞顕現→防壁補強→核撃→制圧。",
      minFloor: 70,
      hp: 1.55,
      atk: 0.98,
      def: 2.0,
      speed: 68,
      regenInterval: 3,
      regenPct: 0.02,
      dmgReduction: 0.14,
      defEff: 1.2,
    },
    {
      id: "twinblade",
      name: "双剣鬼",
      badge: "双剣",
      hint: "単発を捨て、常に二刀で押す。",
      special: "3行動周期: 双閃→交差連撃→終焉二閃。常に二段。",
      minFloor: 70,
      hp: 0.88,
      atk: 1.22,
      def: 0.75,
      speed: 128,
      regenInterval: 6,
      regenPct: 0,
      dmgBonus: 0.06,
      atkEff: 1.15,
    },
  ];

  function poolForFloor(floor) {
    const f = Math.max(1, floor || 1);
    let pool = ARCHETYPES.filter((arch) => (arch.minFloor || 1) <= f);
    // 50層以降は中深層専用ビルドのみ（浅い／中層のフィラー型を混ぜない）
    if (f >= 50) {
      pool = pool.filter((arch) => (arch.minFloor || 1) >= 50);
    }
    return pool;
  }

  /** 階層 n の敵は常に同じ。利用可能プールを (n-1) で巡回し、10の倍数は番人化。 */
  function archetypeForFloor(floor) {
    const pool = poolForFloor(floor);
    return pool[(floor - 1) % pool.length];
  }

  function createEnemy(floor) {
    const arch = archetypeForFloor(floor);
    const boss = floor % 10 === 0;
    const g = growth(floor);
    let late = 1;
    if (floor >= 70) late = 1.14 + Math.min(0.18, (floor - 70) * 0.004);
    else if (floor >= 50) late = 1.08 + Math.min(0.12, (floor - 50) * 0.003);
    else if (floor >= 30) late = 1 + Math.min(0.12, (floor - 30) * 0.0015);
    const hpMul = arch.hp * (boss ? CURVE.bossHp : 1) * late;
    const atkMul = arch.atk * (boss ? CURVE.bossAtk : 1) * late;
    const defMul = arch.def * (boss ? CURVE.bossDef : 1) * late;
    const maxHp = Math.max(1, Math.round(g.hp * hpMul));
    const atk = Math.max(1, Math.round(g.atk * atkMul));
    const def = Math.max(0, Math.round(g.def * defMul));
    const regenPct = arch.regenPct || 0;
    const regenAmount = regenPct ? Math.max(1, Math.round(maxHp * regenPct)) : 0;
    const buildTier = floor >= 70 ? 70 : floor >= 50 ? 50 : floor >= 30 ? 30 : 1;
    const bossLine = buildTier >= 50 ? "番人として型が一段重い。" : "数行動ごとに、通常より重い一撃を振るう。";
    const tierNote =
      buildTier >= 70 ? "（深層ローテ）" : buildTier >= 50 ? "（中深層ローテ）" : buildTier >= 30 ? "（中層ビルド）" : "";
    return {
      floor,
      pattern: arch.id,
      boss,
      buildTier,
      name: boss ? `第${floor}階層の番人` : arch.name,
      badge: boss ? "番人" : arch.badge,
      hint: boss ? `${arch.hint}${bossLine}` : `${arch.hint}${tierNote}`,
      special: boss ? `${arch.special}${bossLine}` : arch.special,
      maxHp,
      atk,
      def,
      regenInterval: arch.regenInterval,
      regenAmount,
      healEff: arch.healEff == null ? 1 : arch.healEff,
      atkEff: arch.atkEff == null ? 1 : arch.atkEff,
      defEff: arch.defEff == null ? 1 : arch.defEff,
      speed: arch.speed,
      dmgBonus: arch.dmgBonus || 0,
      dmgReduction: arch.dmgReduction || 0,
    };
  }

  W.CURVE = CURVE;
  W.enemyGrowth = growth;
  W.ARCHETYPES = ARCHETYPES;
  W.archetypeForFloor = archetypeForFloor;
  W.enemyPoolForFloor = poolForFloor;
  W.createEnemy = createEnemy;
})(typeof window !== "undefined" ? window : globalThis);
