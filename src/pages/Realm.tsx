import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCharacters } from "../store/characters";
import { useActiveCharacter } from "../store/characters";
import {
  convertMissionsUp,
  convertMissionsDown,
  missionReward,
  baseXp,
  bonusXp,
  MISSION_RANKS,
  MissionRank,
} from "../engine/economy";
import { rulesOf } from "../engine/rules";
import { CurrencyUnit } from "../engine/character";

export default function Realm() {
  const nav = useNavigate();
  const { addLedger } = useCharacters();
  const ch = useActiveCharacter();
  const [missionNo, setMissionNo] = useState(1);
  const [bonusDesc, setBonusDesc] = useState("");
  const [dD, setDD] = useState(0);
  const [dC, setDC] = useState(0);
  const [dB, setDB] = useState(0);
  const [dA, setDA] = useState(0);
  const [dS, setDS] = useState(0);
  const [dPoints, setDPoints] = useState(0);
  const [dXp, setDXp] = useState(0);

  if (!ch) {
    return (
      <div className="p-8 text-zinc-500">
        请先在首页选择/创建角色。
        <button className="text-indigo-400 mx-1" onClick={() => nav("/")}>去首页</button>
      </div>
    );
  }
  const ledger = ch.ledger ?? { missions: { D: 0, C: 0, B: 0, A: 0, S: 0 }, points: 0, xp: 0, history: [] };

  const grantReward = () => {
    const r = missionReward(missionNo);
    const deltas: Partial<Record<CurrencyUnit, number>> = {};
    for (const [rank, n] of Object.entries(r.missions)) {
      if (n) deltas[`支线${rank}` as CurrencyUnit] = n;
    }
    deltas["分数"] = r.points;
    deltas["XP"] = baseXp(missionNo);
    addLedger(ch.id, `通关奖励:${r.desc}`, deltas);
  };

  const grantCustom = () => {
    const deltas: Partial<Record<CurrencyUnit, number>> = {};
    if (dD) deltas["支线D"] = dD;
    if (dC) deltas["支线C"] = dC;
    if (dB) deltas["支线B"] = dB;
    if (dA) deltas["支线A"] = dA;
    if (dS) deltas["支线S"] = dS;
    if (dPoints) deltas["分数"] = dPoints;
    if (dXp) deltas["XP"] = dXp;
    addLedger(ch.id, bonusDesc || "自定义发放/消耗", deltas);
    setBonusDesc("");
  };

  const doConvert = (rank: MissionRank, up: boolean) => {
    const out = up ? convertMissionsUp(ledger.missions, rank) : convertMissionsDown(ledger.missions, rank);
    if (!out) return;
    const before = JSON.stringify(ledger.missions);
    const after = out;
    // 直接用 addLedger 记录差值
    const deltas: Partial<Record<CurrencyUnit, number>> = {};
    for (const r of MISSION_RANKS) {
      const diff = (after[r] ?? 0) - (ledger.missions[r] ?? 0);
      if (diff) deltas[`支线${r}` as CurrencyUnit] = diff;
    }
    void before;
    addLedger(ch.id, `${up ? "合成" : "拆分"}支线`, deltas);
  };

  const rewardPreview = missionReward(missionNo);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold">{rulesOf(ch.rules).terms.realm} · {ch.name}</h1>
        <p className="text-xs text-zinc-500 mt-1">支线奖励、分数与经验的账本。交易、兑换与复活等操作请记录在此。</p>
      </div>

      {/* 资产总览 */}
      <div className="grid grid-cols-6 gap-2">
        {MISSION_RANKS.map((r) => (
          <div key={r} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 text-center">
            <div className="text-xs text-zinc-500">{r}级支线</div>
            <div className="text-2xl font-bold text-indigo-300">{ledger.missions[r] ?? 0}</div>
            <div className="flex justify-center gap-1 mt-1">
              <button
                disabled={(ledger.missions[r] ?? 0) < 3 || r === "S"}
                onClick={() => doConvert(r, true)}
                className="text-[10px] px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30"
                title="3个合成1个高一级"
              >↑合</button>
              <button
                disabled={(ledger.missions[r] ?? 0) < 1 || r === "D"}
                onClick={() => doConvert(r, false)}
                className="text-[10px] px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30"
                title="拆成3个低一级"
              >↓拆</button>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-zinc-400">奖励点数</span>
          <span className="text-2xl font-bold text-amber-300">{ledger.points} 分</span>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-zinc-400">经验</span>
          <span className="text-2xl font-bold text-emerald-300">{ledger.xp} XP</span>
        </div>
      </div>

      {/* 发放 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
          <h3 className="font-bold text-sm mb-2">固定通关奖励</h3>
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="text-xs text-zinc-400">第</span>
            <input type="number" min={1} value={missionNo} onChange={(e) => setMissionNo(Math.max(1, Number(e.target.value)))} className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
            <span className="text-xs text-zinc-400">场</span>
            <span className="text-xs text-indigo-300">{rewardPreview.desc}(基础 {baseXp(missionNo)}XP)</span>
          </div>
          <button onClick={grantReward} className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-bold">发放</button>
          <div className="text-[11px] text-zinc-600 mt-2">
            团战奖励另行发放。奖励经验 =(总D×3 + 总分数/500×2)/PC数,可用下方自定义发放。
          </div>
          {(() => {
            const totalD = MISSION_RANKS.reduce((s, r) => s + (ledger.missions[r] ?? 0) * Math.pow(3, MISSION_RANKS.indexOf(r)), 0);
            void totalD;
            return null;
          })()}
        </div>

        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
          <h3 className="font-bold text-sm mb-2">自定义发放/消耗(负数为消耗)</h3>
          <input value={bonusDesc} onChange={(e) => setBonusDesc(e.target.value)} placeholder="说明,如:支线剧情奖励 / 购买血统·XX" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm mb-2" />
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {([["支线D", dD, setDD], ["支线C", dC, setDC], ["支线B", dB, setDB], ["支线A", dA, setDA], ["支线S", dS, setDS]] as const).map(([label, val, set]) => (
              <label key={label} className="text-[11px] text-zinc-500">
                {label.slice(2)}
                <input type="number" value={val} onChange={(e) => set(Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-sm" />
              </label>
            ))}
            <label className="text-[11px] text-zinc-500">
              分数
              <input type="number" value={dPoints} onChange={(e) => setDPoints(Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-sm" />
            </label>
            <label className="text-[11px] text-zinc-500">
              XP
              <input type="number" value={dXp} onChange={(e) => setDXp(Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-sm" />
            </label>
          </div>
          <button onClick={grantCustom} className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm">记录</button>
          <div className="text-[11px] text-zinc-600 mt-2">
            参考:奖励经验 =(总D×3 + 总分数/500×2)/PC数。
          </div>
        </div>
      </div>

      {/* 历史 */}
      <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
        <h3 className="font-bold text-sm mb-2">流水({ledger.history.length})</h3>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {ledger.history.map((h) => (
            <div key={h.id} className="flex justify-between items-center text-xs bg-zinc-900/70 rounded px-2.5 py-1.5">
              <span className="text-zinc-300">{h.desc}</span>
              <span className="flex gap-2">
                {Object.entries(h.deltas).map(([k, v]) => (
                  <span key={k} className={(v ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}>
                    {k}{(v ?? 0) > 0 ? "+" : ""}{v}
                  </span>
                ))}
                <span className="text-zinc-600">{new Date(h.time).toLocaleString()}</span>
              </span>
            </div>
          ))}
          {ledger.history.length === 0 && <div className="text-zinc-600 text-xs">暂无流水</div>}
        </div>
      </div>
    </div>
  );
}

void bonusXp;
