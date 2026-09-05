import { describe, expect, it } from "vitest";
import { emptyCharacter, CharacterData, deriveStats, skillBonusSuccesses } from "./character";
import {
  RULES,
  attrTotalCost,
  skillTotalCost,
  featBuildCost,
  langFeatPoints,
  rulesOf,
} from "./rules";

/** 构造一个全属性 x 的角色 */
function charWith(rules: "3.25" | "rm", attrs: Record<string, number>): CharacterData {
  const c = emptyCharacter("t", "测试", rules);
  for (const [k, v] of Object.entries(attrs)) c.attributes[k as keyof typeof c.attributes] = v;
  return c;
}

describe("规则版本配置", () => {
  it("3.25:属性基础2/自由6,技能上限4,专长15点累计", () => {
    const cfg = RULES["3.25"];
    expect(cfg.attrBase).toBe(2);
    expect(cfg.attrFreePoints).toBe(6);
    expect(cfg.skillCreateCap).toBe(4);
    expect(cfg.featCreatePoints).toBe(15);
    expect(cfg.featCostModel).toBe("cumulative");
    expect(cfg.skills.find((s) => s.name === "弓箭")).toBeUndefined();
  });

  it("RM:属性基础1/自由3,技能上限3,专长5点逐级,含弓箭", () => {
    const cfg = RULES.rm;
    expect(cfg.attrBase).toBe(1);
    expect(cfg.attrFreePoints).toBe(3);
    expect(cfg.skillCreateCap).toBe(3);
    expect(cfg.featCreatePoints).toBe(5);
    expect(cfg.featCostModel).toBe("perLevel");
    expect(cfg.skills.find((s) => s.name === "弓箭")).toBeDefined();
    expect(cfg.terms.realm).toBe("主神空间");
  });

  it("未知版本回退 3.25", () => {
    expect(rulesOf(undefined).id).toBe("3.25");
    expect(rulesOf("rm").id).toBe("rm");
  });

  it("建卡花费:RM 每级1点;3.25 属性基础2起步、技能3→4耗2", () => {
    // RM:属性 1→4 花 3 点,1→5 花 5 点(4→5 耗 2)
    expect(attrTotalCost(RULES.rm, 4)).toBe(3);
    expect(attrTotalCost(RULES.rm, 5)).toBe(5);
    // 3.25:属性 2→4 花 2 点,2→5 花 4 点
    expect(attrTotalCost(RULES["3.25"], 4)).toBe(2);
    expect(attrTotalCost(RULES["3.25"], 5)).toBe(4);
    // 技能:RM 每级 1 点;3.25 0→3 花 3 点、0→4 花 5 点
    expect(skillTotalCost(RULES.rm, 4)).toBe(4);
    expect(skillTotalCost(RULES["3.25"], 3)).toBe(3);
    expect(skillTotalCost(RULES["3.25"], 4)).toBe(5);
    // 专长:RM 逐级;3.25 累计 1+2+3=6,轮回系×2
    expect(featBuildCost(RULES.rm, 3)).toBe(3);
    expect(featBuildCost(RULES["3.25"], 3)).toBe(6);
    expect(featBuildCost(RULES["3.25"], 3, true)).toBe(12);
  });

  it("语言专长点 = 智力×2", () => {
    expect(langFeatPoints(0)).toBe(0);
    expect(langFeatPoints(2)).toBe(4);
  });

  it("技能附加成功阈值:3.25 五/七/九/十一/十三/十五;RM 五/十/十一/十三/十五", () => {
    expect(skillBonusSuccesses(5, "3.25")).toBe(1);
    expect(skillBonusSuccesses(7, "3.25")).toBe(2);
    expect(skillBonusSuccesses(6, "3.25")).toBe(1);
    expect(skillBonusSuccesses(5, "rm")).toBe(1);
    expect(skillBonusSuccesses(9, "rm")).toBe(1);
    expect(skillBonusSuccesses(10, "rm")).toBe(2);
    expect(skillBonusSuccesses(15, "rm")).toBe(5);
  });
});

describe("RM 衍生属性", () => {
  it("意志值 = 决心+沉着+传奇各+1(3.25 为 ×3)", () => {
    // 决心4 沉着2:传奇均为 0
    const base = charWith("rm", { 决心: 4, 沉着: 2 });
    expect(deriveStats(base).willpowerMax).toBe(6);
    // 决心6 沉着6:传奇各1 → RM 6+6+1+1=14;3.25 6+6+3+3=18
    const rm6 = charWith("rm", { 决心: 6, 沉着: 6 });
    expect(deriveStats(rm6).willpowerMax).toBe(14);
    const v325 = charWith("3.25", { 决心: 6, 沉着: 6 });
    expect(deriveStats(v325).willpowerMax).toBe(18);
  });

  it("先攻 = 敏捷+沉着+传奇沉着(×1);基础防御不含传奇(RM)", () => {
    const c = charWith("rm", { 敏捷: 6, 沉着: 6, 感知: 3 });
    const d = deriveStats(c);
    // 敏捷6 传奇1;沉着6 传奇1
    expect(d.initiative).toBe(6 + 6 + 1);
    expect(d.baseDefense).toBe(Math.min(6, 3));
    // 3.25:先攻 +3×传奇;防御 +传奇敏捷+传奇感知
    const v = charWith("3.25", { 敏捷: 6, 沉着: 6, 感知: 3 });
    const dv = deriveStats(v);
    expect(dv.initiative).toBe(6 + 6 + 3);
    expect(dv.baseDefense).toBe(Math.min(6, 3) + 1 + 0);
  });

  it("速度 = 力量+敏捷+体积+传奇敏捷×3(RM);生命 = 耐力+体积+传奇耐力三角", () => {
    const c = charWith("rm", { 力量: 3, 敏捷: 6, 耐力: 6 });
    const d = deriveStats(c);
    expect(d.speed).toBe(3 + 6 + 5 + 3); // 中型体积5,传奇敏捷1 → +3
    expect(d.hp).toBe(6 + 5 + 1); // 传奇耐力1 → n(n+1)/2 = 1
  });

  it("RM 意志豁免 DP = 意志值(决心+沉着+传奇)", () => {
    const c = charWith("rm", { 决心: 4, 沉着: 3 });
    const d = deriveStats(c);
    expect(d.saves.意志.formula).toContain("意志值");
    // attr+skill+perfect = 决心4+沉着3+0 = 7 = 意志值
    expect(d.attrTotals[d.saves.意志.attr] + 3).toBe(7);
  });

  it("XP 花费:RM 0→1 为 3,1→2 为 1,2→3 为 2;专长每级 2×等级", () => {
    const cfg = RULES.rm;
    expect(cfg.skillUpXpCost(0)).toBe(3);
    expect(cfg.skillUpXpCost(1)).toBe(1);
    expect(cfg.skillUpXpCost(2)).toBe(2);
    expect(cfg.skillUpXpCost(3)).toBe(4);
    expect(cfg.featUpXpCost(3, "死硬")).toBe(6);
    expect(cfg.featUpXpCost(3, "语言")).toBe(2);
    // 3.25 对照
    expect(RULES["3.25"].skillUpXpCost(2)).toBe(4);
    expect(RULES["3.25"].featUpXpCost(2, "任意")).toBe(3);
  });
});
