import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCharacters } from "../store/characters";
import { useFeats, useFlaws, useQuirks, useTalents, FeatEntry } from "../lib/data";
import {
  ATTRIBUTES,
  ATTRIBUTE_KEYS,
  ATTR_CATEGORIES,
  AttrCategory,
  AttributeKey,
  SIZES,
  SizeKey,
  deriveStats,
  skillBonusSuccesses,
  flawPointsToTalentPoints,
  QUIRK_MAX,
  QUIRK_XP_EACH,
  CharacterData,
  skillCategoryOf,
  subSkillBaseOf,
  skillDisplayName,
} from "../engine/character";
import {
  rulesOf,
  attrTotalCost,
  skillTotalCost,
  langFeatPoints,
  RulesConfig,
} from "../engine/rules";

const STEPS = ["概念", "属性", "技能", "专长", "缺陷与天赋", "怪癖与XP", "完成"];


/** 持有某等级的总花费(按规则书版本):
 *  perLevel(RM):每级 1 点,累计 = Σ已购等级;
 *  cumulative(3.25):常规专长 1+2+…+n,起始等级>1 的按实际等级;
 *  特殊身份(仅 3.25 需特殊处理,RM 天然逐级)。 */
function featTotalCost(cfg: RulesConfig, level: number, entry?: { name?: string; startLevel?: number; exotic?: boolean }): number {
  if (cfg.featCostModel === "perLevel") return Math.max(0, level);
  if (!entry) return (level * (level + 1)) / 2;
  let total: number;
  if (entry.name === "特殊身份") total = (level * (level + 1)) / 2;
  else if ((entry.startLevel ?? 1) > 1) total = level;
  else total = (level * (level + 1)) / 2;
  if (level === 0) total = 0;
  return entry.exotic ? total * 2 : total;
}

/** RM 特殊身份不存在 4 级。 */
function specialIdentityLevelsOf(cfg: RulesConfig, maxLevel: number): number[] {
  if (cfg.id === "rm") return [1, 2, 3, 5].filter((lv) => lv <= maxLevel);
  return Array.from({ length: maxLevel }, (_, k) => k + 1);
}

export default function Builder() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { characters, update, activeId } = useCharacters();
  const id = params.get("id") ?? activeId ?? "";
  const ch = characters.find((c) => c.id === id);
  const [step, setStep] = useState(0);

  if (!ch) {
    return (
      <div className="p-8 text-zinc-500">
        未找到角色。请先从
        <button className="text-indigo-400 mx-1" onClick={() => nav("/")}>
          首页
        </button>
        创建或选择角色。
      </div>
    );
  }

  const patch = (fn: (c: CharacterData) => void) => update(ch.id, fn);

  const cfg = rulesOf(ch.rules);
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-2 text-xs text-zinc-500">
        建卡流程跟随角色所属规则书:
        <span className={`ml-1 px-1.5 py-0.5 rounded ${ch.rules === "rm" ? "bg-fuchsia-900/60 text-fuchsia-200" : "bg-zinc-800 text-zinc-300"}`}>
          {cfg.label}
        </span>
        {ch.rules !== "rm" && <span className="ml-2 text-zinc-600">在首页切换规则书后新建的角色将使用对应版本</span>}
      </div>
      {/* 步骤条 */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
              i === step
                ? "bg-indigo-600 text-white"
                : i < step
                  ? "bg-indigo-900/60 text-indigo-300"
                  : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {step === 0 && <StepConcept ch={ch} patch={patch} next={() => setStep(1)} />}
      {step === 1 && <StepAttributes ch={ch} patch={patch} next={() => setStep(2)} prev={() => setStep(0)} />}
      {step === 2 && <StepSkills ch={ch} patch={patch} next={() => setStep(3)} prev={() => setStep(1)} />}
      {step === 3 && <StepFeats ch={ch} patch={patch} next={() => setStep(4)} prev={() => setStep(2)} />}
      {step === 4 && <StepFlaws ch={ch} patch={patch} next={() => setStep(5)} prev={() => setStep(3)} />}
      {step === 5 && <StepXp ch={ch} patch={patch} next={() => setStep(6)} prev={() => setStep(4)} />}
      {step === 6 && <StepDone ch={ch} done={() => nav(`/character/${ch.id}`)} prev={() => setStep(5)} />}
    </div>
  );
}

// ---------------- 通用小组件 ----------------

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-16 text-sm text-zinc-300 shrink-0">{label}</div>
      {children}
      {hint && <div className="text-xs text-zinc-600">{hint}</div>}
    </div>
  );
}

