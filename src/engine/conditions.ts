/**
 * 不良状态与点数(《不良状态与点数》)。
 * 三级门槛(以点数 P 与两个关键属性比较):
 * - 轻度:有任意点数即触发固定减值;
 * - 重度:P > 较高关键属性 × (该属性传奇数 + 1);
 * - 毁灭性:P > 两属性之和 × (传奇和 + 1),永久性后果。
 */
import { legendRank } from "./math";

export interface ConditionDef {
  name: string;
  /** 两个关键属性(取较高者算重度门槛) */
  attrs: [string, string];
  /** 对应豁免(短休/长休时按关键属性豁免,每成功 -1 点) */
  save: "强韧" | "反射" | "意志";
  light: string;
  heavy: string;
  catastrophic: string;
  /** 每回合效果(可选,如燃烧/流血) */
  perRound?: string;
}

export const CONDITION_DEFS: ConditionDef[] = [
  { name: "冻结", attrs: ["力量", "敏捷"], save: "强韧", light: "先攻-4、攻击-4、速度-4米、防御-4", heavy: "冻伤", catastrophic: "永久冰封" },
  { name: "燃烧", attrs: ["敏捷", "耐力"], save: "强韧", light: "每回合末受 ⌈P/2⌉ 火焰严重伤害", heavy: "—", catastrophic: "—", perRound: "ceil(P/2) 火焰L" },
  { name: "流血", attrs: ["耐力", "耐力"], save: "强韧", light: "每回合末受 4 点挥砍严重伤害", heavy: "失血过多", catastrophic: "多器官衰竭", perRound: "4 挥砍L" },
  { name: "晕眩", attrs: ["耐力", "决心"], save: "强韧", light: "攻击/施法/心灵检定-4、防御-4", heavy: "失衡", catastrophic: "昏迷" },
  { name: "麻痹", attrs: ["耐力", "决心"], save: "强韧", light: "攻击/反射-4、速度-4、防御-4", heavy: "定身", catastrophic: "瘫痪" },
  { name: "纠缠", attrs: ["力量", "敏捷"], save: "反射", light: "先攻-4、速度-4、反射失去1自然成功、防御-4", heavy: "定身", catastrophic: "失能" },
  { name: "目眩", attrs: ["耐力", "感知"], save: "强韧", light: "感知与侦查类-4、防御-4", heavy: "视觉障碍", catastrophic: "永久目盲" },
  { name: "耳鸣", attrs: ["耐力", "感知"], save: "强韧", light: "感知与侦查类-4、防御-4", heavy: "听觉障碍", catastrophic: "永久耳聋" },
  { name: "恶心", attrs: ["耐力", "决心"], save: "强韧", light: "攻击失去4自然成功", heavy: "反胃", catastrophic: "多器官衰竭" },
  { name: "剧痛", attrs: ["耐力", "决心"], save: "强韧", light: "互动/心智检定-4", heavy: "肌肉痉挛", catastrophic: "昏迷" },
  { name: "疲乏", attrs: ["耐力", "力量"], save: "强韧", light: "力/敏检定-4、攻击-4、速度-4", heavy: "肌肉痉挛", catastrophic: "永久力竭" },
  { name: "恐惧", attrs: ["决心", "沉着"], save: "意志", light: "对恐惧目标检定-4;朝其移动每米耗2", heavy: "惊慌逃窜1轮", catastrophic: "永久惊惧" },
  { name: "沮丧", attrs: ["决心", "沉着"], save: "意志", light: "主动检定-9", heavy: "迷失自我", catastrophic: "厌世" },
  { name: "亢奋", attrs: ["决心", "沉着"], save: "意志", light: "防御-12(不至负)", heavy: "狂躁", catastrophic: "歇斯底里" },
  { name: "失速", attrs: ["力量", "敏捷"], save: "强韧", light: "基础速度-12米", heavy: "定身", catastrophic: "失能" },
  { name: "肢体妨害", attrs: ["力量", "耐力"], save: "强韧", light: "该肢体检定-6", heavy: "肢体残障", catastrophic: "永久残障" },
];

/** 固有状态(直接生效,无点数) */
export const INNATE_CONDITIONS = [
  { name: "措手不及", effect: "失去基础/闪避/格挡防御,禁用反射动作" },
  { name: "倒地", effect: "起身=移动动作;远程防御+3完美、范围反射+3DP、近战防御-6" },
  { name: "浮空", effect: "无法移动,近战攻击-2" },
  { name: "无助", effect: "被攻击视为致命攻击对象" },
  { name: "震慑", effect: "失去下一轮行动" },
  { name: "昏迷", effect: "无法行动,可被致命攻击" },
  { name: "睡眠", effect: "同昏迷,感官刺激可唤醒" },
  { name: "石化", effect: "体重×5、获耐力装甲值;可被致命攻击" },
  { name: "定身", effect: "无法移动但仍可行动" },
  { name: "目盲", effect: "视为无法定位;每米耗2移动力" },
  { name: "耳聋", effect: "聆听相关检定自动失败" },
  { name: "力竭", effect: "速度1/10,禁冲锋与全力攻击" },
  { name: "瘫痪", effect: "无法移动与肢体动作" },
  { name: "失能", effect: "对应肢体失去功能" },
  { name: "窒息", effect: "闭气=耐力×5轮;之后每轮耐力检定DC递增+1" },
] as const;

/** 重度门槛:较高关键属性 × (传奇+1)。 */
export function heavyThreshold(attrs: [string, string], getAttr: (n: string) => number): number {
  const v1 = getAttr(attrs[0]);
  const v2 = getAttr(attrs[1]);
  const higher = Math.max(v1, v2);
  return higher * (legendRank(higher) + 1);
}

/** 毁灭性门槛:两属性之和 × (传奇和 + 1)。 */
export function catastrophicThreshold(
  attrs: [string, string],
  getAttr: (n: string) => number,
): number {
  const v1 = getAttr(attrs[0]);
  const v2 = getAttr(attrs[1]);
  return (v1 + v2) * (legendRank(v1) + legendRank(v2) + 1);
}

export type ConditionSeverity = "无" | "轻度" | "重度" | "毁灭性";

export function severityOf(
  points: number,
  def: ConditionDef,
  getAttr: (n: string) => number,
): ConditionSeverity {
  if (points <= 0) return "无";
  if (points > catastrophicThreshold(def.attrs, getAttr)) return "毁灭性";
  if (points > heavyThreshold(def.attrs, getAttr)) return "重度";
  return "轻度";
}
