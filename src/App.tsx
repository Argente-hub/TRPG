import { NavLink, Outlet, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Builder from "./pages/Builder";
import CharacterSheet from "./pages/CharacterSheet";
import Dice from "./pages/Dice";
import Combat from "./pages/Combat";
import Realm from "./pages/Realm";
import Codex from "./pages/Codex";
import Rules from "./pages/Rules";
import { useRulebookVersion, useRuleVersions } from "./lib/data";
import { rulesOf } from "./engine/rules";

const NAV = [
  { to: "/", label: "首页", icon: "🏠" },
  { to: "/builder", label: "建卡向导", icon: "📝" },
  { to: "/character", label: "角色卡", icon: "🧝" },
  { to: "/dice", label: "骰子", icon: "🎲" },
  { to: "/combat", label: "战斗追踪", icon: "⚔️" },
  { to: "/realm", label: "轮回之境", icon: "🌀" },
  { to: "/codex", label: "资料库", icon: "📚" },
  { to: "/rules", label: "规则书", icon: "📖" },
];

export default function App() {
  const versions = useRuleVersions();
  const [versionId] = useRulebookVersion();
  const versionLabel = versions.find((v) => v.id === versionId)?.label;
  const realm = rulesOf(versionId).terms.realm;

  return (
    <div className="flex h-full">
      <aside className="w-44 shrink-0 border-r border-zinc-800 bg-zinc-900/60 flex flex-col">
        <div className="px-4 py-5 border-b border-zinc-800">
          <div className="text-lg font-bold tracking-wide">无限流 TRPG</div>
          <div className="text-xs text-zinc-500 mt-0.5">跑团工具站</div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`
              }
            >
              <span className="text-base">{n.icon}</span>
              {n.to === "/realm" ? realm : n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 text-[11px] text-zinc-600 leading-relaxed">
          当前规则书:{versionLabel ?? "…"}
          <br />
          建卡/战斗引擎按 3.25 版实现
          <br />
          规则疑问以 ST 裁定为准
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/character/:id" element={<CharacterSheet />} />
          <Route path="/character" element={<CharacterSheet />} />
          <Route path="/dice" element={<Dice />} />
          <Route path="/combat" element={<Combat />} />
          <Route path="/realm" element={<Realm />} />
          <Route path="/codex" element={<Codex />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}
