/**
 * 能量池与施法(《能量池与刻度》《施法能力》)。
 */

export interface EnergyPoolDef {
  name: string;
  /** 体系分类 */
  system: string;
  /** 两个关键属性:上限 = 两属性之和 */
  keyAttrs: [string, string];
}

/** 建卡专长可获得的通用能量池(关键属性两两组合,上限=两属性之和)。 */
export const COMMON_POOLS: EnergyPoolDef[] = [
  { name: "魔力", system: "西方魔法", keyAttrs: ["智力", "智力"] },
  { name: "内力", system: "东方真气", keyAttrs: ["耐力", "风度"] },
  { name: "灵力", system: "灵能", keyAttrs: ["智力", "感知"] },
  { name: "精神力", system: "精神", keyAttrs: ["智力", "沉着"] },
  { name: "斗气", system: "斗气", keyAttrs: ["力量", "耐力"] },
  { name: "法力", system: "西方魔法", keyAttrs: ["智力", "沉着"] },
  { name: "真元", system: "东方真气", keyAttrs: ["耐力", "耐力"] },
  { name: "炁", system: "东方道术", keyAttrs: ["感知", "风度"] },
];

export function poolMax(keyAttrs: [string, string], getAttr: (n: string) => number): number {
  return getAttr(keyAttrs[0]) + getAttr(keyAttrs[1]);
}

/** 重复获得同名能量池的上限补偿:+5/+3/+1(第1/2/3次)。 */
export function duplicatePoolCompensation(times: number): number {
  if (times <= 1) return 0;
  if (times === 2) return 5;
  if (times === 3) return 3;
  return 1;
}

// ---------------- 施法 ----------------

export type CastRank = "D" | "C" | "B" | "A" | "S";
export const CAST_RANKS: CastRank[] = ["D", "C", "B", "A", "S"];

/** 施法者等级:D1/C2/B3/A4/S5 */
export function casterLevel(rank: CastRank): number {
  return CAST_RANKS.indexOf(rank) + 1;
}

/** 威力值:D2/C4/B8/A16/S32 */
export function spellPower(rank: CastRank): number {
  return [2, 4, 8, 16, 32][CAST_RANKS.indexOf(rank)];
}

/** 能耗:D1/C3/B5/A7/S9 */
export function spellCost(rank: CastRank): number {
  return [1, 3, 5, 7, 9][CAST_RANKS.indexOf(rank)];
}

/** 升阶 XP:无→D 3 / D→C 6 / C→B 18 / B→A 54 / A→S 162 */
export function castRankUpCost(rank: CastRank): number {
  return [3, 6, 18, 54, 162][CAST_RANKS.indexOf(rank)];
}

export type CastSystem = "魔法" | "道法" | "忍法" | "言灵";

/** 施法体系的关键属性 */
export const CAST_KEY_ATTR: Record<CastSystem, string> = {
  魔法: "智力",
  道法: "风度",
  忍法: "感知",
  言灵: "操控",
};

/** 法术专业(16 个) */
export const SPELL_SPECIALTIES = [
  "预言", "咒法", "塑能", "死灵", "幻象", "结界", "防护", "变化",
  "创造", "召唤", "诅咒", "精神", "附魔", "道术", "忍术", "言灵",
] as const;

/**
 * 施法检定:DP = 关键属性 + 神秘学 + 威力值 − 目标总防御;
 * 施法上限 = 关键属性 + 神秘学等级 + 威力值(伤害上限用)。
 */
export function castCheck(
  system: CastSystem,
  getAttr: (n: string) => number,
  occultLevel: number,
  rank: CastRank,
): { dpBase: number; cap: number; cost: number; power: number } {
  const attr = getAttr(CAST_KEY_ATTR[system]);
  const power = spellPower(rank);
  return {
    dpBase: attr + occultLevel + power,
    cap: attr + occultLevel + power,
    cost: spellCost(rank),
    power,
  };
}

/** 施法成分的材料消耗(分):D10/C20/B50/A100/S200 */
export function materialCost(rank: CastRank): number {
  return [10, 20, 50, 100, 200][CAST_RANKS.indexOf(rank)];
}
