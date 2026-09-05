import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCharacters } from "../store/characters";
import { useFeats, useFlaws, useQuirks, useTalents, FeatEntry } from "../lib/data";
import {
  ATTRIBUTES,
  ATTRIBUTE_KEYS,
  ATTR_CREATE_CAP,
  ATTR_BASE,
  ATTR_CATEGORIES,
  AttrCategory,
  AttributeKey,
  SKILLS,
  SKILL_CREATE_CAP,
  SkillDef,
  SIZES,
  SizeKey,
  attrRaiseCost,
  deriveStats,
  skillRaiseCost,
  flawPointsToTalentPoints,
  QUIRK_MAX,
  QUIRK_XP_EACH,
  CharacterData,
} from "../engine/character";
import { skillUpCostXp, FEAT_XP_PER_LEVEL, FEAT_XP_PER_LEVEL_EXOTIC } from "../engine/economy";

const STEPS = ["概念", "属性", "技能", "专长", "缺陷与天赋", "怪癖与XP", "完成"];

/** 属性从2升到v的总花费 */
function attrTotalCost(v: number): number {
  let c = 0;
  for (let x = 2; x < v; x++) c += attrRaiseCost(x);
  return c;
}
/** 技能从0升到v的总花费 */
function skillTotalCost(v: number): number {
  let c = 0;
  for (let x = 0; x < v; x++) c += skillRaiseCost(x);
  return c;
}


/** 持有某等级的总花费(建卡规则):
 *  特殊身份 → 1+2+…+level(可跳级,跳级补齐低级价格);
 *  起始等级>1 → 按实际等级花费;
 *  常规专长 → 1+2+…+level;起始0级 → 0。 */
function featTotalCost(level: number, entry?: { name?: string; startLevel?: number; exotic?: boolean }): number {
  if (!entry) return level;
  let total: number;
  if (entry.name === "特殊身份") total = (level * (level + 1)) / 2;
  else if ((entry.startLevel ?? 1) > 1) total = level;
  else total = (level * (level + 1)) / 2;
  if (level === 0) total = 0;
  return entry.exotic ? total * 2 : total;
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

  return (
    <div className="max-w-5xl mx-auto p-6">
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
  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40 max-w-2xl">
      <h2 className="font-bold mb-4">概念段:你是谁?</h2>
      <p className="text-xs text-zinc-500 mb-4">
        正常人类出身。想好你的概念——它决定了你在特殊身份与背景中的描述。
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
  // 各系池分配:默认 生理3 心智2 互动1
  const [pools, setPools] = useState<Record<AttrCategory, number>>({
    生理: 3, 心智: 2, 互动: 1,
  });

  const spend = useMemo(() => {
    const byCat: Record<string, number> = { 生理: 0, 心智: 0, 互动: 0 };
    for (const k of ATTRIBUTE_KEYS) {
      byCat[catOf(k)] += attrTotalCost(ch.attributes[k]);
    }
    return byCat;
  }, [ch.attributes]);

  let freeUsed = 0;
  for (const cat of ATTR_CATEGORIES) {
    freeUsed += Math.max(0, spend[cat] - pools[cat]);
  }
  const freeLeft = 6 - freeUsed;
  const ok = freeLeft >= 0;

  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <h2 className="font-bold mb-1">属性段</h2>
      <p className="text-xs text-zinc-500 mb-4">
        全属性基础值 2。给三个系分配 3/2/1 点,再从 6 点自由点中补充。4→5 每级耗 2 点,建卡上限 5。
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
          自由点剩余 {freeLeft}/6
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
                  min={ATTR_BASE}
                  max={ATTR_CREATE_CAP}
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
  const [pools, setPools] = useState<Record<AttrCategory, number>>({ 生理: 6, 心智: 5, 互动: 4 });
  const hasSpecialIdentity = ch.feats.some((f) => f.name === "特殊身份");
  const cap = hasSpecialIdentity ? 5 : SKILL_CREATE_CAP;

  const spendByCat = useMemo(() => {
    const byCat: Record<string, number> = { 生理: 0, 心智: 0, 互动: 0 };
    for (const s of SKILLS) {
      const lv = ch.skills[s.name] ?? 0;
      byCat[s.category] += skillTotalCost(lv);
    }
    return byCat;
  }, [ch.skills]);

  let freeUsed = 0;
  for (const cat of ATTR_CATEGORIES) {
    freeUsed += Math.max(0, spendByCat[cat] - pools[cat]);
  }
  const freeLeft = 5 - freeUsed;

  // 免费专业:3/4级技能各1个 + 3个自由
  const earnedFree = SKILLS.filter((s) => (ch.skills[s.name] ?? 0) >= 3).length;
  const extraTotal = 3;
  const extraUsed = Object.entries(ch.specialties).filter(([skill]) => {
    const def = SKILLS.find((s) => s.name === skill.split("-")[0]);
    return def && (ch.skills[def.name] ?? 0) >= 1;
  }).length - Object.entries(ch.specialties).filter(([skill]) => {
    const def = SKILLS.find((s) => s.name === skill.split("-")[0]);
    return def && (ch.skills[def.name] ?? 0) >= 3 && (ch.skills[def.name] ?? 0) < 3;
  }).length;

  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <h2 className="font-bold mb-1">技能段</h2>
      <p className="text-xs text-zinc-500 mb-4">
        按系分配 6/5/4 点 + 5 自由点。3→4 每级耗 2。3 级、4 级技能各免费获得 1 个专业,另有 3 个自由专业(需技能 ≥1)。
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
          自由点剩余 {freeLeft}/5
        </span>
        {hasSpecialIdentity && <span className="text-xs text-amber-400">特殊身份:一项技能可到5级</span>}
      </div>

      {ATTR_CATEGORIES.map((cat) => (
        <div key={cat} className="mb-3">
          <div className="text-xs font-bold text-indigo-400 mb-1">{cat}系</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {SKILLS.filter((s) => s.category === cat).map((s) => (
              <SkillCell key={s.name} def={s} ch={ch} cap={cap} patch={patch} />
            ))}
          </div>
        </div>
      ))}

      {/* 专业编辑 */}
      <div className="border-t border-zinc-800 pt-3 mt-3">
        <div className="text-xs font-bold text-indigo-400 mb-2">
          专业(每个 +1DP,同类专业不叠加)。3/4 级技能各含 1 个免费专业;自由专业 3 个。
        </div>
        <SpecialtyEditor ch={ch} patch={patch} />
        <div className="text-xs text-zinc-500 mt-1">
          已免费获得 {earnedFree} 个(3级+技能),自由专业使用情况见上方编辑器(共 {extraTotal} 个)。
        </div>
      </div>

      <NavBtns prev={prev} next={next} nextDisabled={freeLeft < 0} />
    </div>
  );
}

