/**
 * 角色与建卡规则(《一步一步的创建你的角色》《属性概述》《技能概述》《专长概述》)。
 * 版本差异(属性基值/技能上限/专长模型/衍生公式)见 engine/rules.ts 的 RULES 配置。
 */
import { legendRank, legendTriangle } from "./math";
import type { RulesVersion } from "./rules";

export type { RulesVersion };

export const ATTR_CATEGORIES = ["生理", "心智", "互动"] as const;
export type AttrCategory = (typeof ATTR_CATEGORIES)[number];

export const ATTRIBUTES = {
  生理: ["力量", "敏捷", "耐力"],
  心智: ["智力", "感知", "决心"],
  互动: ["风度", "操控", "沉着"],
} as const;

export type AttributeKey =
  | "力量" | "敏捷" | "耐力"
  | "智力" | "感知" | "决心"
  | "风度" | "操控" | "沉着";

export function attrCategory(key: AttributeKey): AttrCategory {
  if (key in ATTRIBUTES.生理) return "生理";
  if (key in ATTRIBUTES.心智) return "心智";
  return "互动";
}

export const ATTRIBUTE_KEYS = Object.values(ATTRIBUTES).flat() as AttributeKey[];

/** 体型:体积范围与生命值调整 */
export const SIZES = {
  微型: { volume: 1, hp: 1 },
  小型: { volume: 2, hp: 2 },
  中型: { volume: 5, hp: 5 },
  大型: { volume: 10, hp: 10 },
  超大型: { volume: 17, hp: 17 },
  巨型: { volume: 26, hp: 26 },
  超巨型: { volume: 34, hp: 37 },
} as const;
export type SizeKey = keyof typeof SIZES;

// ---------------- 属性 ----------------

/** 建卡属性提升花费:4→5 每级耗 2 点,其余 1 点;建卡上限 5。 */
export function attrRaiseCost(current: number): number {
  return current >= 4 ? 2 : 1;
}
export const ATTR_CREATE_CAP = 5;
export const ATTR_BASE = 2;

/** 建卡属性段:三系分配 3/2/1 点 + 6 自由点 */
export const ATTR_CATEGORY_POOL = [3, 2, 1] as const;
export const ATTR_FREE_POINTS = 6;

// ---------------- 技能 ----------------

export interface SkillDef {
  name: string;
  category: AttrCategory;
  /** 常用关联属性(供骰子页建议,规则允许按用法指定其他属性) */
  attrs: AttributeKey[];
  desc?: string;
  /** 子分类技能(手艺/表达),按子技能分别学习 */
  sub?: boolean;
  /** 仅 RM 版(弓箭) */
  rmOnly?: boolean;
}

/** 21 项技能(生理8/心智7/互动6) */
export const SKILLS: SkillDef[] = [
  { name: "运动", category: "生理", attrs: ["力量", "敏捷"], desc: "攀爬、跳跃、游泳等全身运动" },
  { name: "肉搏", category: "生理", attrs: ["力量"], desc: "徒手打击与擒抱" },
  { name: "驾驶", category: "生理", attrs: ["敏捷"], desc: "驾驶载具" },
  { name: "枪械", category: "生理", attrs: ["敏捷"], desc: "枪械类远程攻击与维修" },
  { name: "手上功夫", category: "生理", attrs: ["敏捷"], desc: "偷窃、开锁等精细手上技巧" },
  { name: "隐藏", category: "生理", attrs: ["敏捷"], desc: "躲藏与潜行" },
  { name: "求生", category: "生理", attrs: ["感知"], desc: "野外生存、追踪、方向感" },
  { name: "白刃", category: "生理", attrs: ["力量"], desc: "冷兵器近战" },
  { name: "弓箭", category: "生理", attrs: ["敏捷"], desc: "弓弩类远程攻击(仅核心规则RM版)", rmOnly: true },
  { name: "学识", category: "心智", attrs: ["智力"], desc: "综合性知识" },
  { name: "电脑", category: "心智", attrs: ["智力"], desc: "计算机操作、编程、黑客" },
  { name: "手艺", category: "心智", attrs: ["智力", "感知"], desc: "按子分类分别学习(如手艺-爆炸物)", sub: true },
  { name: "调查", category: "心智", attrs: ["感知"], desc: "搜索现场、侦查、推理" },
  { name: "医学", category: "心智", attrs: ["智力"], desc: "诊断、治疗、手术" },
  { name: "神秘学", category: "心智", attrs: ["智力"], desc: "超自然知识,施法的必要技能" },
  { name: "科学", category: "心智", attrs: ["智力"], desc: "数理化等自然科学" },
  { name: "动物沟通", category: "互动", attrs: ["风度", "操控"], desc: "安抚、训练、骑乘动物" },
  { name: "感受", category: "互动", attrs: ["感知"], desc: "察觉情绪、谎言与意图" },
  { name: "表达", category: "互动", attrs: ["风度"], desc: "按子分类分别学习(如表达-唱歌)", sub: true },
  { name: "胁迫", category: "互动", attrs: ["操控", "风度"], desc: "威胁、恐吓他人" },
  { name: "交际", category: "互动", attrs: ["风度", "操控"], desc: "社交、交涉、建立关系" },
  { name: "掩饰", category: "互动", attrs: ["操控", "风度"], desc: "欺骗、伪装、撒谎" },
];

