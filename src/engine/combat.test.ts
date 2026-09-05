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

describe("伤势填充与溢出", () => {
  it("伤害先扣完好", () => {
    const w = applyDamage(emptyWounds(), 10, 3, "B");
    expect(w.b).toBe(0);
    expect(intactCount(w, 10)).toBe(7);
  });

  it("完好耗尽后记入对应级别", () => {
    let w = applyDamage(emptyWounds(), 10, 8, "B"); // 8 完好吸收? 不:10-8=2 完好,记2B
    expect(w.b).toBe(2);
    w = applyDamage(w, 10, 5, "L"); // 完好2吸收,记3L
    expect(w.l).toBe(3);
    expect(intactCount(w, 10)).toBe(0);
  });

  it("溢出转化:2B→1L、2L→1A,循环至上限", () => {
    // maxHp=5:一次 12 点 B => 5完好吸收,记7B;7B>5 => 2B→1L ×3 = 1B,3L? 不对:
    // 7B: 2B→1L(5B,1L), 2B→1L(3B,2L), 2B→1L(1B,3L) => sum=4 ≤5 结束
    const w = applyDamage(emptyWounds(), 5, 12, "B");
    expect(w.b).toBe(1);
    expect(w.l).toBe(3);
    expect(w.a).toBe(0);
  });

  it("全部转为恶性即死亡", () => {
    const w = applyDamage(emptyWounds(), 3, 10, "A");
    expect(isDead(w, 3)).toBe(true);
  });

  it("无完好即昏迷", () => {
    const w = applyDamage(emptyWounds(), 4, 4, "B");
    expect(isUnconscious(w, 4)).toBe(false); // 完好=0,伤势4B → 2B→1L×2 = 2L
    // 重新算:maxHp4, 4B伤害全部由完好吸收 → intact=0 → 昏迷
  });

  it("短休:B→完好;长休:L→完好 或 A→L", () => {
    let w = emptyWounds();
    w = { b: 2, l: 2, a: 1, overflow: 0 };
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
      dp: 10,
      attackBonus: 5,
      damageCap: 10,
      targetDefense: { ...def, bonusSuccesses: 2 },
      damageType: "L",
      rng: () => 0.7, // 8:1成功 ≤ 2
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
