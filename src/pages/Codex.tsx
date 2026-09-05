import { useEffect, useMemo, useState } from "react";
import {
  useResourceIndex,
  loadResourceChunk,
  ResourceEntry,
  ResourceIndexEntry,
} from "../lib/data";
import { useCharacters } from "../store/characters";
import { MissionRank, MISSION_RANKS } from "../engine/economy";
import { CurrencyUnit } from "../engine/character";

/** 解析价格字符串(如 "A+4000" / "10分")为账本扣减 */
function parsePrice(price?: string | null): { rank?: MissionRank; points?: number } | null {
  if (!price) return null;
  const m1 = price.match(/([SABCD])\s*\+\s*([\d,,\s]+)/);
  if (m1) {
    const pts = parseInt(m1[2].replace(/[,,\s]/g, ""), 10) || 0;
    return { rank: m1[1] as MissionRank, points: pts };
  }
  const m2 = price.match(/([\d,,\s]+)\s*分/);
  if (m2) return { points: parseInt(m2[1].replace(/[,,\s]/g, ""), 10) || 0 };
  return null;
}

const RANK_INDEX = (MISSION_RANKS as readonly string[]).indexOf.bind(MISSION_RANKS);

function priceLabel(price?: string | null): string {
  if (!price) return "价格待定";
  return price;
}

const RANKS = ["S", "A", "B", "C", "D", "无支线"];