export const SKILL_CREATE_CAP = 4;      // 特殊身份1 可使一项技能建卡到 5
export const SKILL_MAX = 15;
export const SKILL_CATEGORY_POOL = [6, 5, 4] as const;
export const SKILL_FREE_POINTS = 5;

/** 建卡技能提升花费:3→4 每级耗 2 点,其余 1 点。 */
export function skillRaiseCost(current: number): number {
  return current >= 3 ? 2 : 1;
}

/** 技能附加成功:3.25 为 5/7/9/11/13/15 级各 +1(最多 6 个);RM 为 5/10/11/13/15(最多 5 个)。 */
export function skillBonusSuccesses(level: number, version: RulesVersion | string | undefined = "3.25"): number {
  const thresholds = version === "rm" ? [5, 10, 11, 13, 15] : [5, 7, 9, 11, 13, 15];
  return thresholds.filter((t) => level >= t).length;
}

/** 技能专业:每个 +1DP,多个专业不叠加(取最高,即 +1)。 */
export const SPECIALTY_DP = 1;

/** 未受训惩罚:0 级时生理失去1自然成功 / 心智自动失败 / 互动失去2自然成功。 */
export interface UntrainedPenalty {
  loseNaturalSuccesses: number;
  autoFail: boolean;
}
export function untrainedPenalty(category: AttrCategory): UntrainedPenalty {
  switch (category) {
    case "生理":
      return { loseNaturalSuccesses: 1, autoFail: false };
    case "心智":
      return { loseNaturalSuccesses: 0, autoFail: true };
    case "互动":
      return { loseNaturalSuccesses: 2, autoFail: false };
  }
}

// ---------------- 专长/缺陷/怪癖/天赋 ----------------

/** 建卡专长点数 */
export const FEAT_CREATE_POINTS = 15;

/** n 级普通专长累计花费 = 1+2+...+n;轮回之境/超魔专长每级花费 ×2。 */
export function featLevelCost(level: number, exotic = false): number {
  const normal = (level * (level + 1)) / 2;
  return exotic ? normal * 2 : normal;
}

export const FEAT_CATEGORIES = [
  "建卡", "心智", "生理", "互动",
  "白刃", "枪械", "肉搏", "非枪械远程", "其他技巧",
  "轮回之境", "超魔",
] as const;
export type FeatCategory = (typeof FEAT_CATEGORIES)[number];

/** 战斗专长类(建卡时需先购买"特殊身份") */
export const BATTLE_FEAT_CATEGORIES: FeatCategory[] = [
  "白刃", "枪械", "肉搏", "非枪械远程", "其他技巧",
];

export const QUIRK_MAX = 5;
export const QUIRK_XP_EACH = 2;
/** 缺陷点 → 天赋点:每 2 缺陷点 = 1 天赋点 */
export function flawPointsToTalentPoints(flawPoints: number): number {
  return Math.floor(flawPoints / 2);
}

// ---------------- 子技能(手艺/表达) ----------------

/** 若为子技能名(如 "手艺-爆炸物"),返回基础技能名(手艺),否则 null。 */
export function subSkillBaseOf(name: string): string | null {
  const m = name.match(/^(手艺|表达)-(.+)$/);
  return m ? m[1] : null;
}

/** 技能所属分类(子技能按前缀归类)。 */
export function skillCategoryOf(name: string): AttrCategory {
  const base = subSkillBaseOf(name);
  if (base) return base === "手艺" ? "心智" : "互动";
  return SKILLS.find((s) => s.name === name)?.category ?? "生理";
}

