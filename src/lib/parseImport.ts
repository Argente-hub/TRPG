/** 外部资源导入:文本解析 + 自动分级 */

export type MissionRank = "D" | "C" | "B" | "A" | "S";
export const IMPORT_RANKS: MissionRank[] = ["D", "C", "B", "A", "S"];

/** 标准价格表(无显式价格时按分类回退) */
const PRICE_TABLE: Record<string, Record<string, number>> = {
  血统: { D: 600, C: 1200, B: 3600, A: 7200, AA: 10800, S: 14400 },
  改造: { D: 500, C: 1000, B: 2000, A: 4000, S: 8000 },
  瞳术: { D: 600, C: 1200, B: 2400, A: 4800, S: 9600 },
  称号: { D: 1000, C: 2000, B: 4000, A: 8000, AA: 12000, S: 16000 },
  流派: { D: 1000, C: 2000, B: 4000, A: 8000, AA: 12000, S: 16000 },
  典籍: { D: 1000, C: 2000, B: 4000, A: 8000, S: 16000 },
  技艺: { D: 500, C: 1000, B: 2000, A: 4000, S: 8000 },
  物品: { D: 500, C: 1000, B: 2000, A: 4000, S: 8000 },
  随从: { D: 500, C: 1000, B: 2000, A: 4000, S: 8000 },
  修炼体系: { D: 600, C: 1200, B: 2400, A: 4800, S: 9600 },
};

const PRICE_RANK_RE = /价格[：:]\s*([SABCD])\s*\+\s*([\d,,\s]+)/;
const PRICE_PT_RE = /价格[：:]\s*([\d,,\s]+)\s*分/;
const LADDER_HEAD_RE = /^\s*([SABCD])\s*级\s*(?:[：:].*)?$/;
const NAME_LEVEL_RE = /[（(]\s*([SABCD])\s*级\s*[))]/;

export interface ParsedPart {
  name: string;
  rank: string | null;
  price: string | null;
  text: string;
}

export interface ParsedEntry {
  name: string;
  rank: string | null;
  price: string | null;
  nature: string | null;
  text: string;
  /** 等级阶梯(如自制血统 D~S) */
  ranks?: { rank: string; price: string; title: string; text: string }[];
  /** 可单独购买的子技能/物品 */
  subSkills?: ParsedPart[];
  /** 分级依据 */
  rankSource: "价格" | "等级标注" | "名称" | "阶梯" | "无";
}

/**
 * 条目切分:空行与 ===== 分隔线均为分隔符(归一化后统一按两者切分),
 * "====" 标记块本身不会成为条目。
 */
