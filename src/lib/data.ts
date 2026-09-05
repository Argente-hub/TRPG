/** 数据加载:规则书 md、建卡数据(专长/缺陷/怪癖/天赋)、资源库。带内存缓存。 */
import { useSyncExternalStore } from "react";

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

function useCached<T>(key: string, url: string): T | null {
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
  if (!cache.has(key)) {
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

export function useFeats() {
  return useCached<FeatsData>("feats", "./data/curated/feats.json");
}
export function useFlaws() {
  return useCached<{ count: number; entries: FlawEntry[] }>("flaws", "./data/curated/flaws.json");
}
export function useQuirks() {
  return useCached<{ count: number; entries: QuirkEntry[] }>("quirks", "./data/curated/quirks.json");
}
export function useTalents() {
  return useCached<{ count: number; entries: TalentEntry[] }>("talents", "./data/curated/talents.json");
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

export function useResourceIndex() {
  const idx = useCached<ResourceIndex>("res-index", "./data/resources/index.json");
  if (idx) setIndexData(idx);
  return idx;
}

let indexData: ResourceIndex | null = null;
export function setIndexData(idx: ResourceIndex | null) {
  indexData = idx;
}

export function categoryFile(category: string): string {
  const meta = indexData?.chunks.find((c) => c.category === category);
  return `./data/resources/${meta ? meta.file : `cat_UNKNOWN_${category}.json`}`;
}

export function loadResourceChunk(category: string): Promise<ResourceChunk | null> {
  return load<ResourceChunk>(`res-cat-${category}`, categoryFile(category));
}

// ---------------- 规则书 ----------------

export interface RuleFileMeta { file: string; title: string }

export function useRuleList(): RuleFileMeta[] | null {
  const idx = useCached<{ files: RuleFileMeta[] }>("rules-list", "./data/rules/index.json");
  return idx?.files ?? null;
}

export async function loadRuleText(file: string): Promise<string | null> {
  const key = `rule-${file}`;
  if (cache.has(key)) return cache.get(key) as string;
  try {
    const res = await fetch(`./data/rules/${encodeURIComponent(file)}`);
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
