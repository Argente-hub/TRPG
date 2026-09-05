/**
 * 轮回之境经济(《货币介绍与获取》《基础购买规则》《轮回之境》)。
 * 三货币:支线奖励(D/C/B/A/S)、奖励点数(分数)、经验(XP)。
 */

export type MissionRank = "D" | "C" | "B" | "A" | "S";
export const MISSION_RANKS: MissionRank[] = ["D", "C", "B", "A", "S"];

/** 支线拆合:3 低级 = 1 高级,可逆拆。 */
export function convertMissionsUp(
  missions: Record<MissionRank, number>,
  rank: MissionRank,
): Record<MissionRank, number> | null {
  if (rank === "S") return null;
  const i = MISSION_RANKS.indexOf(rank);
  const higher = MISSION_RANKS[i + 1];
  if (missions[rank] < 3) return null;
  const out = { ...missions };
  out[rank] -= 3;
  out[higher] += 1;
  return out;
}

export function convertMissionsDown(
  missions: Record<MissionRank, number>,
  rank: MissionRank,
): Record<MissionRank, number> | null {
  if (rank === "D") return null;
  const i = MISSION_RANKS.indexOf(rank);
  const lower = MISSION_RANKS[i - 1];
  if (missions[rank] < 1) return null;
  const out = { ...missions };
  out[rank] -= 1;
  out[lower] += 3;
  return out;
}

/** 支线折算成分数下限(粗略比较用):D=1,C=3,B=9,A=27,S=81(单位:D当量) */
export function missionWeight(rank: MissionRank): number {
  return Math.pow(3, MISSION_RANKS.indexOf(rank));
}

// ---------------- 固定通关奖励 ----------------

/**
 * 第 n 场通关奖励:⌈n/2⌉ 个 D 支线 + 每 D 配 1000 分;每 3 个 D 重组显示为高一级。
 * 例:第5场 C+3000;第7场 C+D+4000;第9场 C+DD+5000。
 */
export function missionReward(
  n: number,
): { missions: Partial<Record<MissionRank, number>>; points: number; desc: string } {
  const dCount = Math.ceil(n / 2);
  const cFromD = Math.floor(dCount / 3);
  const restD = dCount % 3;
  const missions: Partial<Record<MissionRank, number>> = {};
  if (cFromD > 0) missions.C = cFromD;
  if (restD > 0) missions.D = restD;
  const total = dCount * 1000;
  const parts: string[] = [];
  if (cFromD > 0) parts.push(`${cFromD}C`);
  if (restD > 0) parts.push(`${restD}D`);
  return {
    missions,
    points: total,
    desc: `第${n}场:${parts.join("+") || "0"} + ${total}分`,
  };
}

// ---------------- 价格表 ----------------

export type PurchaseCategory =
  | "血统" | "改造" | "瞳术" | "称号" | "典籍" | "技艺" | "物品" | "随从" | "流派";

/** 基础价格表(分):未标价资源按此 */
export const PRICE_TABLE: Record<PurchaseCategory, Partial<Record<MissionRank | "AA", number>>> = {
  血统: { D: 600, C: 1200, B: 3600, A: 7200, AA: 10800, S: 14400 },
  改造: { D: 500, C: 1000, B: 2000, A: 4000, S: 8000 },
  瞳术: { D: 600, C: 1200, B: 2400, A: 4800, S: 9600 },
  称号: { D: 1000, C: 2000, B: 4000, A: 8000, AA: 12000, S: 16000 },
  流派: { D: 1000, C: 2000, B: 4000, A: 8000, AA: 12000, S: 16000 },
  典籍: { D: 1000, C: 2000, B: 4000, A: 8000, S: 16000 },
  技艺: { D: 500, C: 1000, B: 2000, A: 4000, S: 8000 },
  物品: { D: 500, C: 1000, B: 2000, A: 4000, S: 8000 },
  随从: { D: 500, C: 1000, B: 2000, A: 4000, S: 8000 },
};

/** 属性永久 +1 的价格:当前基础值 × 200 分(0→1 为 100 分)或 ×4 XP(0→1 为 1XP)。 */
export function attributeUpCost(currentBase: number): { points: number; xp: number } {
  if (currentBase <= 0) return { points: 100, xp: 1 };
  return { points: currentBase * 200, xp: currentBase * 4 };
}

/** 技能升级(轮回之境内):当前级 × 2 XP(0→1 为 1XP),上限 15 级。 */
export function skillUpCostXp(currentLevel: number): number {
  if (currentLevel <= 0) return 1;
  return currentLevel * 2;
}

/** 专长升一级的 XP:3XP/级(轮回之境与超魔专长 6XP/级)。 */
export const FEAT_XP_PER_LEVEL = 3;
export const FEAT_XP_PER_LEVEL_EXOTIC = 6;

/** 培元固本:+1/+3/+5 HP 上限各 500 分(每 2 场 1 次,共 3 次)。 */
export const PEIYUAN_COST = 500;

/** 洗点:C+3000 */
export const RESPEC_COST = { C: 1, points: 3000 };

/** 复活 = 历史消耗总和 + 1000 分。 */
export function reviveCost(totalPastSpent: number): number {
  return totalPastSpent + 1000;
}

/** 经验发放:基础 2+2n(n 为场次);奖励经验 =(总D数×3 + 总分数/500×2)/PC 数。 */
export function baseXp(missionNo: number): number {
  return 2 + 2 * missionNo;
}
export function bonusXp(totalD: number, totalPoints: number, pcCount: number): number {
  if (pcCount <= 0) return 0;
  return Math.floor((totalD * 3 + Math.floor(totalPoints / 500) * 2) / pcCount);
}

/** 精神时光屋:12XP(=D+1000 分) */
export const TIME_ROOM_COST = { xp: 12, D: 1, points: 1000 };

/** 物品回收 = 支线 × 2/3 + 分数 × 4/5(向下取整)。 */
export function recycleValue(rank: MissionRank | null, points: number): { rankBack: MissionRank | null; points: number } {
  // v1 简化:分数部分 × 4/5;支线部分按价格表 × 2/3 折分
  const pts = Math.floor(points * 4) / 5;
  let rankBack: MissionRank | null = null;
  if (rank) {
    const i = MISSION_RANKS.indexOf(rank);
    // 3低=1高 => 回收 2/3 相当于保留低一级中的 2 个
    rankBack = i > 0 ? MISSION_RANKS[i - 1] : null;
  }
  return { rankBack, points: Math.floor(pts) };
}