/** 子技能显示名:手艺-爆炸物 → 手艺·爆炸物 */
export function skillDisplayName(name: string): string {
  return subSkillBaseOf(name) ? name.replace("-", "·") : name;
}

// ---------------- 角色卡 ----------------

export interface CharacterData {
  id: string;
  name: string;
  /** 角色遵循的规则书版本(旧档默认 3.25) */
  rules?: RulesVersion;
  /** 概念段(官方人物卡字段) */
  concept: string;
  gender: string;
  age: string;
  height: string;
  weight: string;
  race: string;
  nationality: string;
  languages: string;
  appearance: string;
  personality: string;
  /** 美德/恶德或角色特性(核心规则RM概念段) */
  virtueVice?: string;
  size: SizeKey;
  attributes: Record<AttributeKey, number>;
  /** 属性加值渠道:内在(血统/改造)与修行(称号/流派) */
  attrComponents: Partial<Record<AttributeKey, { intrinsic: number; cultivation: number }>>;
  skills: Record<string, number>;
  specialties: Record<string, string[]>;
  feats: { name: string; category: FeatCategory; level: number; levels?: number[] }[];
  flaws: { name: string; points: number }[];
  quirks: string[];
  talents: { name: string; level: number }[];
  /** 挂载的资源条目(血统/改造/物品等)与手工效果注记 */
  resources: AttachedResource[];
  customBonuses: CustomBonus[];
  /** 攻击预设(官方卡"攻击预设"段) */
  attackPresets: AttackPreset[];
  /** 可用招式(按动作类型) */
  moves: Partial<Record<MoveSlot, string>>;
  /** 防御预设(官方卡"防御预设"段;基础防御由引擎计算) */
  defensePreset: DefensePreset;
  /** 特殊身份1级:指定一项技能(建卡上限5) */
  specialIdentitySkill?: string;
  /** 各资源类别的施法者职能(官方卡"能力段") */
  casterFunctions: Record<string, string>;
  /** 物品表格(名称/数量/价格/效果/剩余) */
  items: ItemRow[];
  equipment: EquipmentSlots;
  energyPools: EnergyPoolState[];
  /** 轮回之境账本 */
  ledger: Ledger;
  notes?: string;
  createdAt: number;
}

/** 可用招式的动作类型(官方卡"可用招式"段) */
export const MOVE_SLOTS = ["附带", "自由", "迅捷", "移动", "标准", "整轮", "全回合"] as const;
export type MoveSlot = (typeof MOVE_SLOTS)[number];

/** 官方人物卡"攻击预设"字段 */
export interface AttackPreset {
  id: string;
  name: string;
  attr: string;
  skill: string;
  weaponDamage: number;
  /** 伤害上限(默认=属性+技能+武器伤害,可覆盖;-1=固定伤害无限) */
  cap?: number;
  /** 攻击附加成功(传奇属性+技能附加+其他) */
  bonusSuccesses: number;
  /** 常驻DP上的其他加值(已含专业时自行计入数值) */
  extraDp: number;
  /** 武器特性 */
  highSpeed: number;
  breakArmor: number;
  breakMagic: number;
  again: 10 | 9 | 8;
  damageType: "B" | "L" | "A";
  /** 基础触及(米,武器体积/3+1);0=不适用 */
  reach: number;
  /** 基础射程(米);0=不适用 */
  range: number;
  /** 攻击特殊特效/命中额外特效(自由文本) */
  note?: string;
  /** 范围攻击 */
  area?: boolean;
}

/** 官方人物卡"物品"表格行 */
export interface ItemRow {
  id: string;
  name: string;
  qty: string;
  price: string;
  effect: string;
  remaining: string;
}

/** 官方人物卡"防御预设"字段(来源信息并入 note) */
export interface DefensePreset {
  dodge: number;
  bladeBlock: number;
  brawlBlock: number;
  shieldMelee: number;
  shieldRanged: number;
  armorMelee: number;
  armorRanged: number;
  natural: number;
  extraBonusSuccesses: number;
  note?: string;
}

export interface AttachedResource {
  resourceId: string;
  name: string;
  category: string;
  rank?: string | null;
  price?: string | null;
  /** 阶梯资源的已购等级(如 ["D","C"]),最高级决定可购买的技能树技能 */
  ownedRanks?: string[];
  /** 手工效果注记(自由文本) */
  note?: string;
}