function Stepper({ value, min, max, onChange, name }: { value: number; min: number; max: number; onChange: (v: number) => void; name?: string }) {
  return (
    <div className="flex items-center gap-1">
      <button
        className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label={name ? `${name} 减一` : undefined}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="w-8 text-center font-bold">{value}</span>
      <button
        className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label={name ? `${name} 加一` : undefined}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

function NavBtns({ prev, next, nextDisabled, nextLabel }: { prev?: () => void; next?: () => void; nextDisabled?: boolean; nextLabel?: string }) {
  return (
    <div className="flex justify-between mt-6">
      <button
        onClick={prev}
        className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-sm disabled:opacity-30"
        disabled={!prev}
      >
        上一步
      </button>
      <button
        onClick={next}
        className="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-medium disabled:opacity-30"
        disabled={nextDisabled}
      >
        {nextLabel ?? "下一步"}
      </button>
    </div>
  );
}

// ---------------- 步骤1:概念 ----------------

function StepConcept({ ch, patch, next }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void; next: () => void }) {
  const cfg = rulesOf(ch.rules);
  const isRM = cfg.id === "rm";
  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40 max-w-2xl">
      <h2 className="font-bold mb-4">概念段:你是谁?</h2>
      <p className="text-xs text-zinc-500 mb-4">
        {isRM
          ? "正常人类出身。想好你的概念——它决定了你在特殊身份与背景中的描述。RM 版还需选择美德/恶德(或角色特性):美德每部影片一次回复全部意志力,恶德每场景一次回复 1 点。"
          : "正常人类出身。想好你的概念——它决定了你在特殊身份与背景中的描述。"}
      </p>
      <Row label="姓名">
        <input
          value={ch.name}
          onChange={(e) => patch((c) => { c.name = e.target.value; })}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
        />
      </Row>
      <Row label="概念">
        <input
          value={ch.concept}
          onChange={(e) => patch((c) => { c.concept = e.target.value; })}
          placeholder="如:前特种兵 / 大学天文社社员 / 退休刑警…"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
        />
      </Row>
      {isRM && (
        <Row label="美德/恶德" hint="或 2~4 个角色特性(表现分由 ST 定)">
          <input
            value={ch.virtueVice ?? ""}
            onChange={(e) => patch((c) => { c.virtueVice = e.target.value; })}
            placeholder="如:正义/暴怒"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
          />
        </Row>
      )}
      <Row label="体型" hint="影响生命值与速度,一般为中型">
        <select
          value={ch.size}
          onChange={(e) => patch((c) => { c.size = e.target.value as SizeKey; })}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
        >
          {Object.keys(SIZES).map((s) => (
            <option key={s} value={s}>{s}(HP+{SIZES[s as SizeKey].hp})</option>
          ))}
        </select>
      </Row>
      <NavBtns next={next} />
    </div>
  );
}

// ---------------- 步骤2:属性 ----------------

