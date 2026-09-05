import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CharacterData,
  emptyCharacter,
  emptyLedger,
  normalizeCharacter,
  LedgerEntry,
  CurrencyUnit,
  RulesVersion,
} from "../engine/character";

interface CharactersState {
  characters: CharacterData[];
  activeId: string | null;
  create: (name: string, rules?: RulesVersion) => CharacterData;
  update: (id: string, patch: Partial<CharacterData> | ((c: CharacterData) => void)) => void;
  remove: (id: string) => void;
  setActive: (id: string | null) => void;
  importJson: (json: string) => boolean;
  addLedger: (id: string, desc: string, deltas: Partial<Record<CurrencyUnit, number>>) => void;
}

export const useCharacters = create<CharactersState>()(
  persist(
    (set) => ({
      characters: [],
      activeId: null,
      create: (name, rules) => {
        const c = emptyCharacter(
          `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name || "无名者",
          rules ?? "3.25",
        );
        set((s) => ({ characters: [...s.characters, c], activeId: c.id }));
        return c;
      },
      update: (id, patch) =>
        set((s) => ({
          characters: s.characters.map((c) => {
            if (c.id !== id) return c;
            if (typeof patch === "function") {
              const copy = structuredClone(c);
              patch(copy);
              return copy;
            }
            return { ...c, ...patch };
          }),
        })),
      remove: (id) =>
        set((s) => ({
          characters: s.characters.filter((c) => c.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      setActive: (id) => set({ activeId: id }),
      importJson: (json) => {
        try {
          const data = JSON.parse(json) as CharacterData | CharacterData[];
          const list = Array.isArray(data) ? data : [data];
          if (!Array.isArray(list) || list.length === 0) return false;
          const valid = list.filter((c) => c && typeof c.id === "string" && c.attributes);
          if (valid.length === 0) return false;
          set((s) => {
            const existing = new Set(s.characters.map((c) => c.id));
            const fresh = valid
              .filter((c) => !existing.has(c.id))
              .map((c) => ({ ...c, ledger: c.ledger ?? emptyLedger() }));
            return { characters: [...s.characters, ...fresh] };
          });
          return true;
        } catch {
          return false;
        }
      },
      addLedger: (id, desc, deltas) =>
        set((s) => ({
          characters: s.characters.map((c) => {
            if (c.id !== id) return c;
            const entry: LedgerEntry = {
              id: `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
              time: Date.now(),
              desc,
              deltas,
            };
            const ledger = structuredClone(c.ledger ?? emptyLedger());
            for (const [k, v] of Object.entries(deltas)) {
              if (!v) continue;
              if (k.startsWith("支线")) {
                const rank = k.slice(2) as "D" | "C" | "B" | "A" | "S";
                ledger.missions[rank] = Math.max(0, (ledger.missions[rank] ?? 0) + v);
              } else if (k === "分数") {
                ledger.points = Math.max(0, ledger.points + v);
              } else if (k === "XP") {
                ledger.xp = Math.max(0, ledger.xp + v);
              }
            }
            ledger.history = [entry, ...ledger.history].slice(0, 200);
            return { ...c, ledger };
          }),
        })),
    }),
    {
      name: "wuxian-characters",
      // 旧存档兼容:补齐新增字段
      merge: (persisted, current) => {
        const p = persisted as Partial<CharactersState> | undefined;
        if (!p?.characters) return current;
        return {
          ...current,
          ...p,
          characters: p.characters.map((c) => normalizeCharacter(c as CharacterData)),
        };
      },
    },
  ),
);

export function useActiveCharacter(): CharacterData | undefined {
  return useCharacters((s) => s.characters.find((c) => c.id === s.activeId));
}
