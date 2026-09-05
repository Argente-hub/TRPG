import { describe, expect, it } from "vitest";
import { rollPool, rollMultiple } from "./dice";
import { legendRank, legendTriangle, mergeMultipliers, mergeDivisors } from "./math";

/** 受控 rng:依次吐出指定骰面(1-10),耗尽后固定出 1(不触发加骰,保证终止)。 */
function seqRng(faces: number[]) {
  let i = 0;
  return () => {
    const f = i < faces.length ? faces[i] : 1;
    i++;
    return (f - 1) / 10;
  };
}

describe("math", () => {
  it("传奇属性:(属性-1)/5 向下取整", () => {
    expect(legendRank(5)).toBe(0);
    expect(legendRank(6)).toBe(1);
    expect(legendRank(11)).toBe(2);
    expect(legendRank(16)).toBe(3);
  });

  it("传奇三角收益 n(n+1)/2", () => {
    expect(legendTriangle(0)).toBe(0);
    expect(legendTriangle(1)).toBe(1);
    expect(legendTriangle(2)).toBe(3);
  });

  it("多重乘法合并:2倍+4倍=5倍", () => {
    expect(mergeMultipliers([2, 4])).toBe(5);
    expect(mergeMultipliers([2, 2])).toBe(3);
    expect(mergeMultipliers([2])).toBe(2);
  });

  it("多重除法合并:减半再减半=除以3", () => {
    expect(mergeDivisors([2, 2])).toBe(3);
  });
});

describe("dice:骰池", () => {
  it("8/9/10 为成功", () => {
    const r = rollPool({ pool: 5, rng: seqRng([7, 8, 9, 10, 1]) });
    expect(r.natural).toBe(3);
    expect(r.total).toBe(3);
  });

  it("10 加骰递归", () => {
    // 首轮 [10, 3] -> 加骰 [10] -> 加骰 [1]
    const r = rollPool({ pool: 2, rng: seqRng([10, 3, 10, 1]) });
    expect(r.rounds.length).toBe(3);
    expect(r.natural).toBe(2); // 两个 10
  });

  it("9 加骰:9 和 10 都触发加骰", () => {
    // 轮1:[9,4] 9触发加骰;轮2:[10] 10触发;轮3:[8] 停止 => 3成功
    const r = rollPool({ pool: 2, again: 9, rng: seqRng([9, 4, 10, 8]) });
    expect(r.rounds.length).toBe(3);
    expect(r.natural).toBe(3);
  });

  it("附加成功仅在自然成功>0时计入", () => {
    const fail = rollPool({ pool: 3, bonusSuccesses: 2, rng: seqRng([1, 2, 3]) });
    expect(fail.natural).toBe(0);
    expect(fail.total).toBe(0);

    const ok = rollPool({ pool: 3, bonusSuccesses: 2, rng: seqRng([8, 2, 3]) });
    expect(ok.total).toBe(3);
  });

  it("机运骰:DP<=0 投1枚,仅10成功;从未成功时自然1=大失败", () => {
    const success = rollPool({ pool: 0, rng: seqRng([10]) });
    expect(success.chanceDie).toBe(true);
    expect(success.natural).toBe(1);

    const botch = rollPool({ pool: -2, rng: seqRng([1]) });
    expect(botch.botch).toBe(true);

    const notBotch = rollPool({ pool: -1, rng: seqRng([10, 1]) });
    // 首枚10已有成功,加骰轮的1不再视为大失败
    expect(notBotch.botch).toBe(false);
    expect(notBotch.natural).toBe(1);
  });
});

describe("dice:多次投骰取高/取低", () => {
  it("2次取高取总成功数较高者", () => {
    let call = 0;
    const r = rollMultiple({ pool: 2, rng: () => {
      // 第一次:1,1(0成功);第二次:8,8(2成功)
      const f = call++ === 0 ? 1 : 8;
      return (f - 1) / 10;
    } }, 2, 0);
    expect(r.natural).toBe(2);
  });

  it("2次取高+2次取低 合并为投1次", () => {
    // 无法直接观察次数,但结果应等于单次投骰
    const r = rollMultiple({ pool: 1, rng: seqRng([9]) }, 2, 2);
    expect(r.natural).toBe(1);
  });
});
