import { describe, expect, it } from "vitest";
import {
  aggregateDpBonuses,
  aggregateDefense,
  applyMultiAttackPenalty,
} from "./bonus";

describe("加值体系", () => {
  it("同类型不叠加取最高", () => {
    const r = aggregateDpBonuses([
      { type: "增强", value: 2 },
      { type: "增强", value: 4 },
      { type: "增强", value: 3 },
    ]);
    expect(r.positive).toBe(4);
  });

  it("不同类型叠加", () => {
    const r = aggregateDpBonuses([
      { type: "增强", value: 2 },
      { type: "士气", value: 3 },
    ]);
    expect(r.positive).toBe(5);
  });

  it("完美可与任何加值叠加(含同类)", () => {
    const r = aggregateDpBonuses([
      { type: "增强", value: 2 },
      { type: "完美", value: 3 },
      { type: "完美", value: 1 },
    ]);
    expect(r.positive).toBe(6);
  });

  it("内在:同源跨等级叠加,异源取最高", () => {
    const r = aggregateDpBonuses([
      { type: "内在", value: 1, sourceId: "血统A-D" },
      { type: "内在", value: 2, sourceId: "血统A-C" },
      { type: "内在", value: 3, sourceId: "血统B-C" },
    ]);
    // 血统A:1+2=3;血统B:3 => 取3
    expect(r.positive).toBe(3);
  });

  it("减值无限叠,加减并存各取合计", () => {
    const r = aggregateDpBonuses([
      { type: "增强", value: 4 },
      { type: "环境", value: -2 },
      { type: "士气", value: -1 },
    ]);
    expect(r.positive).toBe(4);
    expect(r.negative).toBe(-3);
    expect(r.total).toBe(1);
  });

  it("瞄准加值可叠", () => {
    const r = aggregateDpBonuses([
      { type: "瞄准", value: 1 },
      { type: "瞄准", value: 1 },
      { type: "瞄准", value: 1 },
    ]);
    expect(r.positive).toBe(3);
  });
});

describe("防御槽位", () => {
  it("同槽取最高,基础可叠", () => {
    const r = aggregateDefense([
      { slot: "闪避", value: 2 },
      { slot: "闪避", value: 5 },
      { slot: "盔甲", value: 3 },
    ]);
    expect(r.slots["闪避"]).toBe(5);
    expect(r.slots["盔甲"]).toBe(3);
    expect(r.total).toBe(8);
  });

  it("多次攻击减值依序扣 格挡→闪避→基础", () => {
    const slots = { 基础: 5, 闪避: 2, 格挡: 1, 天生: 0, 盔甲: 0, 盾牌: 0, 掩蔽: 0, 偏斜: 0 };
    const out = applyMultiAttackPenalty(slots, 4);
    // 第1点扣格挡(1→0);第2点扣闪避(2→1)后剩1,第3点扣闪避(1→0);第4点扣基础(5→4)
    expect(out["格挡"]).toBe(0);
    expect(out["闪避"]).toBe(0);
    expect(out["基础"]).toBe(4);
  });
});
