import { describe, expect, it } from "vitest";
import {
  applyDamage,
  emptyWounds,
  healWounds,
  intactCount,
  isDead,
  isUnconscious,
  resolveAttack,
  applyReductionChain,
} from "./combat";

describe("伤势填充与溢出(按原书范例)", () => {
  it("20HP 受 3B → 17完好+3B(伤势立即记录)", () => {
    const w = applyDamage(emptyWounds(), 20, 3, "B");
    expect(w.b).toBe(3);
    expect(intactCount(w, 20)).toBe(17);
  });

  it("范例前半:3B 后 4L 后 5A → 8完好+3B+4L+5A", () => {
    let w = applyDamage(emptyWounds(), 20, 3, "B");
    w = applyDamage(w, 20, 4, "L");
    w = applyDamage(w, 20, 5, "A");
    expect(w).toMatchObject({ b: 3, l: 4, a: 5 });
    expect(intactCount(w, 20)).toBe(8);
  });

  it("范例后半:13B+14L+5A 转化 → 9L+11A(死亡线)", () => {
    let w = { b: 3, l: 4, a: 5, overflow: 0 };
    w = applyDamage(w, 20, 10, "B"); // 13B
    w = applyDamage(w, 20, 10, "L"); // 14L,总 32 > 20 → 转化
    // 13B→7L(成对6+余1),得 21L+5A=26;再 12L→6A → 9L+11A=20
    expect(w).toMatchObject({ b: 0, l: 9, a: 11 });
    expect(w.b + w.l + w.a).toBe(20);
  });

  it("全部转为恶性即死亡", () => {
    const w = applyDamage(emptyWounds(), 3, 10, "A");
    expect(isDead(w, 3)).toBe(true);
  });

  it("无完好即昏迷:总和等于上限时无需转化(8HP 受 8B → 8B)", () => {
    const w = applyDamage(emptyWounds(), 8, 8, "B");
    expect(w).toMatchObject({ b: 8, l: 0, a: 0 });
    expect(intactCount(w, 8)).toBe(0);
    expect(isUnconscious(w, 8)).toBe(true);
  });

  it("短休:B→完好;长休:L→完好 或 A→L", () => {
    let w = { b: 2, l: 2, a: 1, overflow: 0 };
    w = healWounds(w, "B");
    expect(w.b).toBe(0);
    w = healWounds(w, "L");
    expect(w.l).toBe(0);
    w = healWounds(w, "AtoL");
    expect(w.a).toBe(0);
    expect(w.l).toBe(1);
  });
});

describe("攻击结算", () => {
  const def = { slots: { 基础: 5, 闪避: 0, 天生: 0, 盔甲: 0, 盾牌: 0, 格挡: 0, 掩蔽: 0, 偏斜: 0 }, bonusSuccesses: 0 };

  it("DP = 属性+技能+武器伤害 − 总防御", () => {
    const out = resolveAttack({
      dp: 10,
      attackBonus: 0,
      damageCap: 6,
      targetDefense: def,
      damageType: "L",
      rng: () => 0.5, // 全部 6,无成功
    });
    expect(out.dpUsed).toBe(5);
  });

  it("命中:自然成功 > 防御附加成功", () => {
    // 5枚骰全10:大量加骰;用受控骰:8,9,10,2,3 => 3成功
    let i = 0;
    const faces = [8, 9, 10, 2, 3, 1, 1, 1];
    const out = resolveAttack({
      dp: 10,
      attackBonus: 2,
      damageCap: 10,
      targetDefense: def,
      damageType: "L",
      rng: () => (faces[i++ % faces.length] - 1) / 10,
    });
    expect(out.hit).toBe(true);
    expect(out.rawDamage).toBe(5); // 3自然+2附加=5,上限10
  });

  it("未命中:自然成功 ≤ 防御附加成功", () => {
    const out = resolveAttack({
      dp: 5, // 减去防御5后掷0骰
      attackBonus: 5,
      damageCap: 10,
      targetDefense: { ...def, bonusSuccesses: 2 },
      damageType: "L",
      rng: () => 0.7,
    });
    expect(out.hit).toBe(false);
    expect(out.rawDamage).toBe(0);
  });

  it("伤害上限约束", () => {
    let i = 0;
    const faces = [9, 9, 9, 9, 9, 9]; // 6成功
    const out = resolveAttack({
      dp: 12,
      attackBonus: 0,
      damageCap: 3,
      targetDefense: def,
      damageType: "L",
      rng: () => (faces[i++ % faces.length] - 1) / 10,
    });
    expect(out.finalSuccesses).toBeGreaterThanOrEqual(6);
    expect(out.rawDamage).toBe(3);
  });
});

describe("减伤链", () => {
  it("物理:硬度全额抵消", () => {
    const r = applyReductionChain(
      { amount: 8, types: ["钝击"] },
      { hardness: 5 },
    );
    expect(r.final).toBe(3);
  });

  it("能量:硬度抵消后余量减半", () => {
    const r = applyReductionChain(
      { amount: 12, types: ["火焰"] },
      { hardness: 2 },
    );
    expect(r.final).toBe(5); // (12-2)/2
  });

  it("音波无视硬度", () => {
    const r = applyReductionChain(
      { amount: 8, types: ["音波"] },
      { hardness: 5 },
    );
    expect(r.final).toBe(8);
  });

  it("DR 只防物理,能量抗力只防能量", () => {
    const def = { dr: 3, energyResist: 4 };
    expect(applyReductionChain({ amount: 10, types: ["挥砍"] }, def).final).toBe(7);
    expect(applyReductionChain({ amount: 10, types: ["雷电"] }, def).final).toBe(6);
  });

  it("阈值:低于阈值无效", () => {
    const r = applyReductionChain({ amount: 4, types: ["钝击"] }, { threshold: 5 });
    expect(r.final).toBe(0);
  });

  it("免疫类型", () => {
    const r = applyReductionChain(
      { amount: 9, types: ["毒素"] },
      { immuneTypes: ["毒素"] },
    );
    expect(r.immune).toBe(true);
    expect(r.final).toBe(0);
  });

  it("不可避免伤害跳过全部减免", () => {
    const r = applyReductionChain(
      { amount: 6, types: ["火焰"], unavoidable: true },
      { hardness: 10, dr: 10, energyResist: 10, absorb: 10, threshold: 10 },
    );
    expect(r.final).toBe(6);
  });

  it("易伤翻倍", () => {
    const r = applyReductionChain(
      { amount: 4, types: ["光明"] },
      { vulnerableDouble: true },
    );
    expect(r.final).toBe(8);
  });
});
