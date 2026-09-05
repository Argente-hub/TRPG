import { describe, expect, it } from "vitest";
import { heavyThreshold, catastrophicThreshold, severityOf } from "./conditions";
import { missionReward, convertMissionsUp, convertMissionsDown, attributeUpCost, skillUpCostXp } from "./economy";
import { spellPower, spellCost, castCheck } from "./energy";

describe("不良状态门槛", () => {
  const getAttr = (n: string) => (n === "耐力" ? 6 : n === "决心" ? 3 : 2);
  const dizzy = { name: "晕眩", attrs: ["耐力", "决心"] as [string, string], save: "强韧" as const, light: "", heavy: "", catastrophic: "" };

  it("重度门槛 = 较高属性 × (传奇+1):耐力6(传奇1) => 12", () => {
    expect(heavyThreshold(dizzy.attrs, getAttr)).toBe(12);
  });

  it("毁灭性门槛 = 属性和 × (传奇和+1):9 × 2 = 18", () => {
    expect(catastrophicThreshold(dizzy.attrs, getAttr)).toBe(18);
  });

  it("严重度判定", () => {
    expect(severityOf(0, dizzy, getAttr)).toBe("无");
    expect(severityOf(1, dizzy, getAttr)).toBe("轻度");
    expect(severityOf(12, dizzy, getAttr)).toBe("轻度"); // 12 不大于 12
    expect(severityOf(13, dizzy, getAttr)).toBe("重度");
    expect(severityOf(19, dizzy, getAttr)).toBe("毁灭性");
  });
});

describe("经济", () => {
  it("通关奖励:第5场 C+3000,第7场 C+D+4000,第9场 C+DD+5000", () => {
    expect(missionReward(5)).toMatchObject({ missions: { C: 1 }, points: 3000 });
    expect(missionReward(7)).toMatchObject({ missions: { C: 1, D: 1 }, points: 4000 });
    expect(missionReward(9)).toMatchObject({ missions: { C: 1, D: 2 }, points: 5000 });
  });

  it("支线拆合:3D=C,可逆拆", () => {
    const m = { D: 3, C: 0, B: 0, A: 0, S: 0 };
    const up = convertMissionsUp(m, "D")!;
    expect(up).toMatchObject({ D: 0, C: 1 });
    const down = convertMissionsDown(up, "C")!;
    expect(down).toMatchObject({ C: 0, D: 3 });
  });

  it("属性+1 价格:当前值×200分(0→1为100)", () => {
    expect(attributeUpCost(0).points).toBe(100);
    expect(attributeUpCost(3).points).toBe(600);
    expect(attributeUpCost(3).xp).toBe(12);
  });

  it("技能升级 = 当前级×2XP(0→1为1)", () => {
    expect(skillUpCostXp(0)).toBe(1);
    expect(skillUpCostXp(4)).toBe(8);
  });
});

describe("施法", () => {
  it("威力值 D2/C4/B8/A16/S32;能耗 D1/C3/B5/A7/S9", () => {
    expect(spellPower("D")).toBe(2);
    expect(spellPower("B")).toBe(8);
    expect(spellPower("S")).toBe(32);
    expect(spellCost("C")).toBe(3);
    expect(spellCost("S")).toBe(9);
  });

  it("施法 DP = 关键属性+神秘学+威力值", () => {
    const r = castCheck("魔法", () => 6, 4, "C");
    expect(r.dpBase).toBe(6 + 4 + 4);
    expect(r.cap).toBe(14);
    expect(r.cost).toBe(3);
  });
});
