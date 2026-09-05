import { useMemo, useState } from "react";
import { useCharacters } from "../store/characters";
import { rollPool, RollResult } from "../engine/dice";
import {
  ATTRIBUTES,
  ATTR_CATEGORIES,
  skillBonusSuccesses,
  untrainedPenalty,
  subSkillBaseOf,
  skillDisplayName,
  skillCategoryOf,
} from "../engine/character";
import { rulesOf } from "../engine/rules";
import { aggregateDpBonuses } from "../engine/bonus";

interface RollLogItem {
  id: number;
  desc: string;
  result: RollResult;
  dc?: number | null;
  dcLabel?: string;
  success?: boolean | null;
}

export default function Dice() {
  const { characters, activeId } = useCharacters();
  const ch = characters.find((c) => c.id === activeId);

  const [attr, setAttr] = useState<string>("力量");
  const [skill, setSkill] = useState<string>("运动");
  const [useSpecialty, setUseSpecialty] = useState(false);
  const [again, setAgain] = useState(10);
  const [manualBonus, setManualBonus] = useState(0);
  const [bonusType, setBonusType] = useState("增强");
  const [bonusSuccesses, setBonusSuccesses] = useState(0);
  const [dcMode, setDcMode] = useState<"none" | "fixed" | "opposed">("none");
  const [dcValue, setDcValue] = useState(2);
  const [useWillpower, setUseWillpower] = useState(false);
  const [history, setHistory] = useState<RollLogItem[]>([]);
  const [last, setLast] = useState<RollLogItem | null>(null);

  const cfg = rulesOf(ch?.rules);
  const skillList = cfg.skills;
  const skillDef = skillList.find((s) => s.name === skill);
  const skillCat = skillDef?.category ?? (subSkillBaseOf(skill) ? skillCategoryOf(skill) : null);
  const skillLevel = ch?.skills[skill] ?? 0;
  const attrValue = ch?.attributes[attr as keyof typeof ch.attributes] ?? 0;

  // 未受训惩罚(3.25 按三系;RM 无此规则)
  const untrained = cfg.hasUntrainedPenalty && skillLevel === 0 && skillCat ? untrainedPenalty(skillCat) : null;

  const dpBreakdown = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${attr}${ch ? attrValue : "(无角色)"}`);
    parts.push(`${skill}${ch ? skillLevel : 0}`);
    if (useSpecialty) parts.push("专业+1");
    return parts;
  }, [attr, skill, useSpecialty, ch, attrValue, skillLevel]);

  const doRoll = () => {
    const bonuses: { type: never; value: number }[] = [];
    if (ch && useSpecialty) bonuses.push({ type: "专业" as never, value: 1 });
    if (manualBonus !== 0) bonuses.push({ type: bonusType as never, value: manualBonus });
    const agg = aggregateDpBonuses(bonuses);
    let pool = (ch ? attrValue + skillLevel : 0) + agg.total;
    if (useWillpower) pool += 3; // 完美加值,叠加一切

    const bs = (ch ? bonusSuccesses : 0) + (ch ? skillBonusSuccesses(skillLevel, ch.rules) : 0);
    const result = rollPool({ pool, again, bonusSuccesses: bs });

    let natural = result.natural;
    let note = "";
    if (untrained) {
      if (untrained.autoFail) {
        note = "未受训(心智系):自动失败";
      } else {
        natural = Math.max(0, natural - untrained.loseNaturalSuccesses);
        note = `未受训(${untrained.loseNaturalSuccesses}系):失去${untrained.loseNaturalSuccesses}自然成功`;
      }
    }
    const finalTotal = natural > 0 ? natural + result.bonus : 0;

    let success: boolean | null = null;
    if (dcMode === "fixed") success = finalTotal >= dcValue;
    if (dcMode === "opposed") success = finalTotal > dcValue;

    const desc = `${ch ? ch.name + " " : ""}${attr}+${skill}${useSpecialty ? "+专业" : ""}`;
    const item: RollLogItem = {
      id: Date.now(),
      desc,
      result: { ...result, natural, total: finalTotal },
      dc: dcMode === "none" ? null : dcValue,
      dcLabel: dcMode === "fixed" ? "竞争" : dcMode === "opposed" ? "对抗" : undefined,
      success,
    };
    if (note) (item as RollLogItem & { note?: string }).note = note;
    setLast(item);
    setHistory((h) => [item, ...h].slice(0, 30));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 左:构建器 */}
      <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40 h-fit">
        <h2 className="font-bold mb-4">检定构建器</h2>

        <div className="text-xs text-zinc-500 mb-3">
          当前角色:
          {ch ? (
            <span className="text-indigo-300 font-bold"> {ch.name}</span>
          ) : (
            <span> 未选择(自由骰)。可在首页点"角色卡"设置激活。</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="text-xs text-zinc-400">
            属性
            <select value={attr} onChange={(e) => setAttr(e.target.value)} className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm">
              {ATTR_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={`${cat}系`}>
                  {ATTRIBUTES[cat].map((k) => (
                    <option key={k} value={k}>{k}{ch ? `(${ch.attributes[k as keyof typeof ch.attributes]})` : ""}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            技能
            <select value={skill} onChange={(e) => setSkill(e.target.value)} className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm">
              {ATTR_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={`${cat}系`}>
                  {skillList.filter((s) => s.category === cat).map((s) => (
                    <option key={s.name} value={s.name}>{s.name}({ch?.skills[s.name] ?? 0})</option>
                  ))}
                </optgroup>
              ))}
              {ch && Object.keys(ch.skills).filter((n) => subSkillBaseOf(n)).length > 0 && (
                <optgroup label="子技能(手艺/表达)">
                  {Object.keys(ch.skills).filter((n) => subSkillBaseOf(n)).map((n) => (
                    <option key={n} value={n}>{skillDisplayName(n)}({ch.skills[n]})</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={useSpecialty} onChange={(e) => setUseSpecialty(e.target.checked)} />
            使用专业(+1DP)
          </label>
          <label className="flex items-center gap-1.5">
            加骰
            <select value={again} onChange={(e) => setAgain(Number(e.target.value))} className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1">
              {[10, 9, 8].map((n) => <option key={n} value={n}>{n}加骰</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            附加成功
            <input type="number" value={bonusSuccesses} min={0} onChange={(e) => setBonusSuccesses(Number(e.target.value))} className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1" />
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={useWillpower} onChange={(e) => setUseWillpower(e.target.checked)} />
            意志力(+3DP完美)
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
          <label className="flex items-center gap-1.5">
            手工调整
            <input type="number" value={manualBonus} onChange={(e) => setManualBonus(Number(e.target.value))} className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1" />
          </label>
          <select value={bonusType} onChange={(e) => setBonusType(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1">
            {["增强", "士气", "洞察", "表现", "环境", "器械", "招式", "能量", "无名", "内在", "修行", "专长"].map((t) => <option key={t}>{t}</option>)}
          </select>
          {manualBonus !== 0 && (
            <span className="text-zinc-500">同名加值只取最高,结算由引擎处理</span>
          )}
        </div>

        <div className="flex items-center gap-3 mb-4 text-xs">
          <label className="flex items-center gap-1.5">
            DC模式
            <select value={dcMode} onChange={(e) => setDcMode(e.target.value as "none" | "fixed" | "opposed")} className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1">
              <option value="none">无(看成功数)</option>
              <option value="fixed">竞争(固定DC)</option>
              <option value="opposed">对抗(对方成功数)</option>
            </select>
          </label>
          {dcMode !== "none" && (
            <input type="number" value={dcValue} onChange={(e) => setDcValue(Number(e.target.value))} className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1" />
          )}
        </div>

        <div className="text-xs text-zinc-500 mb-3">
          DP = {dpBreakdown.join(" + ")}
          {untrained?.autoFail && <span className="text-red-400"> · 心智系0级:自动失败</span>}
        </div>

        <button onClick={doRoll} className="w-full py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-500 font-bold">
          🎲 掷骰
        </button>
      </div>

      {/* 右:结果与历史 */}
      <div className="space-y-4">
        {last && <ResultCard item={last} />}
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
          <h3 className="font-bold text-sm mb-2">历史(最近 30 次)</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs bg-zinc-900/70 rounded px-2.5 py-1.5">
                <span className="text-zinc-400 truncate">{h.desc}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <b className={h.result.total > 0 ? "text-emerald-400" : "text-zinc-500"}>{h.result.total}成功</b>
                  {h.success !== undefined && h.success !== null && (
                    <span className={h.success ? "text-emerald-400" : "text-red-400"}>{h.success ? "成功" : "失败"}</span>
                  )}
                </span>
              </div>
            ))}
            {history.length === 0 && <div className="text-zinc-600 text-xs">暂无记录</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ item }: { item: RollLogItem & { note?: string } }) {
  const { result } = item;
  const allDice = result.rounds.flat();
  const againFaces = result.rounds.slice(0, -1).flat();
  return (
    <div className={`border rounded-lg p-5 ${result.botch ? "border-red-700 bg-red-950/30" : "border-zinc-800 bg-zinc-900/40"}`}>
      <div className="flex justify-between items-baseline mb-3">
        <div className="font-bold">{item.desc}</div>
        {item.dc !== null && item.dc !== undefined && (
          <span className={`text-sm font-bold ${item.success ? "text-emerald-400" : "text-red-400"}`}>
            {item.success ? "✓ 成功" : "✗ 失败"}({item.dcLabel} DC {item.dc})
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {result.rounds.map((round, ri) => (
          <div key={ri} className="flex gap-1">
            {round.map((d, di) => {
              const isAgain = ri < result.rounds.length - 1;
              const cls = d >= 8 ? (isAgain ? "die die-again" : "die die-success") : "die die-fail";
              return (
                <span key={di} className={cls}>{d}</span>
              );
            })}
          </div>
        ))}
        {allDice.length === 0 && <span className="text-zinc-600 text-xs">无骰</span>}
      </div>
      <div className="flex gap-4 text-sm">
        <span>自然成功 <b className="text-emerald-400">{result.natural}</b></span>
        {result.bonus > 0 && <span>附加 <b className="text-amber-400">+{result.bonus}</b></span>}
        <span>总计 <b className="text-lg">{result.total}</b></span>
        {result.chanceDie && <span className="text-zinc-500 text-xs">机运骰</span>}
        {result.botch && <span className="text-red-400 font-bold">大失败!</span>}
      </div>
      {item.note && <div className="text-xs text-amber-500 mt-2">{item.note}</div>}
    </div>
  );
}

