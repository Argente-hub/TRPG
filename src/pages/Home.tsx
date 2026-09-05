import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCharacters } from "../store/characters";
import { deriveStats } from "../engine/character";
import { useRulebookVersion } from "../lib/data";
import { rulesOf } from "../engine/rules";

export default function Home() {
  const nav = useNavigate();
  const { characters, create, remove, setActive, importJson } = useCharacters();
  const [versionId] = useRulebookVersion();
  const realm = rulesOf(versionId).terms.realm;
  const [name, setName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    // 新角色按当前规则书版本建卡
    const c = create(name.trim() || "新角色", versionId === "rm" ? "rm" : "3.25");
    setName("");
    nav(`/builder?id=${c.id}`);
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(characters, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `无限流角色卡_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImport = async (f: File) => {
    const text = await f.text();
    if (importJson(text)) alert("导入成功");
    else alert("导入失败:文件格式不正确");
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{realm} · 角色管理</h1>
        <p className="text-zinc-500 text-sm mt-1">
          创建角色卡、开始建卡向导,或在跑团时管理你的角色。数据保存在浏览器本地,可导出 JSON 备份。
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="角色名…"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleCreate}
          className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
        >
          + 创建角色
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm"
        >
          导入
        </button>
        <button
          onClick={exportAll}
          disabled={characters.length === 0}
          className="px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm disabled:opacity-40"
        >
          导出全部
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
        />
      </div>

      {characters.length === 0 ? (
        <div className="border border-dashed border-zinc-700 rounded-lg p-10 text-center text-zinc-500">
          还没有角色。创建一个,或者先去看看
          <button className="text-indigo-400 mx-1" onClick={() => nav("/rules")}>
            规则书
          </button>
          。
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {characters.map((c) => {
            const d = deriveStats(c);
            return (
              <div
                key={c.id}
                className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50 hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-lg">
                      {c.name}
                      <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded align-middle ${c.rules === "rm" ? "bg-fuchsia-900/60 text-fuchsia-200" : "bg-zinc-800 text-zinc-400"}`}>
                        {c.rules === "rm" ? "RM版" : "3.25"}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">{c.concept || "暂无概念"}</div>
                  </div>
                  <button
                    onClick={() => confirm(`确定删除角色「${c.name}」?`) && remove(c.id)}
                    className="text-zinc-600 hover:text-red-400 text-sm"
                  >
                    删除
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3 text-center text-xs">
                  <div className="bg-zinc-800/60 rounded p-1.5">
                    <div className="text-zinc-500">生命</div>
                    <div className="font-bold">{d.hp}</div>
                  </div>
                  <div className="bg-zinc-800/60 rounded p-1.5">
                    <div className="text-zinc-500">意志</div>
                    <div className="font-bold">{d.willpowerMax}</div>
                  </div>
                  <div className="bg-zinc-800/60 rounded p-1.5">
                    <div className="text-zinc-500">防御</div>
                    <div className="font-bold">{d.baseDefense}</div>
                  </div>
                  <div className="bg-zinc-800/60 rounded p-1.5">
                    <div className="text-zinc-500">先攻</div>
                    <div className="font-bold">{d.initiative}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      setActive(c.id);
                      nav(`/builder?id=${c.id}`);
                    }}
                    className="flex-1 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs"
                  >
                    建卡向导
                  </button>
                  <button
                    onClick={() => {
                      setActive(c.id);
                      nav(`/character/${c.id}`);
                    }}
                    className="flex-1 py-1.5 rounded bg-indigo-600/80 hover:bg-indigo-500 text-xs"
                  >
                    角色卡
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
