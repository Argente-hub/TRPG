import { useEffect, useMemo, useState } from "react";
import {
  useResourceIndex,
  loadResourceChunk,
  useRulebookVersion,
  useRuleVersions,
  ResourceEntry,
  ResourceIndexEntry,
} from "../lib/data";
import { useCharacters } from "../store/characters";
import { useCustomResources, CustomResource } from "../store/customResources";
import { parseImportedText, ParsedEntry, IMPORT_RANKS } from "../lib/parseImport";
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
  const versions = useRuleVersions();
  const [versionId, selectVersion] = useRulebookVersion();
  const index = useResourceIndex(versionId);
  const customStore = useCustomResources();
  const customEntries = customStore.entries;
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("全部");
  const [rank, setRank] = useState<string>("全部");
  const [detail, setDetail] = useState<ResourceEntry | null>(null);
  const [showSubs, setShowSubs] = useState(true);
  const [showCustom, setShowCustom] = useState(true);
  const { characters, activeId, update } = useCharacters();
  const activeCh = characters.find((c) => c.id === activeId);

  // 切换规则书:分类与详情基于旧版本的筛选失效,重置
  useEffect(() => {
    setCategory("全部");
    setDetail(null);
  }, [versionId]);

  const allEntries = useMemo(() => {
    const custom: ResourceIndexEntry[] = customEntries.map((c) => ({
      id: c.id,
      name: c.name,
      path: [c.category, "自定义"],
      rank: c.rank,
      price: c.price,
      nature: c.nature,
      isSubSkill: false,
      isCustom: true,
    }));
    return [...custom, ...(index?.entries ?? [])];
  }, [index, customEntries]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return allEntries.filter((e) => {
      if (!showSubs && e.isSubSkill) return false;
      if (!showCustom && e.isCustom) return false;
      if (category !== "全部" && (e.path[0] ?? "其他") !== category) return false;
      if (rank !== "全部" && e.rank !== rank) return false;
      if (q && !e.name.includes(q) && !(e.price ?? "").includes(q) && !e.path.join("/").includes(q)) return false;
      return true;
    });
  }, [allEntries, search, category, rank, showSubs, showCustom]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntries) set.add(e.path[0] ?? "其他");
    return ["全部", ...Array.from(set)];
  }, [allEntries]);

  const openDetail = async (e: ResourceIndexEntry) => {
    if (e.isCustom) {
      const found = customEntries.find((x) => x.id === e.id);
      if (found) setDetail({ ...found, toc: found.name, file: "(自定义导入)", path: [found.category, "自定义"] });
      return;
    }
    const chunk = await loadResourceChunk(versionId, e.path[0] ?? "其他");
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
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold">资料库</h1>
          <select
            value={versionId}
            onChange={(e) => selectVersion(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-bold"
            title="切换规则书版本(规则书页同步切换)"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>📘 {v.label}</option>
            ))}
            {versions.length === 0 && <option>加载中…</option>}
          </select>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          {index
            ? `《${versions.find((v) => v.id === versionId)?.label ?? versionId}》内置 ${index.count} 条 + 自定义 ${customEntries.length} 条资源(${(index.chunks ?? []).map((c) => c.category).join("/")})`
            : "加载中…"}
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
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input type="checkbox" checked={showCustom} onChange={(e) => setShowCustom(e.target.checked)} />
          显示自定义资源({customEntries.length})
        </label>
        <button
          onClick={() => setShowImport(!showImport)}
          className="ml-auto px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-bold"
        >
          ＋ 导入资源
        </button>
      </div>

      {showImport && (
        <ImportPanel
          onDone={() => setShowImport(false)}
          onImported={() => setShowCustom(true)}
        />
      )}

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
                  {(e as ResourceIndexEntry & { isCustom?: boolean }).isCustom && (
                    <span className="text-[10px] px-1 rounded bg-sky-900/70 text-sky-300">自定义</span>
                  )}
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
                            {rung.rank}{rung.rank.endsWith("层") ? "" : "级"}
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
              {detail.file === "(自定义导入)" && (
                <button
                  onClick={() => {
                    if (!confirm(`删除自定义资源「${detail.name}」?`)) return;
                    customStore.remove(detail.id);
                    setDetail(null);
                  }}
                  className="mt-4 w-full py-2 rounded bg-red-800 hover:bg-red-700 text-sm font-bold"
                >
                  删除该自定义资源
                </button>
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

// ---------------- 导入资源面板 ----------------

function ImportPanel({ onDone, onImported }: { onDone: () => void; onImported: () => void }) {
  const [raw, setRaw] = useState("");
  const [category, setCategory] = useState("物品");
  const [preview, setPreview] = useState<ParsedEntry[] | null>(null);
  const [ranks, setRanks] = useState<Record<number, string>>({});
  const [excluded, setExcluded] = useState<Record<number, boolean>>({});
  const addMany = useCustomResources((s) => s.addMany);
  const { setActive } = useCharacters();
  void setActive;

  const doParse = () => {
    const list = parseImportedText(raw, category);
    setPreview(list);
    const r: Record<number, string> = {};
    list.forEach((e, i) => { if (e.rank) r[i] = e.rank; });
    setRanks(r);
    setExcluded({});
  };

  const confirm = () => {
    if (!preview) return;
    const list: CustomResource[] = [];
    preview.forEach((e, i) => {
      if (excluded[i]) return;
      const rank = ranks[i] ?? e.rank ?? null;
      list.push({
        id: `u_${Date.now().toString(36)}_${i}`,
        name: e.name,
        category,
        rank,
        price: e.price,
        nature: e.nature,
        text: e.text,
        ranks: e.ranks,
        subSkills: e.subSkills,
        createdAt: Date.now(),
      });
    });
    if (list.length === 0) { alert("没有勾选任何条目"); return; }
    addMany(list);
    onImported();
    alert(`已导入 ${list.length} 条自定义资源(可在列表中以"自定义"徽标识别)`);
    onDone();
  };

  const onFile = async (f: File) => {
    const text = await f.text();
    setRaw(text);
    setPreview(null);
  };

  return (
    <div className="border border-emerald-800/50 rounded-lg p-4 bg-emerald-950/10 mb-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-bold text-sm">导入外部资源(自动分级)</h3>
        <label className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 cursor-pointer">
          从文件导入(.txt/.md)
          <input type="file" accept=".txt,.md,.json" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        粘贴资源文本(支持多条:存在 ===== 分隔线时按分隔线切分;无分隔线时按空行切分)。自动识别:名称、
        <b className="text-amber-300">等级</b>(价格"D+500"/"等级:D级"/名称带级别/阶梯结构,无价格时按分类标准价表回退)、价格、本质、
        等级阶梯(D级:/C级: 段)与可单独购买的子技能。导入后可随时删除。
      </p>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={6}
        placeholder={`示例:
血统·示例
本质:魔幻本质
价格:D+600
技能树:开启示例D级技能树
特性:…

====

D级:入门
价格:D+600
属性:…

====

示例技艺
价格:D+500
动作:标准动作
效果:…`}
        className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm font-mono"
      />
      <div className="flex gap-2 items-center flex-wrap">
        <label className="text-xs text-zinc-400 flex items-center gap-1.5">
          归入分类
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm">
            {["血统", "改造", "瞳术", "称号", "流派", "典籍", "修炼体系", "技艺", "物品", "随从", "法术", "其他"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <button onClick={doParse} disabled={!raw.trim()} className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-bold disabled:opacity-40">
          解析并预览
        </button>
        {preview && (
          <button onClick={confirm} className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-bold">
            确认导入({preview.filter((_, i) => !excluded[i]).length} 条)
          </button>
        )}
        <button onClick={onDone} className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm">收起</button>
      </div>

      {preview && (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {preview.length === 0 && <div className="text-xs text-red-400">未能解析出任何条目:请检查是否使用 ===== 分隔线或空行分隔多条资源。</div>}
          {preview.map((e, i) => (
            <div key={i} className={`border rounded px-3 py-2 text-sm ${excluded[i] ? "border-zinc-800 opacity-40" : "border-zinc-700 bg-zinc-900/70"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="checkbox"
                  checked={!excluded[i]}
                  onChange={(ev) => setExcluded({ ...excluded, [i]: !ev.target.checked })}
                />
                <span className="font-medium">{e.name}</span>
                <label className="text-[11px] text-zinc-400 flex items-center gap-1">
                  自动分级:
                  <select
                    value={ranks[i] ?? ""}
                    onChange={(ev) => setRanks({ ...ranks, [i]: ev.target.value })}
                    className="bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5"
                  >
                    <option value="">未分级</option>
                    {IMPORT_RANKS.map((r) => <option key={r} value={r}>{r}级</option>)}
                  </select>
                  <span className="text-zinc-600">(依据:{e.rankSource})</span>
                </label>
                {e.price && <span className="text-[11px] text-amber-300">{e.price}</span>}
                {e.nature && <span className="text-[11px] text-zinc-500">{e.nature}</span>}
                {e.ranks && <span className="text-[11px] text-indigo-300">阶梯 {e.ranks.map((r) => r.rank).join("/")}</span>}
                {e.subSkills && <span className="text-[11px] text-emerald-300">子技能 {e.subSkills.length} 个</span>}
              </div>
              <div className="text-[11px] text-zinc-600 mt-1 line-clamp-2">{e.text.slice(0, 120)}…</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