/** 手工效果注记:把资源/专长的数值效果接入结算引擎 */
export interface CustomBonus {
  id: string;
  label: string;
  /** "dp" => DP加值(type 为加值类型); "defense" => 防御槽位(slot 为槽位) */
  kind: "dp" | "defense";
  type?: string;
  slot?: string;
  value: number;
}

export const EQUIPMENT_SLOT_NAMES = [
  "头盔", "项链", "披风", "盔甲", "护腕", "手套", "腰带", "鞋",
  "戒指1", "戒指2", "饰品", "概念武装", "装置", "插件", "道具", "武器", "盾牌",
] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOT_NAMES)[number];
export type EquipmentSlots = Partial<Record<EquipmentSlot, AttachedResource>>;

export interface EnergyPoolState {
  name: string;
  current: number;
  max: number;
}

export type CurrencyUnit = "支线D" | "支线C" | "支线B" | "支线A" | "支线S" | "分数" | "XP";

export interface LedgerEntry {
  id: string;
  time: number;
  desc: string;
  deltas: Partial<Record<CurrencyUnit, number>>;
}

export interface Ledger {
  missions: { D: number; C: number; B: number; A: number; S: number };
  points: number;
  xp: number;
  history: LedgerEntry[];
}

export function emptyLedger(): Ledger {
  return { missions: { D: 0, C: 0, B: 0, A: 0, S: 0 }, points: 0, xp: 0, history: [] };
}

export function emptyCharacter(id: string, name: string, rules: RulesVersion = "3.25"): CharacterData {
  const attrs = {} as Record<AttributeKey, number>;
  // 属性基础值:3.25 为 2,RM 为 1(见 rules.ts,内联避免循环导入)
  const base = rules === "rm" ? 1 : ATTR_BASE;
  for (const k of ATTRIBUTE_KEYS) attrs[k] = base;
  return {
    id,
    name,
    rules,
    concept: "",
    gender: "",
    age: "",
    height: "",
    weight: "",
    race: "人类",
    nationality: "",
    languages: "",
    appearance: "",
    personality: "",
    size: "中型",
    attributes: attrs,
    attrComponents: {},
    skills: {},
    specialties: {},
    feats: [],
    flaws: [],
    quirks: [],
    talents: [],
    resources: [],
    customBonuses: [],
    attackPresets: [],
    moves: {},
    defensePreset: {
      dodge: 0, bladeBlock: 0, brawlBlock: 0, shieldMelee: 0, shieldRanged: 0,
      armorMelee: 0, armorRanged: 0, natural: 0, extraBonusSuccesses: 0,
    },
    casterFunctions: {},
    items: [],
    equipment: {},
    energyPools: [],
    ledger: emptyLedger(),
    createdAt: Date.now(),
  };
}

/** 属性三渠道合计:基础 + 内在(血统/改造) + 修行(称号/流派) */
export function attrTotal(c: CharacterData, key: AttributeKey): number {
  const comp = c.attrComponents?.[key];
  return c.attributes[key] + (comp?.intrinsic ?? 0) + (comp?.cultivation ?? 0);
}

/** 兼容旧存档:补齐缺省字段 */
export function normalizeCharacter(c: Partial<CharacterData> & { id: string; name: string }): CharacterData {
  const base = emptyCharacter(c.id, c.name, c.rules ?? "3.25");
  const merged: CharacterData = { ...base, ...c, attrComponents: c.attrComponents ?? {} };
  // 旧档迁移:专业键 "手艺-X"/"表达-X" → 独立子技能条目(继承基础技能等级,基础技能归 0)
  const legacySubs = Object.keys(merged.specialties).filter((k) => subSkillBaseOf(k));
  const baseSeen = new Set<string>();
  for (const key of legacySubs) {
    if (merged.skills[key] === undefined) {
      const base = key.split("-")[0];
      if (!baseSeen.has(base)) {
        merged.skills[key] = merged.skills[base] ?? 0;
        baseSeen.add(base);
      } else {
        merged.skills[key] = 0;
      }
    }
  }
  for (const base of baseSeen) {
    merged.skills[base] = 0;
  }
  // 特殊身份:记录实际购买的等级(高级覆盖低级,效果按已购等级各自生效)
  for (const f of merged.feats) {
    if (f.name === "特殊身份" && !f.levels?.length) {
      f.levels = [f.level];
    }
  }
  return merged;
}

