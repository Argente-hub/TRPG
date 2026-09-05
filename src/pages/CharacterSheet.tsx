import { useState, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCharacters } from "../store/characters";
import {
  ATTRIBUTES,
  ATTR_CATEGORIES,
  AttributeKey,
  CharacterData,
  SKILLS,
  skillBonusSuccesses,
  skillCategoryOf,
  skillDisplayName,
  deriveStats,
  attrTotal,
  MOVE_SLOTS,
  MoveSlot,
  AttackPreset,
  ItemRow,
  EquipmentSlot,
} from "../engine/character";
import { DP_BONUS_TYPES, DEFENSE_SLOTS } from "../engine/bonus";

/** 官方人物卡的八类资源标签 */
const RESOURCE_TAGS = ["血统", "改造", "瞳术", "称号", "流派", "魔导书", "修炼体系", "物品"] as const;

function categoryOf(r: { category: string }): string {
  if (r.category === "典籍") return "魔导书";
  return r.category;
}

export default function CharacterSheet() {
  const { id } = useParams();
  const nav = useNavigate();
  const { characters, update, activeId } = useCharacters();
  const ch = characters.find((c) => c.id === id) ?? characters.find((c) => c.id === activeId);

  if (!ch) {
    return (
      <div className="p-8 text-zinc-500">
        未找到角色。
        <button className="text-indigo-400 mx-1" onClick={() => nav("/")}>返回首页</button>
      </div>
    );
  }
  const patch = (fn: (c: CharacterData) => void) => update(ch.id, fn);
  const d = deriveStats(ch);

  const tagCounts: Record<string, number> = {};
  for (const r of ch.resources) {
    const cat = categoryOf(r);
    tagCounts[cat] = (tagCounts[cat] ?? 0) + 1;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-3">
      {/* ═══ 标题栏 + 资源标签 + 钱包 ═══ */}
      <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <input
              value={ch.name}
              onChange={(e) => patch((c) => { c.name = e.target.value; })}
              className="text-2xl font-bold bg-transparent border-none focus:outline-none focus:bg-zinc-900 rounded px-1 w-64"
            />
            <div className="text-xs text-zinc-600 mt-0.5">星光无限 3.x 人物卡</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-amber-900/30 border border-amber-800/50 rounded px-3 py-1.5 text-center">
              <div className="text-[11px] text-zinc-400">钱包</div>
              <div className="font-bold text-amber-300">{ch.ledger?.points ?? 0}分 + {ch.ledger?.xp ?? 0}XP</div>
            </div>
            <button onClick={() => nav("/realm")} className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">轮回之境账本</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {RESOURCE_TAGS.map((tag) => (
            <span key={tag} className={`text-xs rounded-full px-2.5 py-0.5 border ${(tagCounts[tag] ?? 0) > 0 ? "border-indigo-600 bg-indigo-900/40 text-indigo-200" : "border-zinc-700 text-zinc-500"}`}>
              [{tag}]{(tagCounts[tag] ?? 0) > 0 ? ` ×${tagCounts[tag]}` : ""}
            </span>
          ))}
        </div>
      </div>

      {/* ═══ 概念段 ═══ */}
      <CardSection title="概念段">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4">
          <Field label="姓名" value={ch.name} onChange={(v) => patch((c) => { c.name = v; })} />
          <Field label="性别" value={ch.gender} onChange={(v) => patch((c) => { c.gender = v; })} />
          <Field label="年龄" value={ch.age} onChange={(v) => patch((c) => { c.age = v; })} />
          <Field label="种族/国籍" value={ch.race} onChange={(v) => patch((c) => { c.race = v; })} />
          <Field label="身高/cm" value={ch.height} onChange={(v) => patch((c) => { c.height = v; })} />
          <Field label="体重/kg" value={ch.weight} onChange={(v) => patch((c) => { c.weight = v; })} />
          <Field label="语言" value={ch.languages} onChange={(v) => patch((c) => { c.languages = v; })} className="col-span-2" />
        </div>
        <Field label="外貌/特征" value={ch.appearance} onChange={(v) => patch((c) => { c.appearance = v; })} className="mt-1" />
        <Field label="性格/个性" value={ch.personality} onChange={(v) => patch((c) => { c.personality = v; })} />
        <Field label="概述" value={ch.concept} onChange={(v) => patch((c) => { c.concept = v; })} />
      </CardSection>

      {/* ═══ 属性段 ═══ */}
      <CardSection title="属性段" note="基础(2+建卡+购买) + 内在(血统/改造) + 修行(称号/流派) = 总值,≥6 获得传奇">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1">
          {ATTR_CATEGORIES.map((cat) => (
            <div key={cat}>
              <div className="text-xs font-bold text-indigo-400 mb-1">{cat}系</div>
              <div className="space-y-1">
                {ATTRIBUTES[cat].map((k) => {
                  const key = k as AttributeKey;
                  const comp = ch.attrComponents?.[key] ?? { intrinsic: 0, cultivation: 0 };
                  const total = attrTotal(ch, key);
                  return (
                    <div key={k} className="flex items-center gap-1.5 bg-zinc-900/70 border border-zinc-800 rounded px-2 py-1.5 text-sm">
                      <span className="w-9">{k}</span>
                      <NumBox value={ch.attributes[key]} onChange={(v) => patch((c) => { c.attributes[key] = Math.max(2, v); })} w="w-11" title="基础(2+建卡+购买,最低2)" />
                      <span className="text-zinc-600">+</span>
                      <NumBox value={comp.intrinsic} onChange={(v) => patch((c) => {
                        c.attrComponents[key] = { intrinsic: v, cultivation: c.attrComponents[key]?.cultivation ?? 0 };
                      })} w="w-9" title="内在(血统/改造)" />
                      <span className="text-zinc-600">+</span>
                      <NumBox value={comp.cultivation} onChange={(v) => patch((c) => {
                        c.attrComponents[key] = { intrinsic: c.attrComponents[key]?.intrinsic ?? 0, cultivation: v };
                      })} w="w-9" title="修行(称号/流派)" />
                      <span className="text-zinc-600">=</span>
                      <span className="font-bold ml-auto">{total}</span>
                      {d.legend[key] > 0 && <span className="text-amber-400 text-xs">传奇{d.legend[key]}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardSection>

      {/* ═══ 技能段 ═══ */}
      <CardSection
        title="技能段"
        note={
          ch.specialIdentitySkill
            ? `DP=属性+技能+专业;特殊身份1级指定:${ch.specialIdentitySkill}(建卡上限5)`
            : "DP=属性+技能+专业;5/7/9/11/13/15 级各 +1 附加成功"
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-0.5">
          {ATTR_CATEGORIES.map((cat) => {
            const names = Object.keys(ch.skills).filter((k) => skillCategoryOf(k) === cat);
            return (
              <div key={cat}>
                <div className="text-xs font-bold text-indigo-400 mb-1">{cat}系</div>
                <div className="space-y-0.5">
                  {names.length === 0 && <div className="text-xs text-zinc-600">无</div>}
                  {names.map((name) => {
                    const lv = ch.skills[name] ?? 0;
                    const specs = ch.specialties[name] ?? [];
                    return (
                      <div key={name} className={`flex items-center gap-2 rounded px-2 py-1 text-sm border ${lv > 0 ? "border-zinc-700 bg-zinc-900/70" : "border-zinc-800/60 bg-zinc-900/30 text-zinc-500"}`}>
                        <span>{skillDisplayName(name)}</span>
                        <span className={`font-bold ${lv > 0 ? "text-indigo-300" : ""}`}>{lv}</span>
                        {skillBonusSuccesses(lv) > 0 && <span className="text-amber-400 text-[10px]">+{skillBonusSuccesses(lv)}附</span>}
                        <span className="text-xs text-zinc-500 truncate ml-auto" title={specs.join("、")}>
                          {specs.length > 0 ? `专业:${specs.join("、")}` : "专业:"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={() => nav(`/builder?id=${ch.id}`)} className="mt-2 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700">
          前往建卡向导调整技能/专长
        </button>
      </CardSection>

      {/* ═══ 专长段 ═══ */}
      <CardSection title="专长段">
        <div className="space-y-1.5 text-sm">
          <GroupLine label="专长" items={ch.feats.map((f) => `${f.name}${f.level}`)} />
          <GroupLine label="天赋" items={ch.talents.map((t) => `${t.name}(${t.level}点)`)} />
          <GroupLine label="缺陷" items={ch.flaws.map((f) => `${f.name}(-${f.points})`)} />
          <GroupLine label="怪癖" items={ch.quirks} />
        </div>
      </CardSection>

      {/* ═══ 衍生属性段 ═══ */}
      <CardSection title="衍生属性段" note="公式与官方人物卡一致">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <Formula label="体积" value={`${ch.size}(官方体积值见规则书体型表)`} />
          <Formula label="先攻" value={`敏捷(${d.attrTotals["敏捷"]})+沉着(${d.attrTotals["沉着"]})+传奇沉着(${d.legend["沉着"]})×3 = 1d10+${d.initiative}`} />
          <Formula label="敏感范围" value={`感知(${d.attrTotals["感知"]})×10+传奇感知(${d.legend["感知"]})×20 = ${d.sensitiveRange}米`} />
          <Formula label="意志力基础用法" value={`传奇风度(${d.legend["风度"]})×2+3 = ${d.willpowerBaseUses}点`} />
          <Formula label="意志力" value={`决心(${d.attrTotals["决心"]})+沉着(${d.attrTotals["沉着"]})+传奇决心(${d.legend["决心"]})×3 = ${d.willpowerMax}点`} />
          <Formula label="基础移动速度" value={`力量(${d.attrTotals["力量"]})+敏捷(${d.attrTotals["敏捷"]})+体积 = ${d.speed}米`} />
          <Formula label="生命值" value={`体积+耐力(${d.attrTotals["耐力"]})+传奇耐力×(传奇+1)/2 = ${d.hp}点`} />
          <Formula label="基础防御" value={`min(敏捷,感知)+传奇敏+传奇感 = ${d.baseDefense}`} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {(["意志", "反射", "强韧"] as const).map((k) => (
            <div key={k} className="bg-zinc-900/70 border border-zinc-800 rounded px-3 py-2 text-xs">
              <div className="font-bold text-zinc-300">{k}豁免</div>
              <div className="text-zinc-500 mt-0.5">
                {d.saves[k].formula}+专业 = <span className="text-zinc-300">{d.attrTotals[d.saves[k].attr]}+技能等级</span>
              </div>
              {d.saves[k].perfect > 0 && <div className="text-amber-400">+[完美]{d.saves[k].perfect}DP(传奇{d.saves[k].attr}×3)</div>}
            </div>
          ))}
        </div>
      </CardSection>

      {/* ═══ 可用招式 ═══ */}
      <CardSection title="可用招式" note="把学会的招式按动作类型记录">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          {MOVE_SLOTS.map((slot) => (
            <Field key={slot} label={slot} value={ch.moves?.[slot] ?? ""} onChange={(v) => patch((c) => { c.moves[slot] = v; })} />
          ))}
        </div>
      </CardSection>

      {/* ═══ 攻击预设 ═══ */}
      <CardSection title={`攻击预设(${ch.attackPresets?.length ?? 0})`} note="常驻DP=属性+技能+专业+武器伤害+其他;浮动=+[完美]意志力">
        <div className="space-y-2">
          {(ch.attackPresets ?? []).map((a, i) => {
            const attrVal = d.attrTotals[a.attr as AttributeKey] ?? 0;
            const skillVal = ch.skills[a.skill] ?? 0;
            const standing = attrVal + skillVal + a.weaponDamage + (a.extraDp ?? 0);
            const autoCap = attrVal + skillVal + a.weaponDamage + (a.extraDp ?? 0);
            const cap = a.cap === -1 ? "∞(固定伤害)" : a.cap ?? autoCap;
            return (
              <div key={a.id} className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/70 text-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold">▓{a.name}{a.area ? "(范围)" : ""}</span>
                  <button className="text-zinc-600 hover:text-red-400 text-xs" onClick={() => patch((c) => { c.attackPresets.splice(i, 1); })}>删除</button>
                </div>
                <div className="text-xs text-zinc-400 space-y-0.5">
                  <div>伤害上限 = {a.attr}({attrVal})+{a.skill}({skillVal})+武器伤害({a.weaponDamage}) = <b className="text-zinc-200">{cap}</b></div>
                  <div>常驻 = 属性+技能+专业+武器伤害{(a.extraDp ?? 0) > 0 ? `+其他(${a.extraDp})` : ""} = <b className="text-zinc-200">{standing}</b>.w</div>
                  <div>浮动 = +[完美]意志力(3)+… = +3DP 起</div>
                  <div>攻击附加成功 = <b className="text-zinc-200">{a.bonusSuccesses ?? 0}</b></div>
                  {(a.highSpeed || a.breakArmor || a.breakMagic || (a.again ?? 10) !== 10) && (
                    <div className="text-rose-300">
                      【{[a.highSpeed ? `高速${a.highSpeed}` : "", a.breakArmor ? `破甲${a.breakArmor}` : "", a.breakMagic ? `破魔${a.breakMagic}` : "", a.again !== 10 ? `${a.again}加骰` : ""].filter(Boolean).join("】【")}】
                    </div>
                  )}
                  {(a.reach > 0 || a.range > 0) && (
                    <div>{a.reach > 0 ? `基础触及 = 武器体积/3+1 = ${a.reach}米 ` : ""}{a.range > 0 ? `基础射程 = ${a.range}米` : ""}</div>
                  )}
                  {a.note && <div className="text-zinc-500">特效:{a.note}</div>}
                </div>
              </div>
            );
          })}
          <AttackPresetEditor ch={ch} patch={patch} />
        </div>
      </CardSection>

      {/* ═══ 防御预设 ═══ */}
      <CardSection title="防御预设" note="基础防御由引擎按 min(敏捷,感知)+传奇 计算;浮动=+[完美]意志力3">
        <DefensePresetEditor ch={ch} patch={patch} derived={d} />
      </CardSection>

      {/* ═══ 能力段 ═══ */}
      <CardSection title={`能力段(${ch.resources.length})`} note="资料库中一键挂载;各模板的施法者职能在此登记">
        <div className="space-y-2">
          {RESOURCE_TAGS.map((tag) => {
            const list = ch.resources.filter((r) => categoryOf(r) === tag);
            const hasCaster = tag !== "物品";
            return (
              <div key={tag} className="border border-zinc-800 rounded px-3 py-2 bg-zinc-900/70">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-indigo-300">▓{tag}:</span>
                  {list.length === 0 && <span className="text-xs text-zinc-600">无</span>}
                  {list.map((r) => (
                    <span key={r.resourceId} className="inline-flex items-center gap-1 bg-zinc-800 rounded-full pl-2.5 pr-1.5 py-0.5 text-xs" title={r.ownedRanks?.length ? `已购等级:${r.ownedRanks.join("、")}` : undefined}>
                      {r.name}
                      {r.ownedRanks && r.ownedRanks.length > 1
                        ? `(${r.ownedRanks.join("、")}级·最高${r.rank ?? ""})`
                        : r.rank ? `·${r.rank}级` : ""}
                      <button className="text-zinc-500 hover:text-red-400" onClick={() => patch((c) => { c.resources = c.resources.filter((x) => x.resourceId !== r.resourceId); })}>×</button>
                    </span>
                  ))}
                </div>
                {hasCaster && (
                  <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                    施法者职能:
                    <input
                      value={ch.casterFunctions?.[tag] ?? ""}
                      placeholder="无"
                      onChange={(e) => patch((c) => { c.casterFunctions[tag] = e.target.value; })}
                      className="bg-transparent border-b border-zinc-800 focus:border-indigo-500 focus:outline-none w-40 text-zinc-300 px-1"
                    />
                  </div>
                )}
              </div>
            );
          })}
          <button
            onClick={() => patch((c) => {
              const name = prompt("资源名称:")?.trim();
              if (!name) return;
              const cat = prompt("分类(血统/改造/瞳术/称号/流派/魔导书/修炼体系/物品/技艺…):")?.trim() || "物品";
              const rank = prompt("等级(D/C/B/A/S,可空):")?.trim() || null;
              c.resources.push({ resourceId: `r_${Date.now().toString(36)}`, name, category: cat, rank });
            })}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700"
          >
            + 手动添加资源
          </button>
          {(() => {
            // 八类标签之外的其他分类(如 技艺:技能树子技能)
            const extraCats: Record<string, typeof ch.resources> = {};
            for (const r of ch.resources) {
              const cat = categoryOf(r);
              if (!(RESOURCE_TAGS as readonly string[]).includes(cat)) {
                (extraCats[cat] ??= []).push(r);
              }
            }
            return Object.entries(extraCats).map(([cat, list]) => (
              <div key={cat} className="border border-emerald-800/40 rounded px-3 py-2 bg-emerald-950/20">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-emerald-300">▓{cat}:</span>
                  {list.map((r) => (
                    <span key={r.resourceId} className="inline-flex items-center gap-1 bg-zinc-800 rounded-full pl-2.5 pr-1.5 py-0.5 text-xs">
                      {r.name}{r.rank ? `·${r.rank}级` : ""}
                      <button className="text-zinc-500 hover:text-red-400" onClick={() => patch((c) => { c.resources = c.resources.filter((x) => x.resourceId !== r.resourceId); })}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </CardSection>

      {/* ═══ 效果注记 ═══ */}
      <CardSection title={`效果注记 / 自定义加值(${ch.customBonuses?.length ?? 0})`} note="骰子与战斗页会自动应用这些加值">
        <BonusEditorInline ch={ch} patch={patch} />
      </CardSection>

      {/* ═══ 能量池 ═══ */}
      <CardSection title={`能量池(${ch.energyPools.length})`} note="上限=两关键属性之和">
        <div className="space-y-2">
          {ch.energyPools.map((p, i) => (
            <div key={i} className="flex items-center gap-3 bg-zinc-900/70 border border-zinc-800 rounded px-3 py-2">
              <span className="text-sm w-16">{p.name}</span>
              <input
                type="range"
                min={0}
                max={p.max}
                value={p.current}
                onChange={(e) => patch((c) => { c.energyPools[i].current = Number(e.target.value); })}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-sm font-bold w-14 text-right">{p.current}/{p.max}</span>
              <button className="text-zinc-600 hover:text-red-400" onClick={() => patch((c) => { c.energyPools.splice(i, 1); })}>×</button>
            </div>
          ))}
          {ch.energyPools.length === 0 && <span className="text-zinc-600 text-sm">无能量池(可通过建卡专长或资源获得)</span>}
        </div>
        <button
          onClick={() => patch((c) => {
            const name = prompt("能量池名称(魔力/内力/灵力/斗气…):")?.trim();
            if (!name) return;
            const max = Number(prompt("上限(两关键属性之和):") ?? "0");
            c.energyPools.push({ name, current: max, max: isNaN(max) ? 0 : max });
          })}
          className="mt-2 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700"
        >
          + 添加能量池
        </button>
      </CardSection>

      {/* ═══ 物品 ═══ */}
      <CardSection title="物品" note="武器/盔甲/道具穿戴于装备槽;消耗品记入表格">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(["武器", "盔甲", "道具"] as EquipmentSlot[]).map((slot) => {
            const item = ch.equipment?.[slot];
            return (
              <div key={slot} className="bg-zinc-900/70 border border-zinc-800 rounded px-2.5 py-1.5 text-xs min-w-36">
                <span className="text-zinc-500">{slot}:</span>
                {item ? (
                  <span className="ml-1">{item.name}
                    <button className="text-zinc-600 hover:text-red-400 ml-1" onClick={() => patch((c) => { delete c.equipment[slot]; })}>×</button>
                  </span>
                ) : (
                  <button
                    className="ml-1 text-zinc-600 hover:text-indigo-400"
                    onClick={() => patch((c) => {
                      const name = prompt(`装备到【${slot}】的物品名:`)?.trim();
                      if (name) c.equipment[slot] = { resourceId: `e_${Date.now().toString(36)}`, name, category: "物品" };
                    })}
                  >+ 装备</button>
                )}
              </div>
            );
          })}
        </div>
        <ItemTable ch={ch} patch={patch} />
      </CardSection>

      {/* ═══ 购买记录 ═══ */}
      <CardSection title="购买记录">
        <div className="text-sm text-zinc-300 space-y-1">
          <div>▓开卡资源:建卡专长/缺陷/怪癖/天赋(见专长段)</div>
          <div>▓钱包:<b className="text-amber-300">{ch.ledger?.points ?? 0}分 + {ch.ledger?.xp ?? 0}XP</b>
            <span className="text-zinc-500 ml-2">支线:
              {(["D", "C", "B", "A", "S"] as const).map((r) => (
                <span key={r} className="ml-1">{r}{ch.ledger?.missions?.[r] ?? 0}</span>
              ))}
            </span>
          </div>
        </div>
        <div className="mt-2 space-y-0.5 max-h-40 overflow-y-auto">
          {(ch.ledger?.history ?? []).slice(0, 8).map((h) => (
            <div key={h.id} className="text-xs text-zinc-500 flex justify-between gap-2">
              <span className="truncate">{h.desc}</span>
              <span className="shrink-0">{Object.entries(h.deltas).map(([k, v]) => `${k}${(v ?? 0) > 0 ? "+" : ""}${v}`).join(" ")}</span>
            </div>
          ))}
        </div>
        <button onClick={() => nav("/realm")} className="mt-2 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700">查看完整流水/发放奖励</button>
      </CardSection>
    </div>
  );
}

// ---------------- 通用小组件 ----------------

function CardSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
      <div className="flex items-baseline gap-3 mb-2.5">
        <h3 className="font-bold">▓▓{title}</h3>
        {note && <span className="text-xs text-zinc-600">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={`flex items-center gap-2 py-0.5 ${className ?? ""}`}>
      <span className="text-xs text-zinc-500 shrink-0">▓{label}:</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent border-b border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200 px-0.5"
      />
    </div>
  );
}

function NumBox({ value, onChange, w, title }: { value: number; onChange: (v: number) => void; w?: string; title?: string }) {
  return (
    <input
      type="number"
      value={value}
      title={title}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${w ?? "w-12"} bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:border-indigo-500`}
    />
  );
}

function Formula({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/70 rounded px-2.5 py-1.5 text-xs">
      <span className="font-bold text-zinc-300">▓{label}</span>
      <span className="text-zinc-500 ml-2">{value}</span>
    </div>
  );
}

function GroupLine({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex gap-2">
      <span className="text-zinc-500 shrink-0">▓{label}:</span>
      <span className="text-zinc-200">{items.length > 0 ? items.join("、") : "无"}</span>
    </div>
  );
}

// ---------------- 攻击预设编辑 ----------------

function AttackPresetEditor({ ch, patch }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "", attr: "力量", skill: "白刃", weaponDamage: 0, cap: "" as number | "", bonusSuccesses: 0,
    extraDp: 0, highSpeed: 0, breakArmor: 0, breakMagic: 0, again: 10 as 10 | 9 | 8,
    damageType: "L" as "B" | "L" | "A", reach: 0, range: 0, note: "", area: false,
  });

  const add = () => {
    if (!f.name.trim()) return;
    const preset: AttackPreset = {
      id: `atk_${Date.now().toString(36)}`,
      name: f.name.trim(),
      attr: f.attr,
      skill: f.skill,
      weaponDamage: f.weaponDamage,
      cap: !f.cap ? undefined : f.cap,
      bonusSuccesses: f.bonusSuccesses,
      extraDp: f.extraDp,
      highSpeed: f.highSpeed,
      breakArmor: f.breakArmor,
      breakMagic: f.breakMagic,
      again: f.again,
      damageType: f.damageType,
      reach: f.reach,
      range: f.range,
      note: f.note || undefined,
      area: f.area,
    };
    patch((c) => { c.attackPresets.push(preset); });
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 w-fit">
        + 添加攻击预设
      </button>
    );
  }

  return (
    <div className="border border-indigo-800/50 rounded-lg p-3 bg-zinc-900/80 space-y-2 text-xs">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="招式名" className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 w-28" />
        <Sel value={f.attr} onChange={(v) => setF({ ...f, attr: v })} options={Object.values(ATTRIBUTES).flat()} />
        <Sel value={f.skill} onChange={(v) => setF({ ...f, skill: v })} options={SKILLS.map((s) => s.name)} />
        <Num label="武器伤害" value={f.weaponDamage} onChange={(v) => setF({ ...f, weaponDamage: v })} />
        <Num label="上限(0=自动)" value={f.cap} onChange={(v) => setF({ ...f, cap: v })} />
        <Num label="附加成功" value={f.bonusSuccesses} onChange={(v) => setF({ ...f, bonusSuccesses: v })} />
        <Num label="其他DP" value={f.extraDp} onChange={(v) => setF({ ...f, extraDp: v })} />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Num label="高速" value={f.highSpeed} onChange={(v) => setF({ ...f, highSpeed: v })} />
        <Num label="破甲" value={f.breakArmor} onChange={(v) => setF({ ...f, breakArmor: v })} />
        <Num label="破魔" value={f.breakMagic} onChange={(v) => setF({ ...f, breakMagic: v })} />
        <label className="flex items-center gap-1 text-zinc-400">
          加骰
          <select value={f.again} onChange={(e) => setF({ ...f, again: Number(e.target.value) as 10 | 9 | 8 })} className="bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1">
            {[10, 9, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1 text-zinc-400">
          伤害级别
          <select value={f.damageType} onChange={(e) => setF({ ...f, damageType: e.target.value as "B" | "L" | "A" })} className="bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1">
            <option value="B">B 冲击</option>
            <option value="L">L 严重</option>
            <option value="A">A 恶性</option>
          </select>
        </label>
        <Num label="触及(米)" value={f.reach} onChange={(v) => setF({ ...f, reach: v })} />
        <Num label="射程(米)" value={f.range} onChange={(v) => setF({ ...f, range: v })} />
        <label className="flex items-center gap-1 text-zinc-400">
          <input type="checkbox" checked={f.area} onChange={(e) => setF({ ...f, area: e.target.checked })} />
          范围攻击
        </label>
      </div>
      <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="攻击特效/命中额外特效(自由记录)" className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5" />
      <div className="flex gap-2">
        <button onClick={add} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 font-bold">添加</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700">取消</button>
      </div>
    </div>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Num({ label, value, onChange }: { label: string; value: number | ""; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-zinc-400">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="w-14 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1 text-center"
      />
    </label>
  );
}

// ---------------- 防御预设 ----------------

function DefensePresetEditor({ ch, patch, derived }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void; derived: ReturnType<typeof deriveStats> }) {
  const dp = ch.defensePreset ?? {
    dodge: 0, bladeBlock: 0, brawlBlock: 0, shieldMelee: 0, shieldRanged: 0,
    armorMelee: 0, armorRanged: 0, natural: 0, extraBonusSuccesses: 0,
  };
  const set = (k: string, v: number | string) =>
    patch((c) => { (c.defensePreset as unknown as Record<string, number | string>)[k] = v; });

  const base = derived.baseDefense;
  const standingMelee = base + dp.dodge + dp.armorMelee + dp.natural;
  const standingRanged = base + dp.dodge + dp.armorRanged + dp.natural;
  const blockMelee = standingMelee + dp.bladeBlock + dp.shieldMelee;
  const blockRanged = standingRanged + dp.brawlBlock + dp.shieldRanged;
  const bonusTotal = derived.legend["敏捷"] + derived.legend["感知"] + dp.extraBonusSuccesses;

  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <NumBoxField label="闪避" value={dp.dodge} onChange={(v) => set("dodge", v)} />
        <NumBoxField label="白刃格挡" value={dp.bladeBlock} onChange={(v) => set("bladeBlock", v)} />
        <NumBoxField label="肉搏格挡" value={dp.brawlBlock} onChange={(v) => set("brawlBlock", v)} />
        <NumBoxField label="盾牌(近/远)" value={dp.shieldMelee} onChange={(v) => set("shieldMelee", v)} second={dp.shieldRanged} onSecond={(v) => set("shieldRanged", v)} />
        <NumBoxField label="盔甲(近/远)" value={dp.armorMelee} onChange={(v) => set("armorMelee", v)} second={dp.armorRanged} onSecond={(v) => set("armorRanged", v)} />
        <NumBoxField label="天生防御" value={dp.natural} onChange={(v) => set("natural", v)} />
        <NumBoxField label="防御附加成功" value={dp.extraBonusSuccesses} onChange={(v) => set("extraBonusSuccesses", v)} />
      </div>
      <div className="text-xs text-zinc-400 bg-zinc-950/60 border border-zinc-800 rounded p-2.5 space-y-1">
        <div>▓基础防御(取低) = min(敏捷{derived.attrTotals["敏捷"]}, 感知{derived.attrTotals["感知"]})+传奇敏{derived.legend["敏捷"]}+传奇感{derived.legend["感知"]} = <b className="text-zinc-200">{base}</b></div>
        <div>▓常驻 = 基础{base}+闪避{dp.dodge}+盔甲{dp.armorMelee}/{dp.armorRanged}+天生{dp.natural} = <b className="text-zinc-200">{standingMelee}/{standingRanged}+{dp.dodge}</b>(近战/远程+闪避)</div>
        <div>▓格挡(移动) = 常驻+白刃格挡{dp.bladeBlock}/肉搏格挡{dp.brawlBlock}+盾牌{dp.shieldMelee}/{dp.shieldRanged} = <b className="text-zinc-200">{blockMelee}/{blockRanged}</b>(近/远)</div>
        <div>▓全力防御(标准) = 基础防御翻倍 = <b className="text-zinc-200">{base * 2}</b></div>
        <div>▓浮动 = +[完美]意志力 3DP(基础用法 {derived.willpowerBaseUses} 点)</div>
        <div>▓防御附加成功 = 传奇敏{derived.legend["敏捷"]}+传奇感{derived.legend["感知"]}+其他 = <b className="text-zinc-200">{bonusTotal}</b></div>
      </div>
      <input
        value={dp.note ?? ""}
        placeholder="防御特殊属性(自由记录)"
        onChange={(e) => set("note", e.target.value)}
        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs"
      />
    </div>
  );
}

function NumBoxField({ label, value, onChange, second, onSecond }: { label: string; value: number; onChange: (v: number) => void; second?: number; onSecond?: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 bg-zinc-900/70 border border-zinc-800 rounded px-2 py-1.5 text-xs">
      <span className="text-zinc-400">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-12 bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5 text-center" />
      {second !== undefined && onSecond && (
        <>
          <span className="text-zinc-600">/</span>
          <input type="number" value={second} onChange={(e) => onSecond(Number(e.target.value))} className="w-12 bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5 text-center" />
        </>
      )}
    </label>
  );
}

// ---------------- 效果注记 ----------------

function BonusEditorInline({ ch, patch }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void }) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"dp" | "defense">("dp");
  const [type, setType] = useState<string>(DP_BONUS_TYPES[0]);
  const [slot, setSlot] = useState<string>(DEFENSE_SLOTS[0]);
  const [value, setValue] = useState(1);

  const add = () => {
    if (!label.trim()) return;
    patch((c) => {
      c.customBonuses.push({
        id: `b_${Date.now().toString(36)}`,
        label: label.trim(),
        kind,
        type: kind === "dp" ? type : undefined,
        slot: kind === "defense" ? slot : undefined,
        value,
      });
    });
    setLabel("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-3 text-xs">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="来源名,如:血统·吸血鬼" className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 w-40" />
        <select value={kind} onChange={(e) => setKind(e.target.value as "dp" | "defense")} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5">
          <option value="dp">DP加值</option>
          <option value="defense">防御槽位</option>
        </select>
        {kind === "dp" ? (
          <select value={type} onChange={(e) => setType(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5">
            {DP_BONUS_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        ) : (
          <select value={slot} onChange={(e) => setSlot(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5">
            {DEFENSE_SLOTS.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 w-16" />
        <button onClick={add} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500">添加</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(ch.customBonuses ?? []).map((b) => (
          <span key={b.id} className={`inline-flex items-center gap-1 text-xs rounded px-2 py-1 border ${b.value >= 0 ? "border-emerald-800/50 bg-emerald-900/10" : "border-red-800/50 bg-red-900/10"}`}>
            {b.label}:{b.kind === "dp" ? b.type : b.slot} {b.value >= 0 ? "+" : ""}{b.value}
            <button className="text-zinc-600 hover:text-red-400" onClick={() => patch((c) => { c.customBonuses = c.customBonuses.filter((x) => x.id !== b.id); })}>×</button>
          </span>
        ))}
        {(ch.customBonuses ?? []).length === 0 && <span className="text-zinc-600 text-xs">尚未录入</span>}
      </div>
    </div>
  );
}

// ---------------- 物品表格 ----------------

function ItemTable({ ch, patch }: { ch: CharacterData; patch: (fn: (c: CharacterData) => void) => void }) {
  const items = ch.items ?? [];
  const add = () => patch((c) => {
    c.items.push({ id: `i_${Date.now().toString(36)}`, name: "", qty: "", price: "", effect: "", remaining: "" });
  });
  const edit = (i: number, key: keyof ItemRow, v: string) => patch((c) => {
    (c.items[i][key] as string) = v;
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-zinc-400">
            <th className="border border-zinc-800 px-2 py-1 w-36">名称</th>
            <th className="border border-zinc-800 px-2 py-1 w-16">数量</th>
            <th className="border border-zinc-800 px-2 py-1 w-20">价格</th>
            <th className="border border-zinc-800 px-2 py-1">效果</th>
            <th className="border border-zinc-800 px-2 py-1 w-20">剩余</th>
            <th className="border border-zinc-800 px-2 py-1 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id}>
              {(["name", "qty", "price", "effect", "remaining"] as const).map((k) => (
                <td key={k} className="border border-zinc-800 p-0">
                  <input
                    value={it[k]}
                    onChange={(e) => edit(i, k, e.target.value)}
                    className="w-full bg-transparent px-2 py-1 focus:outline-none focus:bg-zinc-900"
                  />
                </td>
              ))}
              <td className="border border-zinc-800 text-center">
                <button className="text-zinc-600 hover:text-red-400" onClick={() => patch((c) => { c.items.splice(i, 1); })}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={add} className="mt-1.5 text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700">+ 添加物品行</button>
    </div>
  );
}
