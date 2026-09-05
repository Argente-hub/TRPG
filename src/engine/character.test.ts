import { describe, expect, it } from "vitest";
import {
  attrRaiseCost,
  deriveStats,
  emptyCharacter,
  featLevelCost,
  flawPointsToTalentPoints,
  skillBonusSuccesses,
  skillRaiseCost,
  untrainedPenalty,
} from "./character";

describe("建卡花费", () => {
  it("属性 4→5 耗 2,其余 1", () => {
    expect(attrRaiseCost(2)).toBe(1);
    expect(attrRaiseCost(3)).toBe(1);
    expect(attrRaiseCost(4)).toBe(2);
  });

  it("技能 3→4 耗 2,其余 1", () => {
    expect(skillRaiseCost(0)).toBe(1);
    expect(skillRaiseCost(2)).toBe(1);
    expect(skillRaiseCost(3)).toBe(2);
  });

  it("专长累计花费 1+2+...+n;轮回专长×2", () => {
    expect(featLevelCost(3)).toBe(6);
    expect(featLevelCost(4)).toBe(10);
    expect(featLevelCost(3, true)).toBe(12);
  });

  it("缺陷点每2点=1天赋点", () => {
    expect(flawPointsToTalentPoints(0)).toBe(0);
    expect(flawPointsToTalentPoints(3)).toBe(1);
    expect(flawPointsToTalentPoints(4)).toBe(2);
  });

  it("技能附加成功阈值 5/7/9/11/13/15", () => {
    expect(skillBonusSuccesses(4)).toBe(0);
    expect(skillBonusSuccesses(5)).toBe(1);
    expect(skillBonusSuccesses(7)).toBe(2);
    expect(skillBonusSuccesses(15)).toBe(6);
  });

  it("未受训惩罚", () => {
    expect(untrainedPenalty("生理").loseNaturalSuccesses).toBe(1);
    expect(untrainedPenalty("心智").autoFail).toBe(true);
    expect(untrainedPenalty("互动").loseNaturalSuccesses).toBe(2);
  });
});

describe("衍生属性", () => {
  it("普通人(全2,中型):HP=7,意志=4,防御=2,速度=9", () => {
    const c = emptyCharacter("t", "测试");
    const d = deriveStats(c);
    expect(d.hp).toBe(7); // 耐力2 + 中型5
    expect(d.willpowerMax).toBe(4);
    expect(d.initiative).toBe(4);
    expect(d.baseDefense).toBe(2); // min(敏2,感2)
    expect(d.speed).toBe(9); // 力2+敏2+5
  });

  it("传奇属性:耐力6 => HP+1;敏6感6 => 防御+2", () => {
    const c = emptyCharacter("t", "传奇");
    c.attributes["耐力"] = 6;
    c.attributes["敏捷"] = 6;
    c.attributes["感知"] = 6;
    const d = deriveStats(c);
    expect(d.hp).toBe(6 + 5 + 1); // 耐力6+体型5+三角1
    expect(d.baseDefense).toBe(6 + 1 + 1); // min(6,6)+传奇1+传奇1
  });
});