function StepAttributes({ ch, patch, next, prev }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void; next: () => void; prev: () => void }) {
  const cfg = rulesOf(ch.rules);
  // 各系池分配:默认 生理3 心智2 互动1
  const [pools, setPools] = useState<Record<AttrCategory, number>>({
    生理: 3, 心智: 2, 互动: 1,
  });

  const spend = useMemo(() => {
    const byCat: Record<string, number> = { 生理: 0, 心智: 0, 互动: 0 };
    for (const k of ATTRIBUTE_KEYS) {
      byCat[catOf(k)] += attrTotalCost(cfg, ch.attributes[k]);
    }
    return byCat;
  }, [ch.attributes, cfg]);

  let freeUsed = 0;
  for (const cat of ATTR_CATEGORIES) {
    freeUsed += Math.max(0, spend[cat] - pools[cat]);
  }
  const freeLeft = cfg.attrFreePoints - freeUsed;
  const ok = freeLeft >= 0;

  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <h2 className="font-bold mb-1">属性段</h2>
      <p className="text-xs text-zinc-500 mb-4">
        全属性基础值 {cfg.attrBase}。给三个系分配 3/2/1 点,再从 {cfg.attrFreePoints} 点自由点中补充。4→5 每级耗 2 点,建卡上限 5。
        {cfg.id === "rm" && " 普通人平均属性为 2。"}
      </p>

      <div className="flex gap-3 mb-4 flex-wrap">
        {ATTR_CATEGORIES.map((cat) => (
          <label key={cat} className="text-xs text-zinc-400 flex items-center gap-1">
            {cat}系池
            <select
              value={pools[cat]}
              onChange={(e) => setPools({ ...pools, [cat]: Number(e.target.value) })}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className={spend[cat] > pools[cat] ? "text-amber-400" : "text-zinc-500"}>
              (用{spend[cat]})
            </span>
          </label>
        ))}
        <span className={`text-xs font-bold ${freeLeft < 0 ? "text-red-400" : "text-emerald-400"}`}>
          自由点剩余 {freeLeft}/{cfg.attrFreePoints}
        </span>
      </div>

      {ATTR_CATEGORIES.map((cat) => (
        <div key={cat} className="mb-3">
          <div className="text-xs font-bold text-indigo-400 mb-1">{cat}系</div>
          <div className="grid grid-cols-3 gap-2">
            {ATTRIBUTES[cat].map((k) => (
              <div key={k} className="flex items-center justify-between bg-zinc-900/70 border border-zinc-800 rounded px-3 py-2">
                <span className="text-sm">{k}</span>
                <Stepper
                  value={ch.attributes[k as AttributeKey]}
                  min={cfg.attrBase}
                  max={cfg.attrCreateCap}
                  name={k}
                  onChange={(v) => patch((c) => { c.attributes[k as AttributeKey] = v; })}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <DerivedPreview ch={ch} />
      <NavBtns prev={prev} next={next} nextDisabled={!ok} />
    </div>
  );
}

function catOf(k: string): AttrCategory {
  for (const cat of ATTR_CATEGORIES) {
    if ((ATTRIBUTES[cat] as readonly string[]).includes(k)) return cat;
  }
  return "生理";
}

function DerivedPreview({ ch }: { ch: CharacterData }) {
  const d = deriveStats(ch);
  return (
    <div className="mt-4 text-xs text-zinc-400 flex gap-4 flex-wrap border-t border-zinc-800 pt-3">
      <span>生命 <b className="text-zinc-100">{d.hp}</b></span>
      <span>意志 <b className="text-zinc-100">{d.willpowerMax}</b></span>
      <span>先攻 <b className="text-zinc-100">{d.initiative}</b></span>
      <span>基础防御 <b className="text-zinc-100">{d.baseDefense}</b></span>
      <span>速度 <b className="text-zinc-100">{d.speed}米</b></span>
      <span>敏感范围 <b className="text-zinc-100">{d.sensitiveRange}米</b></span>
    </div>
  );
}

// ---------------- 步骤3:技能 ----------------

function StepSkills({ ch, patch, next, prev }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void; next: () => void; prev: () => void }) {
  const cfg = rulesOf(ch.rules);
  const isRM = cfg.id === "rm";
  const [pools, setPools] = useState<Record<AttrCategory, number>>({ 生理: 6, 心智: 5, 互动: 4 });
  const specialLv = (ch.feats.find((f) => f.name === "特殊身份")?.levels ?? []) as number[];
  const has1 = specialLv.includes(1);
  const has2 = specialLv.includes(2);
  const has3 = specialLv.includes(3);
  const bonusFree = cfg.identityFreePointsByLevel(specialLv);
  const freeTotal = cfg.skillFreePoints + bonusFree;
  const designated = ch.specialIdentitySkill ?? "";
  const capOf = (skillName: string) => (has1 && skillName === designated ? cfg.specialIdentitySkillCap : cfg.skillCreateCap);

  const spendByCat = useMemo(() => {
    const byCat: Record<string, number> = { 生理: 0, 心智: 0, 互动: 0 };
    for (const key of Object.keys(ch.skills)) {
      byCat[skillCategoryOf(key)] += skillTotalCost(cfg, ch.skills[key]);
    }
    return byCat;
  }, [ch.skills, cfg]);

  let freeUsed = 0;
  for (const cat of ATTR_CATEGORIES) {
    freeUsed += Math.max(0, spendByCat[cat] - pools[cat]);
  }
  const freeLeft = freeTotal - freeUsed;

  // 免费专业:达到阈值的技能各 1 个(RM:3 级;3.25:3/4 级)
  const earnedFree = Object.keys(ch.skills).filter((n) => (ch.skills[n] ?? 0) >= (isRM ? 3 : 3)).length;

  const addSubSkill = (base: string) => {
    if (freeLeft < 1) {
      alert("技能点不足(新增子技能需 1 点)");
      return;
    }
    const sub = prompt(`新增${base}子技能名称(如 爆炸物):`)?.trim();
    if (!sub) return;
    const key = `${base}-${sub}`;
    if (ch.skills[key] !== undefined) {
      alert("该子技能已存在");
      return;
    }
    patch((c) => { c.skills[key] = 1; });
  };

  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <h2 className="font-bold mb-1">技能段</h2>
      <p className="text-xs text-zinc-500 mb-4">
        {isRM
          ? `按系分配 6/5/4 点 + 5 自由点,建卡上限 ${cfg.skillCreateCap} 级,每级耗 1 点。免费获得 3 个专业(需技能 ≥1);技能升到 3 级时再免费获得 1 个专业。专业在各自技能行下添加。`
          : "按系分配 6/5/4 点 + 5 自由点。3→4 每级耗 2。3 级、4 级技能各免费获得 1 个专业,另有 3 个自由专业(需技能 ≥1)。专业在各自技能行下添加。"}
      </p>

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        {ATTR_CATEGORIES.map((cat) => (
          <label key={cat} className="text-xs text-zinc-400 flex items-center gap-1">
            {cat}系池
            <select
              value={pools[cat]}
              onChange={(e) => setPools({ ...pools, [cat]: Number(e.target.value) })}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
            >
              {[4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className={spendByCat[cat] > pools[cat] ? "text-amber-400" : "text-zinc-500"}>
              (用{spendByCat[cat]})
            </span>
          </label>
        ))}
        <span className={`text-xs font-bold ${freeLeft < 0 ? "text-red-400" : "text-emerald-400"}`}>
          自由点剩余 {freeLeft}/{freeTotal}
        </span>
        {has1 && (
          <label className="text-xs text-amber-400 flex items-center gap-1">
            特殊身份1级·指定技能(上限{cfg.specialIdentitySkillCap}):
            <select
              value={designated}
              onChange={(e) => patch((c) => { c.specialIdentitySkill = e.target.value; })}
              className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5"
            >
              <option value="">(选择技能)</option>
              {cfg.skills.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </label>
        )}
        {has2 && !isRM && <span className="text-xs text-amber-400">特殊身份2级:+2自由技能点</span>}
        {has2 && isRM && <span className="text-xs text-amber-400">特殊身份2级:+2自由技能点(或4个额外专业)</span>}
        {has3 && !isRM && <span className="text-xs text-amber-400">特殊身份3级:+2自由技能点(两项技能各+1,上限4)</span>}
        {has3 && isRM && <span className="text-xs text-amber-400">特殊身份3级:最多三项3级技能立即提升到4级(与ST核对)</span>}
        {specialLv.includes(5) && isRM && <span className="text-xs text-amber-400">特殊身份5级:获得一项D级兑换(与ST核对,记录到能力段)</span>}
      </div>

      {ATTR_CATEGORIES.map((cat) => {
        const groupSkill = cfg.skills.find((s) => s.category === cat && s.sub);
        const subs = Object.keys(ch.skills).filter((n) => subSkillBaseOf(n) === groupSkill?.name);
        return (
          <div key={cat} className="mb-3">
            <div className="text-xs font-bold text-indigo-400 mb-1">{cat}系</div>
            <div className="space-y-1">
              {cfg.skills.filter((s) => s.category === cat && !s.sub).map((s) => (
                <SkillRow key={s.name} name={s.name} ch={ch} cap={capOf(s.name)} patch={patch} />
              ))}
              {groupSkill && (
                <div className="border border-dashed border-zinc-700 rounded px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-400">{groupSkill.name}*(按子技能分别学习)</span>
                    <button
                      className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-indigo-600 disabled:opacity-30 shrink-0"
                      disabled={freeLeft < 1}
                      onClick={() => addSubSkill(groupSkill.name)}
                    >
                      + 新增子技能(费1)
                    </button>
                  </div>
                  {subs.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {subs.map((n) => (
                        <SkillRow key={n} name={n} ch={ch} cap={capOf(n)} patch={patch} sub />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="text-xs text-zinc-500 mt-1">
        免费专业提示:{isRM
          ? `3 级技能各含 1 个免费专业(当前 ${earnedFree} 个),建卡另有 3 个自由专业(计入各技能行的专业中,由 ST 校对)。`
          : `3/4 级技能各含 1 个免费专业(当前 ${earnedFree} 个),自由专业 3 个(计入各技能行的专业中,由 ST 校对)。`}
      </div>

      <DerivedPreview ch={ch} />
      <NavBtns prev={prev} next={next} nextDisabled={freeLeft < 0} />
    </div>
  );
}

function SkillRow({ name, ch, cap, patch, sub }: { name: string; ch: CharacterData; cap: number; patch: (fn: (c: CharacterData) => void) => void; sub?: boolean }) {
  const lv = ch.skills[name] ?? 0;
  const specs = ch.specialties[name] ?? [];
  const bs = skillBonusSuccesses(lv, ch.rules);
  const displayName = sub ? skillDisplayName(name) : name;
  const addSpec = () => {
    const spec = prompt(`为【${displayName}】添加专业:`)?.trim();
    if (!spec) return;
    patch((c) => {
      if (!c.specialties[name]) c.specialties[name] = [];
      if (!c.specialties[name].includes(spec)) c.specialties[name].push(spec);
    });
  };
  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded px-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm ${lv === 0 ? "text-zinc-500" : ""}`}>{displayName}</span>
        <span className="flex items-center gap-2">
          {bs > 0 && <span className="text-amber-400 text-[10px]">+{bs}附</span>}
          <Stepper
            value={lv}
            min={0}
            max={cap}
            name={name}
            onChange={(v) => patch((c) => {
              if (v === 0) delete c.skills[name];
              else c.skills[name] = v;
            })}
          />
        </span>
      </div>
      <div className="flex flex-wrap gap-1 pl-0.5">
        {specs.map((spec) => (
          <span key={spec} className="inline-flex items-center gap-1 bg-zinc-800 rounded-full pl-2 pr-1 text-[10px] text-zinc-300">
            专业:{spec}
            <button
              className="text-zinc-500 hover:text-red-400"
              onClick={() => patch((c) => {
                c.specialties[name] = c.specialties[name].filter((x) => x !== spec);
                if (c.specialties[name].length === 0) delete c.specialties[name];
              })}
            >
              ×
            </button>
          </span>
        ))}
        <button className="text-[10px] text-zinc-500 hover:text-indigo-400" onClick={addSpec}>
          +专业
        </button>
      </div>
    </div>
  );
}


// ---------------- 步骤4:专长 ----------------

function StepFeats({ ch, patch, next, prev }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void; next: () => void; prev: () => void }) {
  const cfg = rulesOf(ch.rules);
  const isRM = cfg.id === "rm";
  const featsData = useFeats(ch.rules);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("全部");

  const identityLevels = ch.feats.filter((f) => f.name === "特殊身份").flatMap((f) => f.levels ?? [f.level]);
  const identityMax = identityLevels.length > 0 ? Math.max(...identityLevels) : 0;
  const hasSpecialIdentity = identityLevels.length > 0;
  const spent = ch.feats.reduce((sum, f) => {
    if (isRM && f.name === "语言") return sum; // 语言专长走独立语言点池
    const def = featsData?.entries.find((e) => e.name === f.name);
    return sum + featTotalCost(cfg, f.level, def);
  }, 0);
  const left = cfg.featCreatePoints - spent;
  // 语言专长点:每点智力 2 点,只能加在语言专长上(RM)
  const langTotal = cfg.hasLangFeatPoints ? langFeatPoints(ch.attributes["智力"]) : 0;
  const langSpent = ch.feats.find((f) => f.name === "语言")?.level ?? 0;
  const langLeft = langTotal - langSpent;

  const categories = useMemo(() => {
    const set = new Set<string>(["全部"]);
    for (const e of featsData?.entries ?? []) set.add(e.category);
    return Array.from(set);
  }, [featsData]);

  const filtered = useMemo(() => {
    if (!featsData) return [];
    return featsData.entries.filter((e) => {
      if (cat !== "全部" && e.category !== cat) return false;
      if (search && !e.name.includes(search) && !e.text.includes(search)) return false;
      return true;
    });
  }, [featsData, cat, search]);

  /** 战斗专长门槛:RM 战斗专长级数 ≤ 特殊身份级数+1;3.25 需先拥有特殊身份 */
  const battleBlockReason = (e: FeatEntry, targetLevel: number): string | null => {
    if (!e.battle) return null;
    if (cfg.battleGate === "identity") {
      return hasSpecialIdentity ? null : "需特殊身份";
    }
    return targetLevel <= identityMax + 1 ? null : `需特殊身份≥${targetLevel - 1}级`;
  };

  const addFeat = (e: FeatEntry, targetLevel?: number) => {
    patch((c) => {
      const cur = c.feats.find((f) => f.name === e.name);
      const isSpecial = e.name === "特殊身份";
      const isLang = e.name === "语言";
      const ownedLv = cur?.level ?? 0;
      const nextLv = targetLevel ?? (ownedLv >= e.startLevel ? ownedLv + 1 : e.startLevel);
      if (nextLv > e.maxLevel) return;
      if (isSpecial && cfg.id === "rm" && nextLv === 4) return; // RM 特殊身份无 4 级
      if (isSpecial && cur?.levels?.includes(nextLv)) return;
      if (!isSpecial && nextLv <= ownedLv) return;
      const cost = featTotalCost(cfg, nextLv, e) - featTotalCost(cfg, ownedLv, e);
      if (isLang) {
        if (cost > langTotal - (c.feats.find((f) => f.name === "语言")?.level ?? 0)) return;
      } else if (cost > cfg.featCreatePoints - c.feats.reduce((sum, f) => {
        if (cfg.id === "rm" && f.name === "语言") return sum;
        const def = featsData?.entries.find((x) => x.name === f.name);
        return sum + featTotalCost(cfg, f.level, def);
      }, 0)) {
        return;
      }
      if (cur) {
        cur.level = Math.max(cur.level, nextLv);
        if (isSpecial) cur.levels = [...(cur.levels ?? []), nextLv].sort((a, b) => a - b);
      } else {
        c.feats.push({
          name: e.name,
          category: e.category as CharacterData["feats"][0]["category"],
          level: nextLv,
          levels: isSpecial ? [nextLv] : undefined,
        });
      }
    });
  };

  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="font-bold">专长段</h2>
        <div className="text-sm">
          剩余 <b className={left < 0 ? "text-red-400" : "text-emerald-400"}>{left}</b> / {cfg.featCreatePoints} 专长点
          {cfg.hasLangFeatPoints && (
            <>
              ;语言点 <b className={langLeft < 0 ? "text-red-400" : "text-sky-300"}>{langLeft}</b> / {langTotal}
              <span className="text-xs text-zinc-600">(智力×2,仅语言专长)</span>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        {isRM
          ? "每 1 点专长点数换 1 个专长等级(2级专长花 2 点)。战斗系专长级数不得超过特殊身份级数+1,且需符合背景;语言专长由语言点支付。每 1 点智力提供 2 点语言专长点。"
          : "n 级专长累计花费 1+2+…+n 点;轮回之境/超魔专长花费×2(建卡不可购买)。战斗专长(白刃/枪械/肉搏/远程/技巧)需先拥有\"特殊身份\"。"}
      </p>

      <div className="flex gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索专长…"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm">
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* 已选专长 */}
      {ch.feats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ch.feats.map((f) => (
            <span key={f.name} className="inline-flex items-center gap-1 bg-indigo-900/50 border border-indigo-700/50 rounded-full pl-2.5 pr-1.5 py-0.5 text-xs">
              {f.name} {f.level}级
              <button
                className="text-zinc-400 hover:text-red-400"
                onClick={() => patch((c) => { c.feats = c.feats.filter((x) => x.name !== f.name); })}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-96 overflow-y-auto">
        {filtered.map((e) => {
          const owned = ch.feats.find((f) => f.name === e.name);
          const isSpecial = e.name === "特殊身份";
          const isLang = e.name === "语言";
          const nextCost = featTotalCost(cfg, (owned?.level ?? 0) + 1, e) - featTotalCost(cfg, owned?.level ?? 0, e);
          const poolLeft = isLang ? langLeft : left;
          // 特殊身份:所有等级都购入才算满(可分别购买,高级覆盖低级)
          const maxed = isSpecial
            ? specialIdentityLevelsOf(cfg, e.maxLevel).every((lv) => (owned?.levels ?? []).includes(lv))
            : (owned?.level ?? 0) >= e.maxLevel;
          const buyableLevels = isSpecial
            ? specialIdentityLevelsOf(cfg, e.maxLevel).filter((lv) => !(owned?.levels ?? []).includes(lv))
            : (e.startLevel ?? 1) > 1
              ? Array.from({ length: e.maxLevel - (owned?.level ?? 0) }, (_, k) => (owned?.level ?? 0) + 1 + k).filter((lv) => lv >= e.startLevel)
              : null;
          const gateNext = battleBlockReason(e, isSpecial ? Math.max(owned?.level ?? 0, 0) + 1 : (owned?.level ?? 0) + 1);
          const gateLabel = e.battle
            ? cfg.battleGate === "identity"
              ? "需特殊身份"
              : `战斗专长级数≤特殊身份+1`
            : null;
          return (
            <div key={e.name} className="flex items-center justify-between bg-zinc-900/70 border border-zinc-800 rounded px-3 py-2 gap-2">
              <div className="min-w-0">
                <div className={`text-sm truncate ${owned ? "text-indigo-300" : ""}`} title={e.text.slice(0, 150)}>
                  {e.name} <span className="text-zinc-600">{(e.startLevel ?? 1) > 1 ? `${e.startLevel}~${e.maxLevel}级` : `≤${e.maxLevel}级`}</span>
                  {e.exotic && <span className="text-amber-600 text-xs ml-1">建卡不可购</span>}
                  {isLang && <span className="text-sky-400 text-xs ml-1">语言点</span>}
                  {gateLabel && <span className={`text-xs ml-1 ${gateNext ? "text-red-500" : "text-emerald-500"}`}>{gateLabel}</span>}
                </div>
              </div>
              <div className="shrink-0 flex gap-1">
                {maxed ? (
                  <span className="text-xs text-zinc-500 px-2 py-1">已满</span>
                ) : isSpecial ? (
                  buyableLevels!.map((lv) => {
                    const prevMax = Math.max(owned?.level ?? 0, 0);
                    const cost = featTotalCost(cfg, Math.max(lv, prevMax), e) - featTotalCost(cfg, prevMax, e);
                    const gate = battleBlockReason(e, lv);
                    return (
                      <button
                        key={lv}
                        disabled={!!gate || e.exotic || cost > left}
                        onClick={() => addFeat(e, lv)}
                        className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-indigo-600 disabled:opacity-30"
                        title={gate ?? (lv > prevMax + 1 ? "跳级购买:需支付低级价格(高级覆盖低级效果)" : undefined)}
                      >
                        {lv}级(费{cost})
                      </button>
                    );
                  })
                ) : buyableLevels ? (
                  buyableLevels.map((lv) => {
                    const cost = featTotalCost(cfg, lv, e) - featTotalCost(cfg, owned?.level ?? 0, e);
                    const gate = battleBlockReason(e, lv);
                    return (
                      <button
                        key={lv}
                        disabled={!!gate || e.exotic || cost > poolLeft}
                        onClick={() => addFeat(e, lv)}
                        className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-indigo-600 disabled:opacity-30"
                      >
                        {lv}级(费{cost})
                      </button>
                    );
                  })
                ) : (
                  <button
                    disabled={!!gateNext || e.exotic || nextCost > poolLeft}
                    onClick={() => addFeat(e)}
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-indigo-600 disabled:opacity-30"
                  >
                    {owned ? `升${owned.level + 1}(费${nextCost})` : `买1级(费${featTotalCost(cfg, 1, e)})`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <NavBtns prev={prev} next={next} />
    </div>
  );
}

// ---------------- 步骤5:缺陷与天赋 ----------------

function StepFlaws({ ch, patch, next, prev }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void; next: () => void; prev: () => void }) {
  const flawsData = useFlaws(ch.rules);
  const talentsData = useTalents(ch.rules);
  const [search, setSearch] = useState("");

  const flawPoints = ch.flaws.reduce((s, f) => s + f.points, 0);
  const talentPoints = flawPointsToTalentPoints(flawPoints);
  const talentSpent = ch.talents.reduce((s, t) => s + t.level, 0);
  const talentLeft = talentPoints - talentSpent;

  const filteredFlaws = (flawsData?.entries ?? []).filter((e) => !search || e.name.includes(search) || e.text.includes(search));
  const filteredTalents = (talentsData?.entries ?? []).filter((e) => !search || e.name.includes(search) || e.text.includes(search));

  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="font-bold">缺陷与天赋</h2>
        <div className="text-sm">
          缺陷点 <b className="text-amber-400">{flawPoints}</b> →
          天赋点 <b className="text-emerald-400">{talentPoints}</b>
          (已用 {talentSpent},剩 <b className={talentLeft < 0 ? "text-red-400" : ""}>{talentLeft}</b>)
        </div>
      </div>
      <p className="text-xs text-zinc-500 mb-3">每 2 个缺陷点兑换 1 个天赋点。缺陷也可以不选。</p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索缺陷/天赋…"
        className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm mb-3"
      />

      {(ch.flaws.length > 0 || ch.talents.length > 0) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ch.flaws.map((f) => (
            <span key={f.name} className="inline-flex items-center gap-1 bg-amber-900/30 border border-amber-800/50 rounded-full pl-2.5 pr-1.5 py-0.5 text-xs">
              {f.name} {f.points}点
              <button
                className="text-zinc-500 hover:text-red-400"
                onClick={() => patch((c) => { c.flaws = c.flaws.filter((x) => x.name !== f.name); })}
              >×</button>
            </span>
          ))}
          {ch.talents.map((t) => (
            <span key={t.name} className="inline-flex items-center gap-1 bg-emerald-900/30 border border-emerald-800/50 rounded-full pl-2.5 pr-1.5 py-0.5 text-xs">
              {t.name} {t.level}点
              <button
                className="text-zinc-500 hover:text-red-400"
                onClick={() => patch((c) => { c.talents = c.talents.filter((x) => x.name !== t.name); })}
              >×</button>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-bold text-zinc-400 mb-1.5">缺陷({flawsData?.count ?? 0})</div>
          <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
            {filteredFlaws.map((e) => {
              const owned = ch.flaws.find((f) => f.name === e.name);
              return (
                <div key={e.name} className={`flex items-center justify-between rounded px-2.5 py-1.5 border ${owned ? "border-amber-700/50 bg-amber-900/20" : "border-zinc-800 bg-zinc-900/70"}`}>
                  <div className="min-w-0" title={e.text.slice(0, 120)}>
                    <span className="text-sm">{e.name}</span>
                    <span className="text-xs text-zinc-500 ml-1.5">{e.category} {e.points}点</span>
                  </div>
                  <button
                    className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 shrink-0"
                    onClick={() => patch((c) => {
                      if (owned) c.flaws = c.flaws.filter((x) => x.name !== e.name);
                      else c.flaws.push({ name: e.name, points: e.points });
                    })}
                  >
                    {owned ? "移除" : "选取"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-zinc-400 mb-1.5">天赋({talentsData?.count ?? 0})</div>
          <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
            {filteredTalents.map((e) => {
              const owned = ch.talents.find((t) => t.name === e.name);
              return (
                <div key={e.name} className={`flex items-center justify-between rounded px-2.5 py-1.5 border ${owned ? "border-emerald-700/50 bg-emerald-900/20" : "border-zinc-800 bg-zinc-900/70"}`}>
                  <div className="min-w-0" title={e.text.slice(0, 120)}>
                    <span className="text-sm">{e.name}</span>
                    <span className="text-xs text-zinc-500 ml-1.5">{e.category} {e.cost}点</span>
                  </div>
                  <button
                    className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 shrink-0"
                    onClick={() => patch((c) => {
                      if (owned) c.talents = c.talents.filter((x) => x.name !== e.name);
                      else c.talents.push({ name: e.name, level: e.cost });
                    })}
                  >
                    {owned ? "移除" : "获取"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <NavBtns prev={prev} next={next} nextDisabled={talentLeft < 0} />
    </div>
  );
}

// ---------------- 步骤6:怪癖与XP ----------------

function StepXp({ ch, patch, next, prev }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void; next: () => void; prev: () => void }) {
  const cfg = rulesOf(ch.rules);
  const quirksData = useQuirks(ch.rules);
  const featsData = useFeats(ch.rules);
  const xpTotal = ch.quirks.length * QUIRK_XP_EACH;

  // XP 支出记录在 notes 前的专用字段:c._xpSpent
  const spent = (ch as CharacterData & { _xpSpent?: number })._xpSpent ?? 0;
  const xpLeft = xpTotal - spent;

  const spendSkill = () => {
    const skill = prompt("要提升的技能名:")?.trim();
    if (!skill) return;
    const cur = ch.skills[skill] ?? 0;
    const cost = cfg.skillUpXpCost(cur);
    if (cost > xpLeft) { alert(`需要 ${cost} XP,剩余 ${xpLeft}`); return; }
    patch((c) => {
      c.skills[skill] = cur + 1;
      const cc = c as CharacterData & { _xpSpent?: number };
      cc._xpSpent = (cc._xpSpent ?? 0) + cost;
    });
  };

  const spendFeat = () => {
    const name = prompt("要购买的专长名(须与列表一致):")?.trim();
    if (!name) return;
    const def = featsData?.entries.find((e) => e.name === name);
    if (!def) { alert("未找到该专长"); return; }
    const cur = ch.feats.find((f) => f.name === name)?.level ?? 0;
    if (cur >= def.maxLevel) { alert("已达上限"); return; }
    const cost = cfg.featUpXpCost(cur + 1, name);
    if (cost > xpLeft) { alert(`需要 ${cost} XP,剩余 ${xpLeft}`); return; }
    patch((c) => {
      const f = c.feats.find((x) => x.name === name);
      if (f) f.level += 1;
      else c.feats.push({ name, category: def.category as CharacterData["feats"][0]["category"], level: 1 });
      const cc = c as CharacterData & { _xpSpent?: number };
      cc._xpSpent = (cc._xpSpent ?? 0) + cost;
    });
  };

  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <h2 className="font-bold mb-1">怪癖与 XP 消费</h2>
      <p className="text-xs text-zinc-500 mb-4">
        {cfg.id === "rm"
          ? `怪癖最多 ${QUIRK_MAX} 个,每个 +${QUIRK_XP_EACH}XP。XP 提升技能:0→1 需 3XP,之后每级 max(1,(当前级-1)×2)XP;购买专长每级需 2×等级 XP(语言每级 2XP)。剩余 XP 计入角色账本。`
          : `怪癖最多 ${QUIRK_MAX} 个,每个 +${QUIRK_XP_EACH}XP。XP 可立即购买专长(3XP/级,轮回系6XP)或提升技能(当前级×2XP)。剩余 XP 计入角色账本。`}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-bold text-zinc-400 mb-1.5">怪癖({quirksData?.count ?? 0})</div>
          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {(quirksData?.entries ?? []).map((e) => {
              const owned = ch.quirks.includes(e.name);
              return (
                <div key={e.name} className={`flex items-center justify-between rounded px-2.5 py-1.5 border ${owned ? "border-indigo-700/50 bg-indigo-900/20" : "border-zinc-800 bg-zinc-900/70"}`}>
                  <span className="text-sm truncate" title={e.text.slice(0, 120)}>{e.name}<span className="text-xs text-zinc-500 ml-1.5">{e.category}</span></span>
                  <button
                    className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 shrink-0"
                    onClick={() => patch((c) => {
                      if (owned) c.quirks = c.quirks.filter((x) => x !== e.name);
                      else if (c.quirks.length < QUIRK_MAX) c.quirks.push(e.name);
                    })}
                  >
                    {owned ? "移除" : "选取"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-zinc-400 mb-1.5">XP 消费</div>
          <div className="bg-zinc-900/70 border border-zinc-800 rounded p-3 text-sm">
            <div className="mb-2">怪癖提供 <b className="text-indigo-300">{xpTotal}XP</b>,已消费 {spent},剩余 <b className={xpLeft < 0 ? "text-red-400" : "text-emerald-400"}>{xpLeft}</b></div>
            <div className="flex gap-2">
              <button onClick={spendSkill} className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">提升技能</button>
              <button onClick={spendFeat} className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">购买专长</button>
            </div>
          </div>
        </div>
      </div>

      <NavBtns prev={prev} next={next} />
    </div>
  );
}

// ---------------- 步骤7:完成 ----------------

function StepDone({ ch, done, prev }: { ch: CharacterData; done: () => void; prev: () => void }) {
  const cfg = rulesOf(ch.rules);
  const d = deriveStats(ch);
  const xpLeft = ch.quirks.length * QUIRK_XP_EACH - ((ch as CharacterData & { _xpSpent?: number })._xpSpent ?? 0);
  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40 max-w-2xl">
      <h2 className="font-bold mb-4">完成!</h2>
      <div className="grid grid-cols-3 gap-3 text-center mb-4">
        <div className="bg-zinc-900/70 border border-zinc-800 rounded p-3">
          <div className="text-xs text-zinc-500">生命值</div>
          <div className="text-2xl font-bold">{d.hp}</div>
        </div>
        <div className="bg-zinc-900/70 border border-zinc-800 rounded p-3">
          <div className="text-xs text-zinc-500">意志力</div>
          <div className="text-2xl font-bold">{d.willpowerMax}</div>
        </div>
        <div className="bg-zinc-900/70 border border-zinc-800 rounded p-3">
          <div className="text-xs text-zinc-500">基础防御</div>
          <div className="text-2xl font-bold">{d.baseDefense}</div>
        </div>
      </div>
      <div className="text-xs text-zinc-400 space-y-1 mb-4">
        <div>先攻 {d.initiative} · 速度 {d.speed}米 · 敏感范围 {d.sensitiveRange}米</div>
        <div>技能 {Object.keys(ch.skills).length} 项 · 专长 {ch.feats.length} 个 · 缺陷 {ch.flaws.length} 个 · 天赋 {ch.talents.length} 个 · 怪癖 {ch.quirks.length} 个</div>
        {xpLeft > 0 && <div className="text-indigo-300">未消费的 {xpLeft}XP 将计入{cfg.terms.realm}账本</div>}
      </div>
      <NavBtns prev={prev} next={done} nextLabel="进入角色卡" />
    </div>
  );
}