function SkillCell({ def, ch, cap, patch }: { def: SkillDef; ch: CharacterData; cap: number; patch: (fn: (c: CharacterData) => void) => void }) {
  const lv = ch.skills[def.name] ?? 0;
  return (
    <div
      className="flex items-center justify-between bg-zinc-900/70 border border-zinc-800 rounded px-2 py-1.5"
      title={def.desc}
    >
      <span className={`text-xs ${def.sub ? "underline decoration-dotted" : ""}`}>{def.name}{def.sub ? "*" : ""}</span>
      <Stepper
        value={lv}
        min={0}
        max={cap}
        name={def.name}
        onChange={(v) => patch((c) => {
          if (v === 0) delete c.skills[def.name];
          else c.skills[def.name] = v;
        })}
      />
    </div>
  );
}

function SpecialtyEditor({ ch, patch }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void }) {
  const list = Object.entries(ch.specialties).flatMap(([skill, specs]) => specs.map((s) => ({ skill, spec: s })));
  const add = () => {
    patch((c) => {
      const skill = prompt("技能名(可带子分类,如 手艺-爆炸物):")?.trim();
      if (!skill) return;
      const spec = prompt("专业名:")?.trim();
      if (!spec) return;
      if (!c.specialties[skill]) c.specialties[skill] = [];
      if (!c.specialties[skill].includes(spec)) c.specialties[skill].push(spec);
    });
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map(({ skill, spec }) => (
        <span key={`${skill}-${spec}`} className="inline-flex items-center gap-1 bg-zinc-800 rounded-full pl-2.5 pr-1.5 py-0.5 text-xs">
          {skill}·{spec}
          <button
            className="text-zinc-500 hover:text-red-400"
            onClick={() => patch((c) => {
              c.specialties[skill] = c.specialties[skill].filter((s) => s !== spec);
              if (c.specialties[skill].length === 0) delete c.specialties[skill];
            })}
          >
            ×
          </button>
        </span>
      ))}
      <button onClick={add} className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400">
        + 专业
      </button>
    </div>
  );
}

// ---------------- 步骤4:专长 ----------------

