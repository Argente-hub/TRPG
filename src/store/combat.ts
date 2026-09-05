import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AttributeKey, CustomBonus } from "../engine/character";
import { emptyWounds, WoundState } from "../engine/combat";

export interface AttackDef {
  id: string;
  name: string;
  attr: string;
  skill: string;
  skillLevel: number;
  weaponDamage: number;
  /** 常驻DP上的其他加值(已含专业时自行计入数值) */
  extraDp: number;
  /** 伤害上限(属性+技能+武器伤害);固定伤害用 Infinity(存 -1) */
  cap: number;
  type: "B" | "L" | "A";
  bonusSuccesses: number;
  /** 武器特性 */
  highSpeed: number;
  breakArmor: number;
  breakMagic: number;
  again: 10 | 9 | 8;
  /** 触及/射程(米,0=不适用) */
  reach: number;
  range: number;
  note?: string;
  /** 范围攻击:不扣防御,走反射豁免 */
  area?: boolean;
}

export interface Combatant {
  id: string;
  name: string;
  isPC: boolean;
  characterId?: string;
  attrs: Record<string, number>;
  skills: Record<string, number>;
  hpMax: number;
  wounds: WoundState;
  willpower: { cur: number; max: number };
  initiativeMod: number;
  initTotal: number | null;
  defenseSlots: Record<string, number>;
  defenseBonusSuccesses: number;
  /** 减伤链输入 */
  hardness: number;
  dr: number;
  energyResist: number;
  absorb: number;
  threshold: number;
  immuneTypes: string[];
  attacks: AttackDef[];
  conditions: Record<string, number>;
  energy: { name: string; cur: number; max: number }[];
  customBonuses: CustomBonus[];
  /** 本轮已受攻击次数(多次攻击减值) */
  priorAttacks: number;
  note?: string;
}

export interface LogItem { id: number; time: number; text: string }

interface CombatState {
  combatants: Combatant[];
  round: number;
  turnIdx: number;
  started: boolean;
  selectedId: string | null;
  log: LogItem[];
  setCombatants: (list: Combatant[]) => void;
  addCombatant: (c: Combatant) => void;
  removeCombatant: (id: string) => void;
  update: (id: string, fn: (c: Combatant) => void) => void;
  select: (id: string | null) => void;
  startCombat: () => void;
  nextTurn: () => void;
  addLog: (text: string) => void;
  reset: () => void;
}

export const useCombat = create<CombatState>()(
  persist(
    (set, get) => ({
      combatants: [],
      round: 1,
      turnIdx: 0,
      started: false,
      selectedId: null,
      log: [],
      setCombatants: (list) => set({ combatants: list }),
      addCombatant: (c) => set((s) => ({ combatants: [...s.combatants, c] })),
      removeCombatant: (id) =>
        set((s) => ({ combatants: s.combatants.filter((c) => c.id !== id) })),
      update: (id, fn) =>
        set((s) => ({
          combatants: s.combatants.map((c) => {
            if (c.id !== id) return c;
            const copy = structuredClone(c);
            fn(copy);
            return copy;
          }),
        })),
      select: (id) => set({ selectedId: id }),
      startCombat: () => {
        // 掷先攻:1D10 + 先攻值
        const list = get().combatants.map((c) => ({
          ...structuredClone(c),
          initTotal: Math.max(1, Math.floor(Math.random() * 10) + 1 + c.initiativeMod),
          priorAttacks: 0,
        }));
        list.sort((a, b) => (b.initTotal ?? 0) - (a.initTotal ?? 0));
        set({ combatants: list, started: true, round: 1, turnIdx: 0 });
        get().addLog(`战斗开始!先攻顺序:${list.map((c) => `${c.name}${c.initTotal}`).join(" > ")}`);
      },
      nextTurn: () => {
        const s = get();
        if (!s.started || s.combatants.length === 0) return;
        let idx = s.turnIdx + 1;
        let round = s.round;
        if (idx >= s.combatants.length) {
          idx = 0;
          round += 1;
        }
        // 新回合开始:清空当前行动者的多次攻击减值
        const cur = s.combatants[idx];
        const list = s.combatants.map((c) =>
          c.id === cur.id ? { ...structuredClone(c), priorAttacks: 0 } : c,
        );
        set({ turnIdx: idx, round, combatants: list });
        get().addLog(`—— 第${round}轮:${cur.name} 的回合 ——`);
      },
      addLog: (text) =>
        set((s) => ({
          log: [{ id: Date.now() + Math.random(), time: Date.now(), text }, ...s.log].slice(0, 200),
        })),
      reset: () => set({ combatants: [], round: 1, turnIdx: 0, started: false, selectedId: null, log: [] }),
    }),
    { name: "wuxian-combat" },
  ),
);

export function makeNpc(name: string): Combatant {
  return {
    id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    name,
    isPC: false,
    attrs: { 力量: 2, 敏捷: 2, 耐力: 2, 智力: 2, 感知: 2, 决心: 2, 风度: 2, 操控: 2, 沉着: 2 },
    skills: {},
    hpMax: 7,
    wounds: emptyWounds(),
    willpower: { cur: 4, max: 4 },
    initiativeMod: 4,
    initTotal: null,
    defenseSlots: { 基础: 2, 闪避: 0, 天生: 0, 盔甲: 0, 盾牌: 0, 格挡: 0, 掩蔽: 0, 偏斜: 0 },
    defenseBonusSuccesses: 0,
    hardness: 0,
    dr: 0,
    energyResist: 0,
    absorb: 0,
    threshold: 0,
    immuneTypes: [],
    attacks: [],
    conditions: {},
    energy: [],
    customBonuses: [],
    priorAttacks: 0,
  };
}

/** 兼容旧存档的攻击字段补全 */
export function normalizeAttack(a: Partial<AttackDef> & { id: string; name: string }): AttackDef {
  return {
    skillLevel: 0, weaponDamage: 0, extraDp: 0, cap: -1, type: "L",
    bonusSuccesses: 0, highSpeed: 0, breakArmor: 0, breakMagic: 0,
    again: 10, reach: 0, range: 0,
    ...a,
  } as AttackDef;
}
