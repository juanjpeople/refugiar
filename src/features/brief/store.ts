import { create } from "zustand";
import { persist } from "zustand/middleware";
import { houseStorageKey } from "@/lib/demo";
import type { NewsBrief, WeatherBrief } from "./domain";

interface BriefState {
  city: string;
  sources: string[];
  muted: string;
  automatic: boolean;
  weather: WeatherBrief | null;
  news: Record<string, NewsBrief>;
  configure: (value: Partial<Pick<BriefState, "city" | "sources" | "muted" | "automatic">>) => void;
  saveWeather: (value: WeatherBrief) => void;
  saveNews: (value: NewsBrief) => void;
  clear: () => void;
}
export const useBriefStore = create<BriefState>()(persist(set => ({
  city: "", sources: [], muted: "", automatic: false, weather: null, news: {},
  configure: value => set(value),
  saveWeather: weather => set({ weather }),
  saveNews: news => set(state => ({ news: { ...state.news, [news.source]: news } })),
  clear: () => set({ weather: null, news: {} }),
}), { name: houseStorageKey("refugiar-brief"), version: 1 }));