export default function Codex() {
  const index = useResourceIndex();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("全部");
  const [rank, setRank] = useState<string>("全部");
  const [detail, setDetail] = useState<ResourceEntry | null>(null);
  const [showSubs, setShowSubs] = useState(true);
  const { characters, activeId, update } = useCharacters();
  const activeCh = characters.find((c) => c.id === activeId);

  const categories = useMemo(() => {
    if (!index) return [];
    const set = new Set<string>();
    for (const e of index.entries) set.add(e.path[0] ?? "其他");
    return ["全部", ...Array.from(set)];
  }, [index]);

  const filtered = useMemo(() => {
    if (!index) return [];
    const q = search.trim();
    return index.entries.filter((e) => {
      if (!showSubs && e.isSubSkill) return false;
      if (category !== "全部" && (e.path[0] ?? "其他") !== category) return false;
      if (rank !== "全部" && e.rank !== rank) return false;
      if (q && !e.name.includes(q) && !(e.price ?? "").includes(q) && !e.path.join("/").includes(q)) return false;
      return true;
    });
  }, [index, search, category, rank]);

  const openDetail = async (e: ResourceIndexEntry) => {
    const chunk = await loadResourceChunk(e.path[0] ?? "其他");
    const found = chunk?.entries.find((x) => x.id === e.id);
    if (found) setDetail(found);
  };

  const ownedRanksOf = (familyId: string): string[] => {
    return activeCh?.resources.find((r) => r.resourceId === familyId)?.ownedRanks ?? [];
  };

  const rankGE = (owned: string[], req: string): boolean => {
    const sorted = [...owned].sort((a, b) => RANK_INDEX(b) - RANK_INDEX(a));
    const oi = RANK_INDEX(sorted[0] ?? "");
    const ri = RANK_INDEX(req);
    return oi >= 0 && ri >= 0 && oi >= ri;
  };

  const buyRank = (familyId: string, familyName: string, category: string, rung: { rank: string; price: string }) => {
    if (!activeCh) {
      alert("请先在首页选择当前角色");
      return;
    }
    const ledger = activeCh.ledger ?? { missions: { D: 0, C: 0, B: 0, A: 0, S: 0 }, points: 0, xp: 0, history: [] };
    const p = parsePrice(rung.price);
    const owned = ownedRanksOf(familyId);
    if (owned.includes(rung.rank)) {
      alert(`已拥有「${familyName}」${rung.rank} 级`);
      return;
    }
    // 前置等级检查:D→C→B→A→S 逐级;跳级需 ST 裁定
    const ri = RANK_INDEX(rung.rank);
    for (let i = 0; i < ri; i++) {
      const lower = MISSION_RANKS[i];
      if (!owned.includes(lower)) {
        if (!confirm(`尚未持有「${familyName}」${lower} 级。确认跳级购买 ${rung.rank} 级?(规则上应逐级强化,跳级需 ST 裁定)`)) return;
        break;
      }
    }
    if (p) {
      if (p.rank && (ledger.missions[p.rank] ?? 0) < 1) {
        alert(`支线不足:需要 1 个 ${p.rank} 级支线,当前 ${ledger.missions[p.rank] ?? 0} 个`);
        return;
      }
      if (p.points && ledger.points < p.points) {
        alert(`分数不足:需要 ${p.points} 分,当前 ${ledger.points} 分`);
        return;
      }
    }
    if (!confirm(`确认购买「${familyName}」${rung.rank} 级${rung.price ? `(${rung.price})` : ""}?`)) return;
    if (p) {
      const deltas: Partial<Record<CurrencyUnit, number>> = {};
      if (p.rank) deltas[`支线${p.rank}` as CurrencyUnit] = -1;
      if (p.points) deltas["分数"] = -p.points;
      useCharacters.getState().addLedger(activeCh.id, `购买 ${familyName} ${rung.rank}级`, deltas);
    }
    const newOwned = [...owned, rung.rank].sort((a, b) => RANK_INDEX(b) - RANK_INDEX(a));
    update(activeCh.id, (c) => {
      const existing = c.resources.find((r) => r.resourceId === familyId);
      if (existing) {
        existing.ownedRanks = newOwned;
        existing.rank = newOwned[0];
      } else {
        c.resources.push({
          resourceId: familyId,
          name: familyName,
          category,
          rank: newOwned[0],
          ownedRanks: newOwned,
        });
      }
    });
  };

  const buyAndMount = (name: string, resourceId: string, category: string, price?: string | null) => {
    if (!activeCh) {
      alert("请先在首页选择当前角色");
      return;
    }
    const ledger = activeCh.ledger ?? { missions: { D: 0, C: 0, B: 0, A: 0, S: 0 }, points: 0, xp: 0, history: [] };
    const p = parsePrice(price);
    if (p) {
      if (p.rank && (ledger.missions[p.rank] ?? 0) < 1) {
        alert(`支线不足:需要 1 个 ${p.rank} 级支线,当前 ${ledger.missions[p.rank] ?? 0} 个`);
        return;
      }
      if (p.points && ledger.points < p.points) {
        alert(`分数不足:需要 ${p.points} 分,当前 ${ledger.points} 分`);
        return;
      }
    }
    if (!confirm(`确认购买「${name}」${price ? `(${price})` : ""}并挂载到 ${activeCh.name}?`)) return;
    if (p) {
      const deltas: Partial<Record<CurrencyUnit, number>> = {};
      if (p.rank) deltas[`支线${p.rank}` as CurrencyUnit] = -1;
      if (p.points) deltas["分数"] = -p.points;
      useCharacters.getState().addLedger(activeCh.id, `购买 ${name}`, deltas);
    }
    update(activeCh.id, (c) => {
      c.resources.push({
        resourceId,
        name,
        category,
        rank: p?.rank ?? null,
        price: price ?? null,
      });
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold">资料库</h1>
        <p className="text-xs text-zinc-500 mt-1">
          {index ? `共 ${index.count} 条资源(血统/改造/瞳术/称号/流派/典籍/技艺/物品/法术/修炼体系/随从)` : "加载中…"}
        </p>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索名称/分类/价格…"
          className="flex-1 min-w-48 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-sm">
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={rank} onChange={(e) => setRank(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-sm">
          <option>全部</option>
          {RANKS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input type="checkbox" checked={showSubs} onChange={(e) => setShowSubs(e.target.checked)} />
          显示技能/部件子条目
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
        <div className="border border-zinc-800 rounded-lg bg-zinc-900/40 overflow-hidden">
          <div className="text-xs text-zinc-500 px-3 py-2 border-b border-zinc-800">
            {filtered.length} 条{filtered.length > 300 && "(仅显示前300条,请细化搜索)"}
          </div>
          <div className="max-h-[36rem] overflow-y-auto divide-y divide-zinc-800/60">
            {filtered.slice(0, 300).map((e) => (
              <button
                key={e.id}
                onClick={() => openDetail(e)}
                className={`w-full text-left px-3 py-2 hover:bg-zinc-800/60 ${detail?.id === e.id ? "bg-zinc-800" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{e.name}</span>
                  {e.isSubSkill && <span className="text-[10px] px-1 rounded bg-emerald-900/70 text-emerald-300">树</span>}
                  {e.rank && <span className="text-[10px] px-1 rounded bg-indigo-900/70 text-indigo-300">{e.rank}级</span>}
                  {e.nature && <span className="text-[10px] text-zinc-500">{e.nature}</span>}
                </div>
                <div className="text-[11px] text-zinc-600 truncate">{e.path.join(" / ")}{e.price ? ` · ${e.price}` : ""}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-zinc-800 rounded-lg bg-zinc-900/40 p-4 h-fit lg:sticky lg:top-4 max-h-[40rem] overflow-y-auto">
          {detail ? (
            <>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-bold">{detail.name}</h2>
                <div className="flex gap-1.5 shrink-0">
                  {detail.rank && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900/70 text-indigo-300">{detail.rank}级</span>}
                  {detail.price && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300">{detail.price}</span>}
                </div>
              </div>
              <div className="text-[11px] text-zinc-600 mb-3">{detail.path.join(" / ")} · 原文件:{detail.file}</div>
              {detail.isSubSkill && !detail.gatedBy && (
                <button
                  onClick={() => buyAndMount(detail.name, detail.id, detail.path[0] ?? "技艺", detail.price)}
                  className="mb-3 w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-bold"
                >
                  购买并挂载({priceLabel(detail.price)})
                </button>
              )}
              {detail.isSubSkill && detail.gatedBy && (() => {
                const owned = ownedRanksOf(detail.gatedBy.familyId);
                const ok = rankGE(owned, detail.gatedBy.reqRank);
                const highest = [...owned].sort((a, b) => RANK_INDEX(b) - RANK_INDEX(a))[0];
                return (
                  <div className="mb-3">
                    <div className={`text-xs mb-1.5 ${ok ? "text-emerald-400" : "text-amber-400"}`}>
                      门槛:需要「{detail.gatedBy.family}」{detail.gatedBy.reqRank} 级
                      {owned.length > 0 ? `(当前最高:${highest} 级)` : "(未持有)"}
                    </div>
                    <button
                      disabled={!ok}
                      onClick={() => buyAndMount(detail.name, detail.id, detail.gatedBy!.family, detail.price)}
                      className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {ok ? `购买并挂载(${priceLabel(detail.price)})` : "需先提升资源等级"}
                    </button>
                  </div>
                );
              })()}
              {detail.ranks && detail.ranks.length > 0 && (
                <div className="mb-4 border border-indigo-800/50 rounded-lg p-3 bg-indigo-950/20">
                  <div className="text-sm font-bold text-indigo-300 mb-2">▓等级阶梯(逐级购买,最高等级决定可购买的技能/物品):</div>
                  <div className="space-y-1.5">
                    {detail.ranks.map((rung, i) => {
                      const owned = ownedRanksOf(detail.id);
                      const isOwned = owned.includes(rung.rank);
                      const ri = RANK_INDEX(rung.rank);
                      const prevOwned = ri <= 0 || owned.includes(MISSION_RANKS[ri - 1]);
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm bg-zinc-900/70 border border-zinc-800 rounded px-2.5 py-1.5 flex-wrap">
                          <span className={`text-[10px] px-1 rounded ${isOwned ? "bg-emerald-900/70 text-emerald-300" : "bg-indigo-900/70 text-indigo-300"}`}>
                            {rung.rank}级
                          </span>
                          {(() => {
                            const subTitle = rung.title.replace(/^\S+级\s*/, "").replace(/^[::\s]+/, "").trim();
                            return subTitle ? <span className="truncate">{subTitle}</span> : null;
                          })()}
                          {rung.price && <span className="text-[10px] text-amber-300">{rung.price}{(rung as { tablePrice?: boolean }).tablePrice ? "(标准价)" : ""}</span>}
                          <span className="ml-auto flex items-center gap-2">
                            {isOwned && <span className="text-xs text-emerald-400">✓已拥有</span>}
                            {!isOwned && (
                              <button
                                onClick={() => buyRank(detail.id, detail.name, detail.path[0] ?? "血统", rung)}
                                className={`text-xs px-2.5 py-1 rounded font-bold ${prevOwned ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-700 hover:bg-zinc-600"}`}
                                title={prevOwned ? "购买此级" : "前置等级未持有,将提示跳级需 ST 裁定"}
                              >
                                {prevOwned ? "购买此级" : "跳级购买"}
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <EntryText text={detail.text} />
              {detail.subSkills && detail.subSkills.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-bold text-indigo-300 mb-2">
                    ▓本技能树包含 {detail.subSkills.length} 个可单独购买的技能:
                  </div>
                  <div className="space-y-2">
                    {detail.subSkills.map((sub, i) => (
                      <details key={i} className="border border-zinc-800 rounded bg-zinc-950/50">
                        <summary className="cursor-pointer px-3 py-2 text-sm flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{sub.name}</span>
                          {sub.rank && <span className="text-[10px] px-1 rounded bg-indigo-900/70 text-indigo-300">{sub.rank}级</span>}
                          {sub.price && <span className="text-[10px] px-1 rounded bg-amber-900/50 text-amber-300">{sub.price}</span>}
                        </summary>
                        <div className="px-3 pb-3">
                          <EntryText text={sub.text} />
                          <div className="flex gap-2 mt-2">
                            {(() => {
                              // 树条目自身是阶梯资源时,子技能按家族最高等级设门槛
                              if (!detail.ranks || detail.ranks.length === 0) return null;
                              const owned = ownedRanksOf(detail.id);
                              const ok = sub.rank ? rankGE(owned, sub.rank) : true;
                              const highest = [...owned].sort((a, b) => RANK_INDEX(b) - RANK_INDEX(a))[0];
                              if (ok) return null;
                              return (
                                <span className="text-xs text-amber-400 self-center">
                                  需「{detail.name}」{sub.rank} 级{owned.length > 0 ? `(当前最高:${highest})` : "(未持有)"}
                                </span>
                              );
                            })()}
                            <button
                              disabled={!!detail.ranks?.length && sub.rank ? !rankGE(ownedRanksOf(detail.id), sub.rank) : false}
                              onClick={() => buyAndMount(sub.name, `${detail.id}_s${i}`, detail.path[0] ?? "技艺", sub.price)}
                              className="text-xs px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              购买并挂载{sub.price ? `(${sub.price})` : ""}
                            </button>
                            <button
                              onClick={() => {
                                if (!activeCh) { alert("请先在首页选择当前角色"); return; }
                                update(activeCh.id, (c) => {
                                  c.resources.push({
                                    resourceId: `${detail.id}_s${i}`,
                                    name: sub.name,
                                    category: detail.path[0] ?? "技艺",
                                    rank: sub.rank,
                                    price: sub.price,
                                  });
                                });
                                alert(`已挂载「${sub.name}」到 ${activeCh.name}`);
                              }}
                              className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700"
                            >
                              仅挂载(ST 裁定获得)
                            </button>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
              {!detail.isSubSkill && activeCh && !detail.subSkills && (
                <button
                  onClick={() => {
                    update(activeCh.id, (c) => {
                      c.resources.push({
                        resourceId: detail.id,
                        name: detail.name,
                        category: detail.path[0] ?? "资源",
                        rank: detail.rank,
                        price: detail.price,
                      });
                    });
                    alert(`已挂载「${detail.name}」到 ${activeCh.name}`);
                  }}
                  className="mt-4 w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-bold"
                >
                  挂载到当前角色({activeCh.name})
                </button>
              )}
            </>
          ) : (
            <div className="text-zinc-600 text-sm py-16 text-center">选择左侧条目查看详情</div>
          )}
        </div>
      </div>
    </div>
  );
}

function EntryText({ text }: { text: string }) {
  // 轻量渲染:标题行/表格行/分隔线
  const lines = text.split("\n");
  return (
    <div className="text-sm space-y-1 leading-relaxed">
      {lines.map((line, i) => {
        if (/^#{1,6}\s/.test(line)) {
          const level = line.match(/^#+/)![0].length;
          return (
            <div key={i} className={`font-bold ${level <= 2 ? "text-base mt-2" : ""}`}>{line.replace(/^#+\s*/, "")}</div>
          );
        }
        if (/^=+$/.test(line.trim())) return <hr key={i} className="border-zinc-800 my-1" />;
        if (line.startsWith("|")) {
          return (
            <div key={i} className="text-xs font-mono text-zinc-400 whitespace-pre-wrap">{line}</div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}
