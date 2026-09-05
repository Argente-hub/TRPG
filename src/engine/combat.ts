/**
 * 战斗规则引擎(《生命值与意志力》《战斗规则》《伤害类型与防御类型》)。
 */
import { atLeast0, floorDiv } from "./math";
import { rollPool, RollResult, Rng, defaultRng } from "./dice";

// ---------------- 生命值与伤势 ----------------

export type WoundType = "B" | "L" | "A"; // 冲击 / 严重 / 恶性

export interface WoundState {
  b: number;
  l: number;
  a: number;
  /** 溢出的伤害(不计数值,仅标记) */
  overflow: number;
}

export function emptyWounds(): WoundState {
  return { b: 0, l: 0, a: 0, overflow: 0 };
}

export function intactCount(w: WoundState, maxHp: number): number {
  return Math.max(0, maxHp - (w.b + w.l + w.a));
}

export function isDead(w: WoundState, maxHp: number): boolean {
  return w.a >= maxHp;
}

export function isUnconscious(w: WoundState, maxHp: number): boolean {
  return intactCount(w, maxHp) <= 0;
}

/**
 * 造成伤害(《受伤》规则+原书范例):
 * - 伤势直接记入对应级别(完好 = 上限 − B−L−A);
 * - 记录后若 B+L+A > 上限,按 2B→1L、2L→1A 向下转化,直至总和 = 上限;
 * - 转化成对进行(每对减少总量 1);某级剩 1 点且仍需转化时,该 1 点也升一级
 *   (范例:13B→7L;21L→转化12L→6A,留 9L);
 * - 全部为恶性且总和 ≥ 上限 → 死亡;无法转化的溢出仅标记。
 * 返回新状态(不可变)。
 */
export function applyDamage(
  w: WoundState,
  maxHp: number,
  amount: number,
  type: WoundType,
): WoundState {
  const n = { ...w };
  const amt = Math.max(0, Math.floor(amount));
  if (type === "B") n.b += amt;
  else if (type === "L") n.l += amt;
  else n.a += amt;

  const sum = () => n.b + n.l + n.a;
  let guard = 0;
  while (sum() > maxHp && guard < 1000) {
    guard++;
    const excess = sum() - maxHp;
    if (n.b > 0) {
      // 2B→1L 成对转化;若对数不足以消化溢出,余下的 1B 也升为 1L(范例 13B→7L)
      const pairs = Math.min(Math.floor(n.b / 2), excess);
      n.b -= pairs * 2;
      n.l += pairs;
      if (n.b === 1 && sum() > maxHp) {
        n.b = 0;
        n.l += 1;
      }
    } else if (n.l > 0) {
      // 2L→1A 成对转化,只转化到总和 = 上限为止(范例:转化12L→6A,留 9L)
      const pairs = Math.min(Math.floor(n.l / 2), excess);
      n.l -= pairs * 2;
      n.a += pairs;
      if (n.l === 1 && sum() > maxHp) {
        n.l = 0;
        n.a += 1;
      }
    } else {
      // 全为恶性:无法继续转化,溢出仅标记(此时 a ≥ 上限,死亡)
      n.overflow += excess;
      break;
    }
  }
  return n;
}

/** 治疗:把指定级别的伤势恢复为完好。短休:B→完好;长休:L→完好 或 A→L。 */
export function healWounds(w: WoundState, mode: "B" | "L" | "AtoL"): WoundState {
  const n = { ...w };
  if (mode === "B") n.b = 0;
  else if (mode === "L") n.l = 0;
  else {
    n.l += n.a;
    n.a = 0;
  }
  return n;
}

/** 物品/载具受伤:免疫B,L/A 直接扣生命值,归 0 即摧毁。 */
export function itemDamage(currentStructure: number, amount: number, type: WoundType): number {
  if (type === "B") return currentStructure;
  return Math.max(0, currentStructure - Math.max(0, amount));
}

// ---------------- 意志力 ----------------

/** 意志力用途:任一单次检定行动付 1 点 => 3DP 完美加值(每次行动限 1 次)。 */
export const WILLPOWER_BONUS_DP = 3;
export const WILLPOWER_DEFENSE_BONUS = 3;

// ---------------- 防御与攻击 ----------------

export interface DefenseProfile {
  /** 各槽位防御值(基础/闪避/天生/盔甲/盾牌/格挡/掩蔽/偏斜) */
  slots: Record<string, number>;
  /** 防御附加成功数 */
  bonusSuccesses: number;
}

/** 总防御 = 各槽位之和。 */
export function totalDefense(d: DefenseProfile): number {
  return Object.values(d.slots).reduce((a, b) => a + b, 0);
}

