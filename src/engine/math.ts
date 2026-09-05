/** 通用数学规则:全部向下取整、负值按 0 计算、多重乘除合并。 */

/** 无条件向下取整(负数也向更小取整)。 */
export function floorAll(x: number): number {
  return Math.floor(x);
}

/** 数值在影响计算时不低于 0(规则:负值在计算其相应影响时视为 0)。 */
export function atLeast0(x: number): number {
  return x < 0 ? 0 : x;
}

/**
 * 多重乘法合并:每个额外乘数减一后加到第一个乘数上。
 * 规则原文:2倍 + 4倍 => (2+4-1)=5倍;减半再减半 => 除以 [2+(2-1)]=3。
 * @param multipliers 乘数数组,如 [2,4] => 5
 */
export function mergeMultipliers(multipliers: number[]): number {
  if (multipliers.length === 0) return 1;
  return multipliers.reduce((a, b) => a + b, 0) - (multipliers.length - 1);
}

/**
 * 多重除法合并:与乘法同理,除数合并。
 * @param divisors 除数数组,如 [2,2] => 3(即除以3)
 */
export function mergeDivisors(divisors: number[]): number {
  if (divisors.length === 0) return 1;
  return divisors.reduce((a, b) => a + b, 0) - (divisors.length - 1);
}

/** 向下取整除法。 */
export function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

/** 传奇属性级数:传奇n = (属性-1)/5 向下取整,属性<6 时为 0。 */
export function legendRank(attribute: number): number {
  if (attribute < 6) return 0;
  return Math.floor((attribute - 1) / 5);
}

/** 传奇属性带来的 n(n+1)/2 类收益(伤害上限、HP 等)。 */
export function legendTriangle(rank: number): number {
  if (rank <= 0) return 0;
  return (rank * (rank + 1)) / 2;
}
