import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CustomResource {
  id: string;
  name: string;
  category: string;
  rank: string | null;
  price: string | null;
  nature: string | null;
  text: string;
  /** 等级阶梯(自制血统/称号等 D~S 逐级) */
  ranks?: { rank: string; price: string; title: string; text: string }[];
  /** 可单独购买的子技能/物品 */
  subSkills?: { name: string; rank: string | null; price: string | null; text: string }[];
  createdAt: number;
}

interface CustomResourcesState {
  entries: CustomResource[];
  addMany: (list: CustomResource[]) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useCustomResources = create<CustomResourcesState>()(
  persist(
    (set) => ({
      entries: [],
      addMany: (list) =>
        set((s) => {
          const have = new Set(s.entries.map((e) => e.id));
          const fresh = list.filter((e) => !have.has(e.id));
          return { entries: [...s.entries, ...fresh] };
        }),
      remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      clear: () => set({ entries: [] }),
    }),
    { name: "wuxian-custom-resources" },
  ),
);