export interface AttackInput {
  /** 攻击骰池 = 属性+技能+武器伤害(+调整),不含防御;函数内部会减去目标总防御 */
  dp: number;
  /** 【高速X】:按 格挡→闪避→基础 顺序减防(最多至0) */
  highSpeed?: number;
  /** 【破甲X】:按 盾牌→盔甲→天生 顺序 1:1 击破 */
  breakArmor?: number;
  /** 攻击方附加成功 */
  attackBonus: number;
  /** 伤害上限(属性+技能+武器伤害);固定伤害传 Infinity */
  damageCap: number;
  targetDefense: DefenseProfile;
  damageType: WoundType;
  /** 是否范围攻击(不扣防御,防御方按反射豁免) */
  areaAttack?: boolean;
  /** 本次行动前目标已被攻击的次数(多次攻击减值) */
  priorAttacks?: number;
  rng?: Rng;
}

export interface AttackOutcome {
  roll: RollResult;
  dpUsed: number;
  /** 用的防御值(已扣多次攻击减值) */
  defenseUsed: number;
  /** 是否命中(自然成功 > 防御附加成功;范围攻击无条件命中范围内者) */
  hit: boolean;
  /** 最终成功数(命中后加攻击附加成功) */
  finalSuccesses: number;
  /** 上限后伤害(未扣减伤链) */
  rawDamage: number;
  targetDefense: DefenseProfile;
}

/**
 * 攻击结算:
 * 1. DP = 属性+技能+武器伤害 − 目标总防御(范围攻击不扣防御);
 * 2. 命中判定:自然成功数 > 防御附加成功数;
 * 3. 命中后加攻击附加成功得最终成功数;
 * 4. 伤害 = 每成功数 1 点,受伤害上限约束。
 */
export function resolveAttack(input: AttackInput): AttackOutcome {
  let def: DefenseProfile = input.targetDefense;
  let dp = input.dp;
  if (!input.areaAttack) {
    const slots = { ...input.targetDefense.slots };
    // 【破甲X】:按 盾牌→盔甲→天生 顺序 1:1 击破
    let armor = input.breakArmor ?? 0;
    for (const slot of ["盾牌", "盔甲", "天生"]) {
      if (armor <= 0) break;
      const cur = slots[slot] ?? 0;
      if (cur > 0) {
        const cut = Math.min(cur, armor);
        slots[slot] = cur - cut;
        armor -= cut;
      }
    }
    // 【高速X】与多次攻击减值:都按 格挡→闪避→基础 顺序
    let speedCut = (input.highSpeed ?? 0) + (input.priorAttacks ?? 0);
    for (const slot of ["格挡", "闪避", "基础"]) {
      if (speedCut <= 0) break;
      const cur = slots[slot] ?? 0;
      if (cur > 0) {
        const cut = Math.min(cur, speedCut);
        slots[slot] = cur - cut;
        speedCut -= cut;
      }
    }
    def = { ...input.targetDefense, slots };
    dp = input.dp - totalDefense(def);
  }

  const roll = rollPool({ pool: dp, bonusSuccesses: 0, rng: input.rng ?? defaultRng });
  const hit = input.areaAttack || roll.natural > def.bonusSuccesses;
  const finalSuccesses = hit ? roll.total + input.attackBonus : 0;
  const rawDamage = hit
    ? input.damageCap === Infinity
      ? finalSuccesses
      : Math.min(finalSuccesses, input.damageCap)
    : 0;
  return {
    roll,
    dpUsed: dp,
    defenseUsed: totalDefense(def),
    hit,
    finalSuccesses,
    rawDamage,
    targetDefense: def,
  };
}

// ---------------- 伤害类型与减伤链 ----------------

export const PHYSICAL_TYPES = ["钝击", "挥砍", "穿刺", "实弹", "普通物理"] as const;
export const ENERGY_TYPES = ["纯能量", "火焰", "寒冰", "雷电", "腐蚀", "光明", "黑暗", "音波", "光能"] as const;
export const SPECIAL_TYPES = ["精神", "力场", "毒素"] as const;
export type DamageType = (typeof PHYSICAL_TYPES)[number] | (typeof ENERGY_TYPES)[number] | (typeof SPECIAL_TYPES)[number];

export function isPhysical(t: DamageType): boolean {
  return (PHYSICAL_TYPES as readonly string[]).includes(t);
}
export function isEnergy(t: DamageType): boolean {
  return (ENERGY_TYPES as readonly string[]).includes(t);
}
/** 音波/光能无视硬度 */
export function ignoresHardness(t: DamageType): boolean {
  return t === "音波" || t === "光能";
}

