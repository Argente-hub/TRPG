/**
 * 规则书版本配置:3.25 与 核心规则RM 在建卡数值、技能列表、专长模型、
 * 衍生属性公式与术语上的差异全部集中在这里,页面与引擎按角色所属版本取配置。
 * 依据:《无限流TRPG正式版3.25》与《无限TRPG核心规则RM███(正式版)》
 * 各自的 建卡/属性概述/技能概述/专长概述/生命意志力 章节。
 */
import { AttributeKey, SKILLS, SkillDef } from "./character";

export type RulesVersion = "3.25" | "rm";

export interface RulesConfig {
  id: RulesVersion;
  label: string;
  /** 界面术语:轮回之境在 RM 版称主神空间 */
  terms: { realm: string };
  // ---- 属性段 ----
  attrBase: number;
  attrFreePoints: number;
  attrCreateCap: number;
  /** 属性提升花费:RM 与 3.25 均为 4→5 耗 2 */
  attrRaiseCost(current: number): number;
  // ---- 技能段 ----
  /** 建卡可用的技能列表(RM 多一项"弓箭") */
  skills: SkillDef[];
  skillCreateCap: number;
  skillFreePoints: number;
  /** 技能提升花费:3.25 3→4 耗 2;RM 建卡每级 1 点 */
  skillRaiseCost(current: number): number;
  /** 技能附加成功阈值(5/7/9/11/13/15 vs 5/10/11/13/15) */
  skillBonusThresholds: readonly number[];
  /** 未受训惩罚:3.25 按三系;RM 无此规则(仅"无专业技能减半") */
  hasUntrainedPenalty: boolean;
  // ---- 专长段 ----
  featCreatePoints: number;
  /** 花费模型:cumulative = 1+2+…+n(3.25);perLevel = 每级1点(RM) */
  featCostModel: "cumulative" | "perLevel";
  /** 战斗专长门槛:3.25 需先有特殊身份;RM 战斗专长级数 ≤ 特殊身份级数+1 */
  battleGate: "identity" | "identityPlusOne";
  /** 特殊身份1级指定的技能建卡上限:3.25 为 5,RM 为 4 */
  specialIdentitySkillCap: number;
  /** RM 特殊身份2级:+2 自由技能点(3.25 为 2/3 级各 +2) */
  identityFreePointsByLevel(levels: number[]): number;
  /** 语言专长独立点数池(智力×2),仅 RM */
  hasLangFeatPoints: boolean;
  // ---- XP 消费(怪癖XP/后续提升) ----
  skillUpXpCost(currentLevel: number): number;
  featUpXpCost(nextLevel: number, featName: string): number;
}

const ATTR_RAISE_COST = (current: number) => (current >= 4 ? 2 : 1);

export const RULES: Record<RulesVersion, RulesConfig> = {
  "3.25": {
    id: "3.25",
    label: "正式版 3.25",
    terms: { realm: "轮回之境" },
    attrBase: 2,
    attrFreePoints: 6,
    attrCreateCap: 5,
    attrRaiseCost: ATTR_RAISE_COST,
    skills: SKILLS.filter((s) => !s.rmOnly),
    skillCreateCap: 4,
    skillFreePoints: 5,
    skillRaiseCost: (current) => (current >= 3 ? 2 : 1),
    skillBonusThresholds: [5, 7, 9, 11, 13, 15],
    hasUntrainedPenalty: true,
    featCreatePoints: 15,
    featCostModel: "cumulative",
    battleGate: "identity",
    specialIdentitySkillCap: 5,
    identityFreePointsByLevel: (levels) =>
      (levels.includes(2) ? 2 : 0) + (levels.includes(3) ? 2 : 0),
    hasLangFeatPoints: false,
    skillUpXpCost: (cur) => (cur <= 0 ? 1 : cur * 2),
    featUpXpCost: (_next, name) => (name.startsWith("轮回之境") || name.startsWith("超魔") ? 6 : 3),
  },
  rm: {
    id: "rm",
    label: "核心规则 RM███(正式版)",
    terms: { realm: "主神空间" },
    attrBase: 1,
    attrFreePoints: 3,
    attrCreateCap: 5,
    attrRaiseCost: ATTR_RAISE_COST,
    skills: SKILLS,
    skillCreateCap: 3,
    skillFreePoints: 5,
    skillRaiseCost: () => 1,
    skillBonusThresholds: [5, 10, 11, 13, 15],
    hasUntrainedPenalty: false,
    featCreatePoints: 5,
    featCostModel: "perLevel",
    battleGate: "identityPlusOne",
    specialIdentitySkillCap: 4,
    identityFreePointsByLevel: (levels) => (levels.includes(2) ? 2 : 0),
    hasLangFeatPoints: true,
    skillUpXpCost: (cur) => (cur <= 0 ? 3 : Math.max(1, (cur - 1) * 2)),
    featUpXpCost: (next, name) => (name === "语言" ? 2 : next * 2),
  },
};

export function rulesOf(version: RulesVersion | string | undefined | null): RulesConfig {
  return version === "rm" ? RULES.rm : RULES["3.25"];
}

/** 通用:建卡属性从基础值升到 v 的总花费。 */
export function attrTotalCost(cfg: RulesConfig, v: number): number {
  let c = 0;
  for (let x = cfg.attrBase; x < v; x++) c += cfg.attrRaiseCost(x);
  return c;
}

/** 通用:技能从 0 升到 v 的总花费。 */
export function skillTotalCost(cfg: RulesConfig, v: number): number {
  let c = 0;
  for (let x = 0; x < v; x++) c += cfg.skillRaiseCost(x);
  return c;
}

/** 专长建卡持有 level 级的总花费(按版本模型)。 */
export function featBuildCost(cfg: RulesConfig, level: number, exotic = false): number {
  const total =
    cfg.featCostModel === "perLevel"
      ? level
      : level > 0
        ? (level * (level + 1)) / 2
        : 0;
  return exotic ? total * 2 : total;
}

/** 技能附加成功(按版本阈值)。 */
export function skillBonusSuccessesFor(cfg: RulesConfig, level: number): number {
  return cfg.skillBonusThresholds.filter((t) => level >= t).length;
}

/** 语言专长点:每点智力 2 点(仅 RM)。 */
export function langFeatPoints(intellect: number): number {
  return Math.max(0, intellect) * 2;
}

/** RM 各传奇属性的说明性收益(供展示;数值公式在 deriveStats)。 */
export const LEGEND_NOTE_RM: Partial<Record<AttributeKey, string>> = {
  力量: "检定+n附+nDP,伤害上限+n(n+1)/2",
  敏捷: "检定+n附,防御附+n,速度+3n",
  耐力: "检定+n附,生命+n(n+1)/2",
  智力: "检定+n附,影片结算经验红利+3n",
  感知: "检定+n附,防御附+n,洞察防御+n,敏感范围+20·n(n+1)/2",
  决心: "检定+n附,意志值+n,意志检定+nDP",
  风度: "检定+n附,基因锁/机运骰结果+n",
  操控: "检定+n附,每影片重骰基因锁/机运骰n次",
  沉着: "检定+n附,意志值+n,先攻+n",
};
