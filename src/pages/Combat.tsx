import { useState } from "react";
import { useCombat, Combatant, AttackDef, makeNpc } from "../store/combat";
import { useCharacters } from "../store/characters";
import {
  applyDamage,
  applyReductionChain,
  emptyWounds,
  healWounds,
  intactCount,
  isDead,
  isUnconscious,
  resolveAttack,
  WoundType,
} from "../engine/combat";
import { CONDITION_DEFS, INNATE_CONDITIONS } from "../engine/conditions";
import { deriveStats } from "../engine/character";

export default function Combat() {
  const combat = useCombat();
  const { characters } = useCharacters();
  const [showNpc, setShowNpc] = useState(false);
  const [npcName, setNpcName] = useState("");
  const [npcHp, setNpcHp] = useState(7);
  const [npcDef, setNpcDef] = useState(2);

  const selected = combat.combatants.find((c) => c.id === combat.selectedId);

  const addPC = (characterId: string) => {
    const ch = characters.find((c) => c.id === characterId);
    if (!ch) return;
    const d = deriveStats(ch);
    const c: Combatant = {
      id: `pc_${ch.id}`,
      name: ch.name,
      isPC: true,
      characterId: ch.id,
      attrs: { ...ch.attributes },
      skills: { ...ch.skills },
      hpMax: d.hp,
      wounds: emptyWounds(),
      willpower: { cur: d.willpowerMax, max: d.willpowerMax },
      initiativeMod: d.initiative,
      initTotal: null,
      defenseSlots: {
        基础: d.baseDefense,
        闪避: ch.defensePreset?.dodge ?? 0,
        天生: ch.defensePreset?.natural ?? 0,
        盔甲: ch.defensePreset?.armorMelee ?? 0,
        盾牌: ch.defensePreset?.shieldMelee ?? 0,
        格挡: Math.max(ch.defensePreset?.bladeBlock ?? 0, ch.defensePreset?.brawlBlock ?? 0),
        掩蔽: 0,
        偏斜: 0,
      },
      defenseBonusSuccesses:
        d.legend["敏捷"] + d.legend["感知"] + (ch.defensePreset?.extraBonusSuccesses ?? 0),
      hardness: 0,
      dr: 0,
      energyResist: 0,
      absorb: 0,
      threshold: 0,
      immuneTypes: [],
      attacks:
        ch.attackPresets && ch.attackPresets.length > 0
          ? ch.attackPresets.map((a) => ({
              id: `a_${a.id}`,
              name: a.name,
              attr: a.attr,
              skill: a.skill,
              skillLevel: ch.skills[a.skill] ?? 0,
              weaponDamage: a.weaponDamage,
              extraDp: a.extraDp ?? 0,
              cap:
                a.cap === undefined
                  ? (ch.attributes[a.attr as keyof typeof ch.attributes] ?? 0) +
                    (ch.skills[a.skill] ?? 0) + a.weaponDamage + (a.extraDp ?? 0)
                  : a.cap,
              type: a.damageType,
              bonusSuccesses: a.bonusSuccesses ?? 0,
              highSpeed: a.highSpeed ?? 0,
              breakArmor: a.breakArmor ?? 0,
              breakMagic: a.breakMagic ?? 0,
              again: a.again ?? 10,
              reach: a.reach ?? 0,
              range: a.range ?? 0,
              note: a.note,
              area: a.area,
            }))
          : defaultAttacks(ch.name),
      conditions: {},
      energy: ch.energyPools.map((p) => ({ name: p.name, cur: p.current, max: p.max })),
      customBonuses: ch.customBonuses ?? [],
      priorAttacks: 0,
    };
    combat.addCombatant(c);
    combat.select(c.id);
  };

  const addNpc = () => {
    if (!npcName.trim()) return;
    const c = makeNpc(npcName.trim());
    c.hpMax = npcHp || 7;
    c.defenseSlots["基础"] = npcDef;
    combat.addCombatant(c);
    combat.select(c.id);
    setNpcName("");
    setShowNpc(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold">
          战斗追踪
          {combat.started && <span className="text-indigo-400 ml-3 text-sm">第 {combat.round} 轮</span>}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <select
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm"
            value=""
            onChange={(e) => e.target.value && addPC(e.target.value)}
          >
            <option value="">+ 从角色卡添加…</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={() => setShowNpc(!showNpc)} className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm">+ NPC</button>
          {!combat.started ? (
            <button
              onClick={combat.startCombat}
              disabled={combat.combatants.length === 0}
              className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-bold disabled:opacity-40"
            >
              ▶ 开始战斗(掷先攻)
            </button>
          ) : (
            <button onClick={combat.nextTurn} className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-bold">
              ⏭ 下一个回合
            </button>
          )}
          <button
            onClick={() => confirm("清空整场战斗?") && combat.reset()}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-400"
          >
            清空
          </button>
        </div>
      </div>

      {showNpc && (
        <div className="mb-4 border border-zinc-800 rounded-lg p-3 bg-zinc-900/40 flex gap-2 items-end flex-wrap">
          <label className="text-xs text-zinc-400">
            名称
            <input value={npcName} onChange={(e) => setNpcName(e.target.value)} className="block w-28 mt-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-zinc-400">
            生命上限
            <input type="number" value={npcHp} onChange={(e) => setNpcHp(Number(e.target.value))} className="block w-20 mt-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-zinc-400">
            基础防御
            <input type="number" value={npcDef} onChange={(e) => setNpcDef(Number(e.target.value))} className="block w-20 mt-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm" />
          </label>
          <button onClick={addNpc} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-bold">添加</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr_0.9fr] gap-4">
        {/* 先攻列表 */}
        <div className="space-y-1.5">
          {combat.combatants.map((c, i) => {
            const intact = intactCount(c.wounds, c.hpMax);
            const dead = isDead(c.wounds, c.hpMax);
            const un = isUnconscious(c.wounds, c.hpMax);
            const active = combat.started && i === combat.turnIdx;
            return (
              <button
                key={c.id}
                onClick={() => combat.select(c.id)}
                className={`w-full text-left border rounded-lg p-3 transition-colors ${
                  dead
                    ? "border-red-800 bg-red-950/40 opacity-70"
                    : active
                      ? "border-indigo-500 bg-indigo-950/40"
                      : c.id === combat.selectedId
                        ? "border-zinc-500 bg-zinc-900"
                        : "border-zinc-800 bg-zinc-900/50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">
                    {c.name}
                    {dead && <span className="text-red-400 ml-1.5 text-xs">死亡</span>}
                    {!dead && un && <span className="text-amber-400 ml-1.5 text-xs">昏迷</span>}
                  </span>
                  {c.initTotal !== null && <span className="text-xs text-zinc-400">先攻 {c.initTotal}</span>}
                </div>
                <div className="mt-2 h-2 rounded bg-zinc-800 overflow-hidden flex">
                  <div className="bg-emerald-600 h-full" style={{ width: `${(intact / c.hpMax) * 100}%` }} />
                  <div className="bg-sky-500 h-full" style={{ width: `${(c.wounds.b / c.hpMax) * 100}%` }} />
                  <div className="bg-orange-500 h-full" style={{ width: `${(c.wounds.l / c.hpMax) * 100}%` }} />
                  <div className="bg-red-600 h-full" style={{ width: `${(c.wounds.a / c.hpMax) * 100}%` }} />
                </div>
                <div className="text-[11px] text-zinc-500 mt-1 flex gap-2 flex-wrap">
                  <span>{intact}/{c.hpMax}</span>
                  {c.wounds.b > 0 && <span className="text-sky-400">B{c.wounds.b}</span>}
                  {c.wounds.l > 0 && <span className="text-orange-400">L{c.wounds.l}</span>}
                  {c.wounds.a > 0 && <span className="text-red-400">A{c.wounds.a}</span>}
                  {Object.entries(c.conditions).filter(([, v]) => v > 0).map(([k, v]) => (
                    <span key={k} className="text-purple-400">{k}{v}</span>
                  ))}
                </div>
              </button>
            );
          })}
          {combat.combatants.length === 0 && (
            <div className="border border-dashed border-zinc-700 rounded-lg p-6 text-center text-zinc-500 text-sm">
              添加 PC 或 NPC 开始
            </div>
          )}
        </div>

        {/* 选中单位面板 */}
        {selected && <UnitPanel c={selected} />}

        {/* 日志 */}
        <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/40 h-fit lg:sticky lg:top-4">
          <h3 className="font-bold text-sm mb-2">战斗日志</h3>
          <div className="space-y-1 max-h-[32rem] overflow-y-auto text-xs">
            {combat.log.map((l) => (
              <div key={l.id} className="text-zinc-400 border-b border-zinc-800/60 pb-1">{l.text}</div>
            ))}
            {combat.log.length === 0 && <div className="text-zinc-600">尚无日志</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function defaultAttacks(name: string): AttackDef[] {
  return [
    {
      id: "a_unarmed",
      name: "徒手攻击",
      attr: "力量",
      skill: "肉搏",
      skillLevel: 0,
      weaponDamage: 0,
      extraDp: 0,
      cap: 4,
      type: "B",
      bonusSuccesses: 0,
      highSpeed: 0,
      breakArmor: 0,
      breakMagic: 0,
      again: 10,
      reach: 1,
      range: 0,
    },
  ];
}

// ---------------- 单位面板 ----------------

function UnitPanel({ c }: { c: Combatant }) {
  const combat = useCombat();
  const [dmgAmount, setDmgAmount] = useState(1);
  const [dmgType, setDmgType] = useState<WoundType>("L");

  const applyDamageNow = () => {
    const red = applyReductionChain(
      { amount: dmgAmount, types: dmgType === "A" ? ["普通物理"] : ["普通物理"] },
      {
        hardness: c.hardness,
        dr: c.dr,
        energyResist: c.energyResist,
        absorb: c.absorb,
        threshold: c.threshold,
        immuneTypes: c.immuneTypes as never[],
      },
    );
    if (red.immune) {
      combat.addLog(`${c.name} 对该伤害免疫,伤害无效`);
      return;
    }
    const before = c.wounds;
    const after = applyDamage(before, c.hpMax, red.final, dmgType);
    combat.update(c.id, (x) => { x.wounds = after; });
    combat.addLog(
      `${c.name} 受到 ${dmgAmount}${dmgType} → 减伤链后 ${red.final}${dmgType} → 伤势 B${after.b}/L${after.l}/A${after.a}` +
      (isDead(after, c.hpMax) ? " → 死亡!" : isUnconscious(after, c.hpMax) ? " → 昏迷" : ""),
    );
  };

  return (
    <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-900/60 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">{c.name} <span className="text-xs text-zinc-500">{c.isPC ? "PC" : "NPC"}</span></h3>
        <button className="text-xs text-zinc-500 hover:text-red-400" onClick={() => combat.removeCombatant(c.id)}>移除</button>
      </div>

      {/* 伤害输入 */}
      <div>
        <div className="text-xs text-zinc-400 mb-1.5">造成伤害(自动走减伤链:硬度{c.hardness}/DR{c.dr}/能量抗力{c.energyResist}/吸收{c.absorb}/阈值{c.threshold})</div>
        <div className="flex gap-2 items-center">
          <input type="number" min={0} value={dmgAmount} onChange={(e) => setDmgAmount(Number(e.target.value))} className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm" />
          <select value={dmgType} onChange={(e) => setDmgType(e.target.value as WoundType)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm">
            <option value="B">B 冲击</option>
            <option value="L">L 严重</option>
            <option value="A">A 恶性</option>
          </select>
          <button onClick={applyDamageNow} className="px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-sm font-bold">应用伤害</button>
          <select
            value=""
            onChange={(e) => {
              const mode = e.target.value as "B" | "L" | "AtoL";
              if (!mode) return;
              combat.update(c.id, (x) => { x.wounds = healWounds(x.wounds, mode); });
              combat.addLog(`${c.name} 治疗(${mode === "AtoL" ? "A→L" : mode + "→完好"})`);
              e.target.value = "";
            }}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm"
          >
            <option value="">治疗…</option>
            <option value="B">短休:B→完好</option>
            <option value="L">长休:L→完好</option>
            <option value="AtoL">长休:A→L</option>
          </select>
        </div>
      </div>

      {/* 防御与减伤编辑 */}
      <DefenseEditor c={c} />
      <AttackHelper c={c} />
      <ConditionEditor c={c} />
      <ResourceEditor c={c} />
    </div>
  );
}

function DefenseEditor({ c }: { c: Combatant }) {
  const combat = useCombat();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="text-xs text-indigo-400" onClick={() => setOpen(!open)}>
        防御/减伤编辑 ▾(总防御 {c.defenseSlots["基础"] + Object.entries(c.defenseSlots).filter(([k]) => k !== "基础").reduce((a, b) => a + b[1], 0) || 0})
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {Object.entries(c.defenseSlots).map(([slot, v]) => (
            <label key={slot} className="flex items-center justify-between bg-zinc-900/70 border border-zinc-800 rounded px-2 py-1">
              {slot}
              <input
                type="number"
                value={v}
                onChange={(e) => combat.update(c.id, (x) => { x.defenseSlots[slot] = Number(e.target.value); })}
                className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5"
              />
            </label>
          ))}
          {([["defenseBonusSuccesses", "防御附加成功"], ["hardness", "硬度"], ["dr", "DR(物理)"], ["energyResist", "能量抗力"], ["absorb", "吸收"], ["threshold", "阈值"]] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between bg-zinc-900/70 border border-zinc-800 rounded px-2 py-1">
              {label}
              <input
                type="number"
                value={c[key] as number}
                onChange={(e) => combat.update(c.id, (x) => { (x[key] as number) = Number(e.target.value); })}
                className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function AttackHelper({ c }: { c: Combatant }) {
  const combat = useCombat();
  const [attackId, setAttackId] = useState(c.attacks[0]?.id ?? "");
  const [targetId, setTargetId] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [pending, setPending] = useState<{ damage: number; type: WoundType } | null>(null);

  const attack = c.attacks.find((a) => a.id === attackId);
  const target = combat.combatants.find((t) => t.id === targetId);

  const doAttack = () => {
    if (!attack || !target) return;
    const attrVal = c.attrs[attack.attr] ?? 0;
    const skillVal = attack.skillLevel || c.skills[attack.skill] || 0;
    const prior = target.priorAttacks ?? 0;
    const out = resolveAttack({
      dp: attrVal + skillVal + attack.weaponDamage + (attack.extraDp ?? 0),
      attackBonus: attack.bonusSuccesses,
      damageCap: attack.cap === -1 ? Infinity : attack.cap,
      targetDefense: { slots: target.defenseSlots, bonusSuccesses: target.defenseBonusSuccesses },
      damageType: attack.type,
      areaAttack: attack.area,
      priorAttacks: prior,
      highSpeed: attack.highSpeed,
      breakArmor: attack.breakArmor,
    });
    const lines = [
      `${c.name} 对 ${target.name} 使用【${attack.name}】`,
      `DP=${attrVal}+${skillVal}+${attack.weaponDamage}${attack.extraDp ? `+${attack.extraDp}` : ""}${attack.area ? "(范围,不扣防御)" : `−防御${out.defenseUsed}`}${prior > 0 ? `(多次攻击减值${prior})` : ""} = 掷${out.dpUsed}`,
      `命中:${out.hit ? "是" : "否"}(自然${out.roll.natural} vs 防御附加${target.defenseBonusSuccesses})`,
    ];
    if (attack.highSpeed || attack.breakArmor || attack.breakMagic || attack.again !== 10) {
      const feats = [
        attack.highSpeed ? `高速${attack.highSpeed}` : "",
        attack.breakArmor ? `破甲${attack.breakArmor}` : "",
        attack.breakMagic ? `破魔${attack.breakMagic}` : "",
        attack.again !== 10 ? `${attack.again}加骰` : "",
      ].filter(Boolean);
      lines.push(`武器特性:${feats.join("/")}`);
    }
    if (attack.reach) lines.push(`触及 ${attack.reach}米`);
    if (attack.range) lines.push(`射程 ${attack.range}米`);
    if (attack.note) lines.push(`特效:${attack.note}`);
    if (out.hit) {
      lines.push(`最终成功数 ${out.finalSuccesses} → 上限后伤害 ${out.rawDamage}${attack.type}`);
    }
    setOutcome(lines.join("\n"));
    combat.addLog(lines.join(" | "));
    if (out.hit) {
      setPending({ damage: out.rawDamage, type: attack.type });
      combat.update(target.id, (x) => { x.priorAttacks = (x.priorAttacks ?? 0) + 1; });
    } else {
      setPending(null);
    }
  };

  const applyPending = () => {
    if (!pending || !target) return;
    const red = applyReductionChain(
      { amount: pending.damage, types: ["普通物理"] },
      { hardness: target.hardness, dr: target.dr, energyResist: target.energyResist, absorb: target.absorb, threshold: target.threshold, immuneTypes: target.immuneTypes as never[] },
    );
    if (red.immune) {
      combat.addLog(`${target.name} 免疫该伤害`);
      setPending(null);
      return;
    }
    const after = applyDamage(target.wounds, target.hpMax, red.final, pending.type);
    combat.update(target.id, (x) => { x.wounds = after; });
    combat.addLog(
      `${target.name} 受 ${red.final}${pending.type}(减伤链:${red.absorbedBy.map((a) => a.step).join("→") || "无"}) → B${after.b}/L${after.l}/A${after.a}` +
      (isDead(after, target.hpMax) ? " → 死亡!" : isUnconscious(after, target.hpMax) ? " → 昏迷" : ""),
    );
    setPending(null);
  };

  return (
    <div className="border-t border-zinc-800 pt-3">
      <div className="text-xs font-bold text-indigo-400 mb-1.5">攻击结算</div>
      {c.attacks.length === 0 ? (
        <div className="text-xs text-zinc-600">无攻击。在下方"攻击列表"添加。</div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center text-xs mb-2">
          <select value={attackId} onChange={(e) => setAttackId(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5">
            {c.attacks.map((a) => (
              <option key={a.id} value={a.id}>{a.name}({a.attr}+{a.skill}{a.weaponDamage ? `+${a.weaponDamage}` : ""},{a.type})</option>
            ))}
          </select>
          <span className="text-zinc-600">→</span>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5">
            <option value="">选择目标…</option>
            {combat.combatants.filter((t) => t.id !== c.id).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button onClick={doAttack} disabled={!target} className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-600 font-bold disabled:opacity-40">掷骰攻击</button>
          {pending && (
            <button onClick={applyPending} className="px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-500 font-bold">
              应用 {pending.damage}{pending.type} 到目标
            </button>
          )}
        </div>
      )}
      {outcome && <pre className="text-[11px] bg-zinc-950/70 border border-zinc-800 rounded p-2 whitespace-pre-wrap text-zinc-300">{outcome}</pre>}
      <AttackListEditor c={c} />
    </div>
  );
}

function AttackListEditor({ c }: { c: Combatant }) {
  const combat = useCombat();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button className="text-xs text-zinc-500 hover:text-indigo-400" onClick={() => setOpen(!open)}>
        攻击列表({c.attacks.length}) ▾
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {c.attacks.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs bg-zinc-900/70 border border-zinc-800 rounded px-2 py-1">
              <span className="flex-1 truncate">
                {a.name}({a.attr}+{a.skill}{a.weaponDamage ? `+${a.weaponDamage}` : ""},上限{a.cap === -1 ? "∞" : a.cap},{a.type}
                {a.highSpeed ? `,高速${a.highSpeed}` : ""}{a.breakArmor ? `,破甲${a.breakArmor}` : ""}{a.breakMagic ? `,破魔${a.breakMagic}` : ""})
              </span>
              <button className="text-zinc-600 hover:text-red-400" onClick={() => combat.update(c.id, (x) => { x.attacks = x.attacks.filter((y) => y.id !== a.id); })}>×</button>
            </div>
          ))}
          <button
            className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
            onClick={() => {
              const name = prompt("攻击名称:")?.trim();
              if (!name) return;
              const attr = prompt("关键属性(力量/敏捷/智力…):", "敏捷")?.trim() || "敏捷";
              const skill = prompt("技能名:", "枪械")?.trim() || "枪械";
              const wd = Number(prompt("武器伤害加值:", "0") ?? "0") || 0;
              const cap = Number(prompt("伤害上限(属性+技能+武器伤害):", "6") ?? "6") || 6;
              const type = (prompt("伤害级别 B/L/A:", "L")?.toUpperCase() || "L") as WoundType;
              combat.update(c.id, (x) => {
                x.attacks.push({
                  id: `a_${Date.now().toString(36)}`, name, attr, skill,
                  skillLevel: x.skills[skill] ?? 0, weaponDamage: wd, extraDp: 0,
                  cap, type, bonusSuccesses: 0,
                  highSpeed: 0, breakArmor: 0, breakMagic: 0, again: 10, reach: 0, range: 0,
                });
              });
            }}
          >
            + 添加攻击
          </button>
        </div>
      )}
    </div>
  );
}

function ConditionEditor({ c }: { c: Combatant }) {
  const combat = useCombat();
  return (
    <div className="border-t border-zinc-800 pt-3">
      <div className="text-xs font-bold text-purple-400 mb-1.5">不良状态点数</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {Object.entries(c.conditions).filter(([, v]) => v > 0).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1 bg-purple-900/30 border border-purple-800/50 rounded-full px-2.5 py-0.5 text-xs">
            {k} {v}
            <button className="text-zinc-500 hover:text-zinc-200" onClick={() => combat.update(c.id, (x) => { x.conditions[k] = Math.max(0, (x.conditions[k] ?? 0) - 1); })}>−</button>
            <button className="text-zinc-500 hover:text-zinc-200" onClick={() => combat.update(c.id, (x) => { x.conditions[k] = (x.conditions[k] ?? 0) + 1; })}>+</button>
          </span>
        ))}
        {Object.values(c.conditions).every((v) => !v) && <span className="text-zinc-600 text-xs">无</span>}
      </div>
      <select
        value=""
        onChange={(e) => {
          const k = e.target.value;
          if (!k) return;
          combat.update(c.id, (x) => { x.conditions[k] = (x.conditions[k] ?? 0) + 1; });
          combat.addLog(`${c.name} 获得 1 点【${k}】`);
          e.target.value = "";
        }}
        className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs w-full"
      >
        <option value="">+ 添加状态点…</option>
        <optgroup label="点数状态">
          {CONDITION_DEFS.map((d) => <option key={d.name} value={d.name}>{d.name}({d.attrs.join("/")})</option>)}
        </optgroup>
        <optgroup label="固有状态(记1点标记)">
          {INNATE_CONDITIONS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
        </optgroup>
      </select>
    </div>
  );
}

function ResourceEditor({ c }: { c: Combatant }) {
  const combat = useCombat();
  return (
    <div className="border-t border-zinc-800 pt-3 grid grid-cols-2 gap-3">
      <div>
        <div className="text-xs font-bold text-emerald-400 mb-1.5">意志力</div>
        <div className="flex items-center gap-2 text-xs">
          <button className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700" onClick={() => combat.update(c.id, (x) => { x.willpower.cur = Math.max(0, x.willpower.cur - 1); })}>−</button>
          <span className="font-bold">{c.willpower.cur}/{c.willpower.max}</span>
          <button className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700" onClick={() => combat.update(c.id, (x) => { x.willpower.cur = Math.min(x.willpower.max, x.willpower.cur + 1); })}>+</button>
        </div>
      </div>
      {c.energy.length > 0 && (
        <div>
          <div className="text-xs font-bold text-sky-400 mb-1.5">能量池</div>
          {c.energy.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className="w-10 truncate">{p.name}</span>
              <button className="w-5 h-5 rounded bg-zinc-800" onClick={() => combat.update(c.id, (x) => { x.energy[i].cur = Math.max(0, x.energy[i].cur - 1); })}>−</button>
              <span className="font-bold">{p.cur}/{p.max}</span>
              <button className="w-5 h-5 rounded bg-zinc-800" onClick={() => combat.update(c.id, (x) => { x.energy[i].cur = Math.min(x.energy[i].max, x.energy[i].cur + 1); })}>+</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

