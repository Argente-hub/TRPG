import { useEffect, useState } from "react";
import { useRuleList, loadRuleText, getCachedText, RuleFileMeta } from "../lib/data";

export default function Rules() {
  const files = useRuleList();
  const [current, setCurrent] = useState<RuleFileMeta | null>(null);
  const [text, setText] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!current) return;
    const cached = getCachedText(`rule-${current.file}`);
    if (cached) {
      setText(cached);
      return;
    }
    setText("加载中…");
    void loadRuleText(current.file).then((t) => setText(t ?? "加载失败"));
  }, [current]);

  const filtered = (files ?? []).filter((f) => !search || f.title.includes(search));

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
      <div className="border border-zinc-800 rounded-lg bg-zinc-900/40 overflow-hidden h-fit lg:sticky lg:top-4">
        <div className="p-2 border-b border-zinc-800">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索章节…"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs"
          />
        </div>
        <div className="max-h-[36rem] overflow-y-auto">
          {(files ?? []).length === 0 && <div className="p-3 text-xs text-zinc-600">加载中…</div>}
          {filtered.map((f) => (
            <button
              key={f.file}
              onClick={() => setCurrent(f)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800/70 ${
                current?.file === f.file ? "bg-indigo-900/50 text-indigo-200" : "text-zinc-400"
              }`}
            >
              {f.title}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-zinc-800 rounded-lg bg-zinc-900/40 p-5 min-h-[32rem]">
        {current ? (
          <>
            <h1 className="text-xl font-bold mb-3">{current.title}</h1>
            <RuleText text={text} />
          </>
        ) : (
          <div className="text-zinc-600 py-16 text-center text-sm">
            《无限流TRPG正式版3.25》规则书 · 从左侧选择章节阅读
          </div>
        )}
      </div>
    </div>
  );
}

/** 轻量 Markdown 渲染(标题/分隔线/表格/段落) */
function RuleText({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      out.push(
        <div key={i} className={`font-bold mt-4 mb-1 ${level === 1 ? "text-lg" : level === 2 ? "text-base" : "text-sm"}`}>
          {line.replace(/^#+\s*/, "")}
        </div>,
      );
      i++;
      continue;
    }
    if (/^\|/.test(line)) {
      // 收集表格
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c) || c === "---" || c === "")) rows.push(cells);
        i++;
      }
      out.push(
        <table key={`t${i}`} className="w-full text-xs border-collapse mb-2">
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className={ri === 0 ? "font-bold text-zinc-200" : ""}>
                {r.map((c, ci) => (
                  <td key={ci} className="border border-zinc-800 px-2 py-1">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    if (/^=+$/.test(line.trim())) {
      out.push(<hr key={i} className="border-zinc-700/60 my-2" />);
      i++;
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    out.push(<p key={i} className="text-sm text-zinc-300 leading-relaxed">{line}</p>);
    i++;
  }
  return <div>{out}</div>;
}
