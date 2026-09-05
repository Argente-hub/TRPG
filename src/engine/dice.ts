/**
 * 骰子引擎:D10 骰池。
 * - 掷 DP 枚 D10,8/9/10 各记 1 个成功(自然成功);
 * - 加骰:骰出 ≥again(默认 10,可 9/8)再掷,递归;
 * - 附加成功:仅当自然成功数 > 0 时计入总成功数;
 * - 机运骰:DP ≤ 0 时仍可投 1 枚 D10,仅 10 算成功(可正常加骰);
 *   掷骰过程中若从未投出任何成功,则自然 1 视为大失败;
 * - 多次投骰取高/取低:额外次数按加减合并(2次取高+3次取高=4次取高;2取高+2取低=1次)。
 */
import { atLeast0 } from "./math";

export type Rng = () => number;

/** 可注入的随机源(默认 Math.random),便于测试。 */
export const defaultRng: Rng = Math.random;

function d10(rng: Rng): number {
  return Math.floor(rng() * 10) + 1;
}

export interface RollOptions {
  /** 骰池(DP),可为 0 或负数 => 机运骰 */
  pool: number;
  /** 加骰面:10(默认)/9/8,最低 8 */
  again?: number;
  /** 附加成功数(仅在自然成功 > 0 时计入) */
  bonusSuccesses?: number;
  rng?: Rng;
}

export interface RollResult {
  /** 实际初始骰数(机运骰为 1) */
  pool: number;
  /** 是否机运骰 */
  chanceDie: boolean;
  /** 每一轮掷出的骰面(含加骰轮),按轮分组 */
  rounds: number[][];
  /** 自然成功数(不含附加成功) */
  natural: number;
  /** 附加成功(自然成功>0 时计入) */
  bonus: number;
  /** 总成功数 */
  total: number;
  /** 大失败(仅机运骰且从未投出成功时自然 1) */
  botch: boolean;
}

/** 投一次骰池(含加骰递归)。 */
export function rollPool(opts: RollOptions): RollResult {
  const rng = opts.rng ?? defaultRng;
  const again = Math.max(8, opts.again ?? 10);
  const bonus = opts.bonusSuccesses ?? 0;
  const chanceDie = opts.pool <= 0;
  const rounds: number[][] = [];
  let natural = 0;
  let botch = false;

  let diceCount = chanceDie ? 1 : Math.max(0, opts.pool);
  // 防御:加骰理论上可无限,设置上限避免死循环(实际规则由 ST 把关)
  let guard = 0;
  while (diceCount > 0 && guard < 10000) {
    guard++;
    const roll: number[] = [];
    for (let i = 0; i < diceCount; i++) roll.push(d10(rng));
    rounds.push(roll);
    const successes = roll.filter((d) => d >= 8).length;
    natural += successes;
    // 机运骰:整次检定从未投出成功时,自然 1 => 大失败
    if (chanceDie && natural === 0 && roll.some((d) => d === 1)) {
      botch = true;
    }
    diceCount = roll.filter((d) => d >= again).length;
  }

  const total = natural > 0 ? natural + bonus : 0;
  return {
    pool: chanceDie ? Math.min(0, opts.pool) : opts.pool,
    chanceDie,
    rounds,
    natural,
    bonus: natural > 0 ? bonus : 0,
    total,
    botch,
  };
}

/**
 * 多次投骰取高/取低。extra 高低次数按加减合并:
 * 例:3次取高 与 2次取高 => 1+2+1=4次取高;2次取高 与 2次取低 => 投1次。
 */
export function rollMultiple(
  opts: RollOptions,
  keepHighest: number,
  keepLowest: number,
): RollResult {
  const extra = Math.max(0, keepHighest - 1) + Math.max(0, keepLowest - 1);
  const totalRolls = 1 + extra;
  let best: RollResult | null = null;
  for (let i = 0; i < totalRolls; i++) {
    const r = rollPool(opts);
    if (best === null) {
      best = r;
      continue;
    }
    if (keepHighest > 0) {
      if (r.total > best.total) best = r;
    } else if (keepLowest > 0) {
      if (r.total < best.total) best = r;
    }
  }
  return best!;
}

/** 先攻:1D10 + 先攻值(非检定,不受检定加值影响,最低1)。 */
export function rollInitiative(initiativeValue: number, rng: Rng = defaultRng): number {
  return Math.max(1, d10(rng) + initiativeValue);
}