function StepFeats({ ch, patch, next, prev }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void; next: () => void; prev: () => void }) {
  const featsData = useFeats();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("全部");

  const hasSpecialIdentity = ch.feats.some((f) => f.name === "特殊身份");
  const spent = ch.feats.reduce((sum, f) => {
    const def = featsData?.entries.find((e) => e.name === f.name);
    return sum + featTotalCost(f.level, def);
  }, 0);
  const left = 15 - spent;

  const filtered = useMemo(() => {
    if (!featsData) return [];
    return featsData.entries.filter((e) => {
      if (cat !== "全部" && e.category !== cat) return false;
      if (search && !e.name.includes(search) && !e.text.includes(search)) return false;
      return true;
    });
  }, [featsData, cat, search]);

  const addFeat = (e: FeatEntry, targetLevel?: number) => {
    patch((c) => {
      const cur = c.feats.find((f) => f.name === e.name);
      const owned = cur?.level ?? 0;
      // 特殊身份:可购买任意未持有等级;起始>1:可从起始级直接买;常规:逐级
      const nextLv = targetLevel ?? (owned >= e.startLevel ? owned + 1 : e.startLevel);
      if (nextLv > e.maxLevel || nextLv <= owned) return;
      const cost = featTotalCost(nextLv, e) - featTotalCost(owned, e);
      if (cost > left) return;
      if (cur) cur.level = nextLv;
      else c.feats.push({ name: e.name, category: e.category as CharacterData["feats"][0]["category"], level: nextLv });
    });
  };

  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="font-bold">专长段</h2>
        <div className="text-sm">
          剩余 <b className={left < 0 ? "text-red-400" : "text-emerald-400"}>{left}</b> / 15 专长点
        </div>
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        n 级专长累计花费 1+2+…+n 点;轮回之境/超魔专长花费×2(建卡不可购买)。战斗专长(白刃/枪械/肉搏/远程/技巧)需先拥有"特殊身份"。
      </p>

      <div className="flex gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索专长…"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm">
          {["全部", "建卡", "心智", "生理", "互动"].map((c) => (
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
          const battleLocked = e.battle && !hasSpecialIdentity;
          const nextCost = featTotalCost((owned?.level ?? 0) + 1, e) - featTotalCost(owned?.level ?? 0, e);
          const maxed = (owned?.level ?? 0) >= e.maxLevel;
          const isSpecial = e.name === "特殊身份";
          const nextLv = isSpecial || (e.startLevel ?? 1) > 1
            ? Math.max(owned?.level ?? 0, 0) + 1 <= e.startLevel
              ? e.startLevel
              : (owned?.level ?? 0) + 1
            : (owned?.level ?? 0) + 1;
          void nextLv;
          return (
            <div key={e.name} className="flex items-center justify-between bg-zinc-900/70 border border-zinc-800 rounded px-3 py-2 gap-2">
              <div className="min-w-0">
                <div className={`text-sm truncate ${owned ? "text-indigo-300" : ""}`} title={e.text.slice(0, 150)}>
                  {e.name} <span className="text-zinc-600">{(e.startLevel ?? 1) > 1 ? `${e.startLevel}~${e.maxLevel}级` : `≤${e.maxLevel}级`}</span>
                  {e.exotic && <span className="text-amber-600 text-xs ml-1">建卡不可购</span>}
                  {battleLocked && <span className="text-red-500 text-xs ml-1">需特殊身份</span>}
                </div>
              </div>
              <div className="shrink-0 flex gap-1">
                {maxed ? (
                  <span className="text-xs text-zinc-500 px-2 py-1">已满</span>
                ) : isSpecial || (e.startLevel ?? 1) > 1 ? (
                  // 特殊身份/起始>1:列出可购等级(每级显示增量花费)
                  Array.from({ length: e.maxLevel - (owned?.level ?? 0) }, (_, k) => (owned?.level ?? 0) + 1 + k)
                    .filter((lv) => lv >= e.startLevel)
                    .map((lv) => {
                      const cost = featTotalCost(lv, e) - featTotalCost(owned?.level ?? 0, e);
                      return (
                        <button
                          key={lv}
                          disabled={battleLocked || e.exotic || cost > left}
                          onClick={() => addFeat(e, lv)}
                          className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-indigo-600 disabled:opacity-30"
                        >
                          {lv}级(费{cost})
                        </button>
                      );
                    })
                ) : (
                  <button
                    disabled={battleLocked || e.exotic || nextCost > left}
                    onClick={() => addFeat(e)}
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-indigo-600 disabled:opacity-30"
                  >
                    {owned ? `升${owned.level + 1}(费${nextCost})` : `买1级(费1)`}
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
  const flawsData = useFlaws();
  const talentsData = useTalents();
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
  const quirksData = useQuirks();
  const featsData = useFeats();
  const xpTotal = ch.quirks.length * QUIRK_XP_EACH;

  // XP 支出记录在 notes 前的专用字段:c._xpSpent
  const spent = (ch as CharacterData & { _xpSpent?: number })._xpSpent ?? 0;
  const xpLeft = xpTotal - spent;

  const spendSkill = () => {
    const skill = prompt("要提升的技能名:")?.trim();
    if (!skill) return;
    const cur = ch.skills[skill] ?? 0;
    const cost = skillUpCostXp(cur);
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
    const cost = (def.exotic ? FEAT_XP_PER_LEVEL_EXOTIC : FEAT_XP_PER_LEVEL);
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
        怪癖最多 {QUIRK_MAX} 个,每个 +{QUIRK_XP_EACH}XP。XP 可立即购买专长(3XP/级,轮回系6XP)或提升技能(当前级×2XP)。剩余 XP 计入角色账本。
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
        {xpLeft > 0 && <div className="text-indigo-300">未消费的 {xpLeft}XP 将计入轮回之境账本</div>}
      </div>
      <NavBtns prev={prev} next={done} nextLabel="进入角色卡" />
    </div>
  );
}
