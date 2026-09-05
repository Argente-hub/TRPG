import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RulebookState {
  versionId: string;
  setVersion: (id: string) => void;
}

/** 全站共享的"当前规则书"选择:规则书阅读器、资料库、侧边栏同步。 */
export const useRulebook = create<RulebookState>()(
  persist(
    (set) => ({
      versionId: "",
      setVersion: (id) => set({ versionId: id }),
    }),
    { name: "wuxian-rules-version" },
  ),
);