// ---------------- 衍生属性 ----------------

export interface SaveDef {
  formula: string;
  attr: AttributeKey;
  skill: string;
  /** 完美加值 DP = 传奇属性 × 3 */
  perfect: number;
  /** 覆盖默认"+[完美]传奇attr×3"的展示说明(RM 意志检定) */
  perfectNote?: string;
}

export interface DerivedStats {
  legend: Record<AttributeKey, number>;
  /** 三渠道合计后的属性总值 */
  attrTotals: Record<AttributeKey, number>;
  hp: number;
  willpowerMax: number;
  /** 意志力基础用法 = 传奇风度×2 + 3 */
  willpowerBaseUses: number;
  initiative: number;
  baseDefense: number;
  /** 陆行速度(米/轮) */
  speed: number;
  touchRange: number;
  sensitiveRange: number;
  saves: { 意志: SaveDef; 反射: SaveDef; 强韧: SaveDef };
}

/** 衍生属性计算(含传奇属性收益,属性取三渠道合计;公式按角色所属规则书版本)。 */
export function deriveStats(c: CharacterData): DerivedStats {
  const rm = c.rules === "rm";
  const totals = {} as Record<AttributeKey, number>;
  for (const k of ATTRIBUTE_KEYS) totals[k] = attrTotal(c, k);
  const legend = {} as Record<AttributeKey, number>;
  for (const k of ATTRIBUTE_KEYS) legend[k] = legendRank(totals[k]);

  const hp =
    totals["耐力"] +
    SIZES[c.size].hp +
    legendTriangle(legend["耐力"]);

  // 意志值 = 决心+沉着;3.25 每传奇+3,RM 每传奇+1
  const legendWill = rm
    ? legend["决心"] + legend["沉着"]
    : 3 * legend["决心"] + 3 * legend["沉着"];
  const willpowerMax = totals["决心"] + totals["沉着"] + legendWill;

  // 意志力基础用法:3.25 = 传奇风度×2+3;RM 无每轮限制
  const willpowerBaseUses = rm ? 0 : 3 + 2 * legend["风度"];

  // 先攻 = 敏捷+沉着;3.25 +3×传奇沉着,RM +1×传奇沉着
  const initiative =
    totals["敏捷"] + totals["沉着"] + (rm ? legend["沉着"] : 3 * legend["沉着"]);

  // 基础防御:3.25 含传奇敏捷/感知;RM 传奇只给防御附加成功与洞察防御
  const baseDefense = rm
    ? Math.min(totals["敏捷"], totals["感知"])
    : Math.min(totals["敏捷"], totals["感知"]) +
      legend["敏捷"] + legend["感知"];

  // 速度 = 力量+敏捷+体积;RM 传奇敏捷再 +3n
  const speed =
    totals["力量"] + totals["敏捷"] + SIZES[c.size].hp +
    (rm ? 3 * legend["敏捷"] : 0);

  return {
    legend,
    attrTotals: totals,
    hp,
    willpowerMax,
    willpowerBaseUses,
    initiative,
    baseDefense,
    speed,
    touchRange: 2,
    // 敏感范围 = 感知×10 + 传奇感知×20 米(两版一致)
    sensitiveRange: totals["感知"] * 10 + legend["感知"] * 20,
    saves: rm
      ? {
          意志: {
            formula: "决心+沉着(意志值)",
            attr: "决心",
            skill: "沉着",
            perfect: legend["决心"] + legend["沉着"],
            perfectNote: `传奇决心+传奇沉着 = ${legend["决心"] + legend["沉着"]}DP`,
          },
          反射: { formula: "敏捷+运动", attr: "敏捷", skill: "运动", perfect: 3 * legend["敏捷"] },
          强韧: { formula: "耐力+求生", attr: "耐力", skill: "求生", perfect: 3 * legend["耐力"] },
        }
      : {
          意志: { formula: "决心+感受", attr: "决心", skill: "感受", perfect: 3 * legend["决心"] },
          反射: { formula: "敏捷+运动", attr: "敏捷", skill: "运动", perfect: 3 * legend["敏捷"] },
          强韧: { formula: "耐力+求生", attr: "耐力", skill: "求生", perfect: 3 * legend["耐力"] },
        },
  };
}