function splitBlocks(text: string): string[] {
  const norm = text.replace(/\r\n?/g, "\n").replace(/={5,}/g, "\n====\n");
  return norm
    .split(/\n\s*====\s*\n|\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
}

function firstLine(block: string): string {
  for (const ln of block.split("\n")) {
    const t = ln.trim();
    if (t && !/^=+$/.test(t)) return t;
  }
  return "";
}

function parsePriceOf(btext: string): { rank: string | null; price: string } | null {
  const m = btext.match(PRICE_RANK_RE);
  if (m) {
    const pts = parseInt(m[2].replace(/[,,\s]/g, ""), 10) || 0;
    return { rank: m[1], price: `${m[1]}+${pts}` };
  }
  const m2 = btext.match(PRICE_PT_RE);
  if (m2) return { rank: null, price: `${parseInt(m2[1].replace(/[,,\s]/g, ""), 10) || 0}分` };
  return null;
}

function subBlocks(block: string): string[] {
  return block
    .replace(/={5,}/g, "\n\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
}

/** 行内分段:空行 / 阶梯头行 / "名称 价格:X+N" 胶粘行 都会开启新段。 */
function splitSegments(btext: string): string[] {
  const lines = btext.split("\n");
  const segs: string[] = [];
  let cur: string[] = [];
  let started = false;
  for (const ln of lines) {
    const t = ln.trim();
    const isBlank = t === "";
    const isLadder = LADDER_HEAD_RE.test(t);
    const gluedPrice = /^(.{1,16}?)\s+价格[：:]\s*[SABCD]/.test(t);
    if (started && (isBlank || isLadder || gluedPrice)) {
      segs.push(cur.join("\n"));
      cur = isBlank ? [] : [ln];
    } else {
      cur.push(ln);
      started = true;
    }
  }
  if (cur.length) segs.push(cur.join("\n"));
  return segs.map((s) => s.trim()).filter(Boolean);
}

function parseEntryFromBlock(block: string, category: string): ParsedEntry {
  const btext = block.trim();
  const lines = btext.split("\n");
  let name = "";
  for (const ln of lines) {
    const t = ln.trim();
    if (!t || /^=+$/.test(t)) continue;
    name = t.replace(/[：:]\s*$/, "").trim();
    break;
  }
  const selfPrice = parsePriceOf(btext);
  const table = PRICE_TABLE[category] ?? {};
  const natureM = btext.match(/本\s*质[^\n]{0,12}?(自然|科技|魔幻|特异)/);

  // 行内分段识别:阶梯(D级:/C级: 头,价格显式或价表回退)与子技能(含价格的段)
  const segs = splitSegments(btext);
  const ranks: NonNullable<ParsedEntry["ranks"]> = [];
  const subSkills: NonNullable<ParsedEntry["subSkills"]> = [];
  for (const seg of segs) {
    const head = firstLine(seg);
    if (!head) continue;
    const lm = head.match(LADDER_HEAD_RE);
    if (lm) {
      const rank = lm[1];
      const p = parsePriceOf(seg);
      const price = p?.price ?? (table[rank] !== undefined ? `${rank}+${table[rank]}` : null);
      if (price) ranks.push({ rank, price, title: head, text: seg.slice(0, 4000) });
      continue;
    }
    const p = parsePriceOf(seg);
    if (!p || !p.rank) continue;
    if (head.length > 16 || head.startsWith("价格") || head.includes("：") || head.includes(":")) continue;
    subSkills.push({ name: head, rank: p.rank, price: p.price, text: seg.slice(0, 6000) });
  }
  if (ranks.length > 0) {
    // 升序排列(D→S),与内置阶梯展示一致
    ranks.sort((a, b) => IMPORT_RANKS.indexOf(a.rank as MissionRank) - IMPORT_RANKS.indexOf(b.rank as MissionRank));
  }

  // 分级:价格 > 等级标注 > 名称 > 阶梯最高级
  let rank: string | null = null;
  let rankSource: ParsedEntry["rankSource"] = "无";
  if (selfPrice?.rank) {
    rank = selfPrice.rank;
    rankSource = "价格";
  } else {
    const m2 = btext.match(/等级[：:]\s*([SABCD])\s*级/);
    if (m2) {
      rank = m2[1];
      rankSource = "等级标注";
    } else if (NAME_LEVEL_RE.test(name)) {
      rank = name.match(NAME_LEVEL_RE)![1];
      rankSource = "名称";
    } else if (/^\s*([SABCD])\s*级/.test(name)) {
      rank = name.trim().match(/^([SABCD])\s*级/)![1];
      rankSource = "名称";
    } else if (ranks.length > 0) {
      rank = ranks[0].rank;
      rankSource = "阶梯";
    }
  }

  return {
    name,
    rank,
    price: selfPrice?.price ?? null,
    nature: natureM?.[1] ?? null,
    text: btext.replace(/\n{3,}/g, "\n\n").slice(0, 8000),
    ranks: ranks.length > 0 ? ranks : undefined,
    subSkills: subSkills.length > 1 ? subSkills : undefined,
    rankSource,
  };
}

/** 把粘贴的外部资源文本解析为条目并自动分级。
 *  分隔:空行与 ===== 均可;不含价格标记的块并入上一条目(保留长文本),
 *  开头的此类块作为标题并入下一条目;连续等级递增(D→C→B→A→S)的条目
 *  自动合并为一个阶梯资源。 */
export function parseImportedText(raw: string, category: string): ParsedEntry[] {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const norm = text.replace(/={5,}/g, "\n====\n");
  const chunks = norm
    .split(/\n\s*====\s*\n|\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);

  // 分组:含 价格/等级 标记的块开启新条目,其余并入上一条目(开头的并入下一条目)
  const groups: string[][] = [];
  let pending: string[] = [];
  for (const chunk of chunks) {
    if (/^=+$/.test(chunk)) continue;
    const looksLikeEntry = /价格[：:]/.test(chunk) || /等级[：:]/.test(chunk);
    if (looksLikeEntry) {
      if (pending.length) {
        groups.push([...pending, chunk]);
        pending = [];
      } else {
        groups.push([chunk]);
      }
    } else if (groups.length === 0) {
      pending.push(chunk);
    } else {
      groups[groups.length - 1].push(chunk);
    }
  }
  if (pending.length) groups.push(pending);

  const entries: ParsedEntry[] = [];
  for (const g of groups) {
    const parsed = parseEntryFromBlock(g.join("\n\n"), category);
    if (!parsed.name || parsed.name.length > 24) continue;
    if (/^=+$/.test(parsed.name)) continue;
    if (/^(价格|前提|效果|描述|属性)/.test(parsed.name) && parsed.rank === null) continue;
    entries.push(parsed);
  }

  // 阶梯合并:连续条目等级严格递增(D→C→B→A→S)且均无子技能 → 合并为一个阶梯资源
  const merged: ParsedEntry[] = [];
  for (const e of entries) {
    const prev = merged[merged.length - 1];
    if (
      prev && !prev.subSkills && !e.subSkills &&
      prev.rank && e.rank && e.rankSource === "价格" &&
      IMPORT_RANKS.indexOf(e.rank as MissionRank) === IMPORT_RANKS.indexOf(prev.rank as MissionRank) + 1
    ) {
      prev.ranks = [
        ...(prev.ranks ?? [{ rank: prev.rank, price: prev.price ?? "", title: prev.name, text: prev.text }]),
        { rank: e.rank, price: e.price ?? "", title: e.name, text: e.text },
      ];
      prev.rank = e.rank;
      prev.price = e.price ?? prev.price;
      prev.text = `${prev.text}\n\n${e.text}`;
      prev.rankSource = "阶梯";
      continue;
    }
    merged.push(e);
  }
  return merged;
}
