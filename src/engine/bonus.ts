/**
 * 加值体系(《本质、加值与兑换》)。
 * 规则要点:
 * - 同类型加值不叠加,取最高;
 * - 完美/表演可与任何加值叠加(含同类);
 * - 瞄准加值可叠(上限由调用方控制);
 * - 内在/修行/专长/专业:同一来源(同一血统/专长树)的不同等级可叠加,不同来源取最高;
 * - 减值无限叠(各来源减值全部生效);
 * - 加减值并存:最大加值与最大减值同时生效;
 * - 防御分槽位:基础(可叠)/闪避/天生/盔甲/盾牌/格挡/掩蔽/偏斜,除基础外同槽不叠。
 */

export const DP_BONUS_TYPES = [
  "内在", "修行", "增强", "器械", "能量", "招式",
  "速度", "士气", "表现", "洞察", "无名", "环境", "幸运",
  "力场", "偏斜", "神圣", "亵渎", "专业", "专长", "瞄准", "完美", "表演",
] as const;
export type DpBonusType = (typeof DP_BONUS_TYPES)[number];

/** 可与任何加值叠加的类型 */
const STACK_ALL: ReadonlySet<string> = new Set(["完美", "表演"]);
/** 同类型直接相加的类型 */
const SUM_SAME_TYPE: ReadonlySet<string> = new Set(["瞄准"]);
/** 同一来源(sourceId 相同)跨等级叠加、不同来源取最高的类型 */
const SAME_SOURCE_STACKS: ReadonlySet<string> = new Set(["内在", "修行", "专长", "专业"]);

export interface BonusEntry {
  type: DpBonusType;
  /** 正数=加值,负数=减值 */
  value: number;
  /** 来源标识:同一血统/专长/强化条目应使用相同 sourceId */
  sourceId?: string;
  name?: string;
}

export interface AggregateResult {
  /** 正向加值合计 */
  positive: number;
  /** 负向减值合计(负数) */
  negative: number;
  /** 总额 = positive + negative(调用方决定是否钳制 ≥0) */
  total: number;
  /** 结算明细(用于展示) */
  log: string[];
}

export function aggregateDpBonuses(bonuses: BonusEntry[]): AggregateResult {
  const log: string[] = [];
  const pos = bonuses.filter((b) => b.value > 0);
  const neg = bonuses.filter((b) => b.value < 0);

  let positive = 0;
  const byType = new Map<string, BonusEntry[]>();
  for (const b of pos) {
    if (!byType.has(b.type)) byType.set(b.type, []);
    byType.get(b.type)!.push(b);
  }
  for (const [type, list] of byType) {
    if (STACK_ALL.has(type)) {
      const sum = list.reduce((a, b) => a + b.value, 0);
      positive += sum;
      log.push(`${type} ×${list.length} 叠加: +${sum}`);
    } else if (SUM_SAME_TYPE.has(type)) {
      const sum = list.reduce((a, b) => a + b.value, 0);
      positive += sum;
      log.push(`${type} 可叠: +${sum}`);
    } else if (SAME_SOURCE_STACKS.has(type)) {
      // 同 sourceId 内相加,各来源组之间取最高
      const groups = new Map<string, number>();
      for (const b of list) {
        const key = b.sourceId ?? b.name ?? "无来源";
        groups.set(key, (groups.get(key) ?? 0) + b.value);
      }
      const best = Math.max(...groups.values());
      positive += best;
      log.push(`${type} 同源叠/异源取高: +${best}`);
    } else {
      const best = Math.max(...list.map((b) => b.value));
      positive += best;
      log.push(`${type} 取最高: +${best}`);
    }
  }

  let negative = 0;
  for (const b of neg) {
    negative += b.value;
    log.push(`${b.type} 减值: ${b.value}`);
  }

  return { positive, negative, total: positive + negative, log };
}

// ---------------- 防御槽位 ----------------

export const DEFENSE_SLOTS = [
  "基础", "闪避", "天生", "盔甲", "盾牌", "格挡", "掩蔽", "偏斜",
] as const;
export type DefenseSlot = (typeof DEFENSE_SLOTS)[number];

export interface DefenseBonus {
  slot: DefenseSlot;
  value: number;
  name?: string;
}

/**
 * 聚合防御槽位:除"基础"外同槽不叠取最高;基础可叠;减值无限叠。
 * 完美/表演类 DP 加值(如意志力防御+3完美)应直接并入"闪避"外的额外总额,由调用方处理。
 */
export function aggregateDefense(bonuses: DefenseBonus[]): {
  slots: Record<DefenseSlot, number>;
  total: number;
  log: string[];
} {
  const slots = Object.fromEntries(DEFENSE_SLOTS.map((s) => [s, 0])) as Record<DefenseSlot, number>;
  const log: string[] = [];
  const bySlot = new Map<DefenseSlot, DefenseBonus[]>();
  for (const b of bonuses) {
    if (!bySlot.has(b.slot)) bySlot.set(b.slot, []);
    bySlot.get(b.slot)!.push(b);
  }
  for (const [slot, list] of bySlot) {
    const pos = list.filter((b) => b.value > 0);
    const neg = list.filter((b) => b.value < 0);
    let v = 0;
    if (slot === "基础") {
      v = pos.reduce((a, b) => a + b.value, 0);
    } else if (pos.length > 0) {
      v = Math.max(...pos.map((b) => b.value));
    }
    v += neg.reduce((a, b) => a + b.value, 0);
    slots[slot] = v;
    if (v !== 0) log.push(`${slot}: ${v >= 0 ? "+" : ""}${v}`);
  }
  const total = Object.values(slots).reduce((a, b) => a + b, 0);
  return { slots, total, log };
}

/** 多次攻击减值:每被攻击1次+1点,依序扣 格挡→闪避→基础(至0)。 */
export function applyMultiAttackPenalty(
  slots: Record<DefenseSlot, number>,
  priorAttackCount: number,
): Record<DefenseSlot, number> {
  const out = { ...slots };
  let remain = priorAttackCount;
  for (const slot of ["格挡", "闪避", "基础"] as DefenseSlot[]) {
    if (remain <= 0) break;
    const cur = out[slot] ?? 0;
    if (cur > 0) {
      const cut = Math.min(cur, remain);
      out[slot] = cur - cut;
      remain -= cut;
    }
  }
  return out;
}