export interface DamageInstance {
  amount: number;
  types: DamageType[];
  /** 固定伤害无视伤害上限(由调用方处理);不可避免伤害不可减免 */
  unavoidable?: boolean;
}

export interface DefenseReduction {
  /** 硬度(物品) */
  hardness?: number;
  /** 伤害减免 DR(只防物理) */
  dr?: number;
  /** 全能量抗力(只防能量) */
  energyResist?: number;
  /** 吸收点数 */
  absorb?: number;
  /** 阈值:最终伤害低于阈值时无效 */
  threshold?: number;
  /** 免疫的伤害类型 */
  immuneTypes?: DamageType[];
  /** 易伤:最终伤害翻倍 或 +X */
  vulnerableDouble?: boolean;
  vulnerableX?: number;
}

export interface ReductionOutcome {
  final: number;
  absorbedBy: { step: string; amount: number }[];
  immune: boolean;
}

/**
 * 减伤链(v1 实现核心步):
 * 免疫 → 硬度(物理全额抵消;能量抵消后余量减半;音波/光能无视硬度)
 * → DR(物理) → 能量抗力(能量) → 吸收 → 阈值 → 易伤。
 * 混合伤害需同时持有对应防御才生效(v1 按类型分别处理)。
 */
export function applyReductionChain(
  dmg: DamageInstance,
  def: DefenseReduction,
): ReductionOutcome {
  const log: { step: string; amount: number }[] = [];
  let amount = Math.max(0, Math.floor(dmg.amount));

  // 免疫
  if (dmg.unavoidable) {
    // 不可避免伤害不可减免,直接跳到易伤结算
  } else if (def.immuneTypes?.some((t) => dmg.types.includes(t))) {
    return { final: 0, absorbedBy: [{ step: "免疫", amount }], immune: true };
  }

  if (!dmg.unavoidable) {
    // 硬度与抵消
    const hasHardness = (def.hardness ?? 0) > 0;
    if (hasHardness) {
      const anyNonHardnessIgnore = dmg.types.some(ignoresHardness);
      if (!anyNonHardnessIgnore) {
        const h = def.hardness!;
        amount -= h;
        log.push({ step: `硬度 ${h}`, amount: h });
        if (amount <= 0) return { final: 0, absorbedBy: log, immune: false };
        // 能量伤害被硬度抵消后余量减半
        if (dmg.types.every(isEnergy) && !dmg.types.some(isPhysical)) {
          const halfCut = amount - floorDiv(amount, 2);
          amount = floorDiv(amount, 2);
          log.push({ step: "能量余量减半", amount: halfCut });
        }
      }
    }

    // DR(只防物理伤害;混合伤害中物理部分按 DR 处理——v1:伤害含物理类型即全额受 DR)
    const drV = def.dr ?? 0;
    if (drV > 0 && dmg.types.some(isPhysical)) {
      const cut = Math.min(drV, amount);
      amount -= cut;
      log.push({ step: `DR ${drV}`, amount: cut });
      if (amount <= 0) return { final: 0, absorbedBy: log, immune: false };
    }

    // 能量抗力(只防能量)
    const erV = def.energyResist ?? 0;
    if (erV > 0 && dmg.types.some(isEnergy)) {
      const cut = Math.min(erV, amount);
      amount -= cut;
      log.push({ step: `能量抗力 ${erV}`, amount: cut });
      if (amount <= 0) return { final: 0, absorbedBy: log, immune: false };
    }

    // 吸收
    const abV = def.absorb ?? 0;
    if (abV > 0) {
      const cut = Math.min(abV, amount);
      amount -= cut;
      log.push({ step: `吸收 ${abV}`, amount: cut });
      if (amount <= 0) return { final: 0, absorbedBy: log, immune: false };
    }

    // 阈值
    const thV = def.threshold ?? 0;
    if (thV > 0 && amount < thV) {
      log.push({ step: `阈值 ${thV}(伤害 ${amount} < 阈值)`, amount });
      return { final: 0, absorbedBy: log, immune: false };
    }
  }

  // 易伤
  if (def.vulnerableDouble) {
    log.push({ step: "易伤(翻倍)", amount });
    amount *= 2;
  }
  if (def.vulnerableX && def.vulnerableX > 0) {
    amount += def.vulnerableX;
    log.push({ step: `易伤 +${def.vulnerableX}`, amount: def.vulnerableX });
  }

  return { final: atLeast0(Math.floor(amount)), absorbedBy: log, immune: false };
}
