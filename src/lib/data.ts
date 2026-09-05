/** 数据加载:规则书 md、建卡数据(专长/缺陷/怪癖/天赋)、资源库。带内存缓存。 */
import { useEffect, useSyncExternalStore } from "react";
import { useRulebook } from "../store/rulebook";

const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();
const loading = new Set<string>();

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

async function load<T>(key: string, url: string): Promise<T | null> {
  if (cache.has(key)) return cache.get(key) as T;
  if (loading.has(key)) return null;
  loading.add(key);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as T;
    cache.set(key, data);
    return data;
  } catch (e) {
    console.error(`加载失败 ${url}`, e);
    return null;
  } finally {
    loading.delete(key);
    notify(key);
  }
}

function useCached<T>(key: string, url: string | null): T | null {
  useSyncExternalStore(
    (cb) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(cb);
      return () => {
        listeners.get(key)!.delete(cb);
      };
    },
    () => cache.has(key),
    () => false,
  );
  if (!cache.has(key) && url) {
    void load<T>(key, url).then((d) => {
      if (d) notify(key);
    });
  }
  return (cache.get(key) as T) ?? null;
}

// ---------------- 建卡数据 ----------------

export interface FeatEntry {
  name: string;
  category: string;
  battle: boolean;
  exotic: boolean;
  maxLevel: number;
  /** 起始等级(多数为 1;仅 X 级的专长如超凡身份(5) 则为 5) */
  startLevel: number;
  text: string;
}
export interface FlawEntry {
  name: string;
  category: string;
  points: number;
  text: string;
}
export interface QuirkEntry {
  name: string;
  category: string;
  text: string;
}
export interface TalentEntry {
  name: string;
  category: string;
  cost: number;
  text: string;
}
export interface FeatsData { count: number; entries: FeatEntry[] }

export function useFeats(version: string | undefined = "3.25") {
  return useCached<FeatsData>(`feats-${version}`, `./data/curated/${version}/feats.json`);
}
export function useFlaws(version: string | undefined = "3.25") {
  return useCached<{ count: number; entries: FlawEntry[] }>(`flaws-${version}`, `./data/curated/${version}/flaws.json`);
}
export function useQuirks(version: string | undefined = "3.25") {
  return useCached<{ count: number; entries: QuirkEntry[] }>(`quirks-${version}`, `./data/curated/${version}/quirks.json`);
}
export function useTalents(version: string | undefined = "3.25") {
  return useCached<{ count: number; entries: TalentEntry[] }>(`talents-${version}`, `./data/curated/${version}/talents.json`);
}

// ---------------- 资源库 ----------------

export interface ResourceIndexEntry {
  id: string;
  name: string;
  path: string[];
  rank: string | null;
  price: string | null;
  nature: string | null;
  /** 技能树拆分出的子技能 */
  isSubSkill?: boolean;
  parentId?: string;
  /** 部件门槛:需要持有资源 family ≥ reqRank 级 */
  gatedBy?: { family: string; familyId: string; reqRank: string };
  /** 用户从外部导入的自定义资源 */
  isCustom?: boolean;
}

export interface SubSkill {
  name: string;
  rank: string | null;
  price: string | null;
  text: string;
  /** 分支页内部的等级阶梯(如 修真层级) */
  ranks?: RankRung[];
}
export interface ResourceChunkMeta {
  category: string;
  file: string;
  count: number;
}
export interface ResourceIndex {
  count: number;
  chunks: ResourceChunkMeta[];
  entries: ResourceIndexEntry[];
}
export interface ResourceEntry extends ResourceIndexEntry {
  toc: string;
  file: string;
  text: string;
  /** 技能树条目的子技能列表 */
  subSkills?: SubSkill[];
  /** 等级阶梯(如血统 D/C/B/A/S 逐级购买) */
  ranks?: RankRung[];
}

export interface RankRung {
  rank: string;
  price: string;
  title: string;
  text: string;
}
export interface ResourceChunk {
  category: string;
  count: number;
  entries: ResourceEntry[];
}

export function useResourceIndex(version: string) {
  const idx = useCached<ResourceIndex>(
    `res-index-${version}`,
    version ? `./data/resources/${version}/index.json` : null,
  );
  if (idx) setIndexData(version, idx);
  return idx;
}

const indexData: Record<string, ResourceIndex> = {};
export function setIndexData(version: string, idx: ResourceIndex) {
  indexData[version] = idx;
}

export function categoryFile(version: string, category: string): string {
  const meta = indexData[version]?.chunks.find((c) => c.category === category);
  return `./data/resources/${version}/${meta ? meta.file : `cat_UNKNOWN_${category}.json`}`;
}

export function loadResourceChunk(version: string, category: string): Promise<ResourceChunk | null> {
  return load<ResourceChunk>(`res-cat-${version}-${category}`, categoryFile(version, category));
}

// ---------------- 规则书(多版本) ----------------

export interface RuleFileMeta { file: string | null; title: string; depth?: number }
export interface RuleVersionMeta { id: string; label: string; source?: string }

export function useRuleVersions(): RuleVersionMeta[] {
  const idx = useCached<{ versions: RuleVersionMeta[] }>("rule-versions", "./data/rules/versions.json");
  return idx?.versions ?? [];
}

/** 全站共享的"当前规则书":规则书阅读器与资料库跟随同一选择(见 store/rulebook.ts)。 */
export function useRulebookVersion(): [string, (id: string) => void] {
  const versions = useRuleVersions();
  const versionId = useRulebook((s) => s.versionId);
  const setVersion = useRulebook((s) => s.setVersion);
  // 默认取第一个版本;持久化的版本不存在时回退
  useEffect(() => {
    if (versions.length === 0) return;
    if (!versions.some((v) => v.id === versionId)) {
      setVersion(versions[0].id);
    }
  }, [versions, versionId, setVersion]);
  return [versionId, setVersion];
}

export function useRuleList(version: string): RuleFileMeta[] | null {
  const idx = useCached<{ files: RuleFileMeta[] }>(
    `rules-list-${version}`,
    version ? `./data/rules/${version}/index.json` : null,
  );
  return idx?.files ?? null;
}

export async function loadRuleText(version: string, file: string): Promise<string | null> {
  const key = `rule-${version}-${file}`;
  if (cache.has(key)) return cache.get(key) as string;
  try {
    const res = await fetch(`./data/rules/${version}/${encodeURIComponent(file)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    cache.set(key, text);
    return text;
  } catch (e) {
    console.error(`加载规则失败 ${file}`, e);
    return null;
  }
}

export function getCachedText(key: string): string | null {
  return (cache.get(key) as string) ?? null;
}
