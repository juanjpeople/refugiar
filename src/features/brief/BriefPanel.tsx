"use client";
import { Button, Checkbox, Flex, Input, Select, Switch, Typography, theme } from "antd";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/motion";
import { QuietSummary, SettingRow } from "@/components/ui";
import { useI18n } from "@/i18n";
import { API_URL } from "@/lib/cloud/api";
import { DEMO_ENABLED } from "@/lib/demo";
import { serviceFetch, servicePermitted, useNetworkPolicy } from "@/lib/network/policy";
import { normalizeSearch } from "@/lib/search";
import { CITIES, NEWS_SOURCES, type NewsBrief, type WeatherBrief } from "./domain";
import { useBriefStore } from "./store";

export function BriefSettings() {
  const { t } = useI18n();
  const state = useBriefStore();
  return <>
    <SettingRow label={t("brief.city")} description={t("brief.cityHint")}><Select allowClear value={state.city || undefined} placeholder={t("brief.city")} style={{ width: "min(100%, 16rem)" }} options={CITIES.map(city => ({ value: city.id, label: city.name }))} onChange={city => state.configure({ city: city ?? "" })} /></SettingRow>
    <SettingRow label={t("brief.sources")} stacked><Checkbox.Group options={NEWS_SOURCES.map(source => ({ value: source.id, label: source.name }))} value={state.sources} onChange={sources => state.configure({ sources: sources.map(String) })} /></SettingRow>
    <SettingRow label={t("brief.muted")} description={t("brief.mutedHint")} stacked><Input maxLength={200} value={state.muted} onChange={event => state.configure({ muted: event.target.value })} aria-label={t("brief.muted")} /></SettingRow>
    <SettingRow label={t("brief.automatic")} description={t("brief.automaticHint")}><Switch checked={state.automatic} onChange={automatic => state.configure({ automatic })} /></SettingRow>
    <Button onClick={state.clear}>{t("brief.clear")}</Button>
  </>;
}

export function BriefPanel() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const state = useBriefStore();
  const policy = useNetworkPolicy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const active = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);
  const configured = !!state.city || state.sources.length > 0;

  async function refresh() {
    if (active.current || DEMO_ENABLED || document.visibilityState !== "visible") return;
    const controller = new AbortController();
    active.current = controller;
    lastAttempt.current = Date.now();
    setBusy(true); setError(false);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
    const jobs: Promise<void>[] = [];
    const load = async (kind: "weather" | "news", id: string) => {
      const response = await serviceFetch(kind, `${API_URL}/api/brief/${kind}/${encodeURIComponent(id)}`, { signal, headers: { "X-Refugiar-External": "granted" } });
      if (!response.ok) throw new Error("provider-unavailable");
      return response.json();
    };
    if (state.city && servicePermitted("weather") && (state.weather?.city !== state.city || Date.now() - state.weather.at >= 3600_000)) {
      jobs.push(load("weather", state.city).then((value: unknown) => { const data = value as WeatherBrief; if (data.city !== state.city || ![data.at, data.temperature, data.min, data.max].every(Number.isFinite)) throw new Error("invalid-weather"); return data; }).then(data => { if (!signal.aborted && servicePermitted("weather")) state.saveWeather(data); }));
    }
    for (const source of state.sources) if (servicePermitted("news") && (!state.news[source] || Date.now() - state.news[source].at >= 3600_000)) {
      jobs.push(load("news", source).then((value: unknown) => { const data = value as NewsBrief; if (data.source !== source || !Number.isFinite(data.at) || !Array.isArray(data.items)) throw new Error("invalid-news"); return data; }).then(data => { if (!signal.aborted && servicePermitted("news")) state.saveNews(data); }));
    }
    const results = await Promise.allSettled(jobs);
    if (!controller.signal.aborted) { setError(results.some(result => result.status === "rejected")); setBusy(false); }
    if (active.current === controller) active.current = null;
  }
  // Re-read current settings at each visibility event. No background requests or notifications.
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });
  useEffect(() => {
    if (!state.automatic) return;
    const update = () => { if (Date.now() - lastAttempt.current >= 15 * 60_000) void refreshRef.current(); };
    update();
    const timer = setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [state.automatic, state.city, state.sources, policy.weather, policy.news]);
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState !== "visible") { active.current?.abort(); setBusy(false); } };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active.current?.abort(); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  if (!configured) return null;
  const weather = state.weather?.city === state.city ? state.weather : null;
  const muted = state.muted.split(",").map(normalizeSearch).filter(Boolean);
  const seen = new Set<string>();
  const news = state.sources.flatMap(source => (state.news[source]?.items ?? []).map(item => ({ ...item, source }))).filter(item => {
    const key = normalizeSearch(item.title);
    if (seen.has(key) || muted.some(term => key.includes(term))) return false;
    seen.add(key); return true;
  }).slice(0, 6);
  return <Reveal><QuietSummary title={t("brief.title")} busy={busy} status={t(error ? "brief.error" : "brief.hint")} onRefresh={!DEMO_ENABLED && ((state.city && policy.weather) || (state.sources.length > 0 && policy.news)) ? refresh : undefined}>
    {state.city && <>
      <Typography.Text strong>{CITIES.find(city => city.id === state.city)?.name}</Typography.Text>
      <Typography.Text>{weather ? t("brief.forecast", { temperature: Math.round(weather.temperature), min: Math.round(weather.min), max: Math.round(weather.max) }) : t("brief.noWeather")}</Typography.Text>
      {weather && <Typography.Text type="secondary">{t("brief.savedAt", { date: format.date(weather.at, { dateStyle: "short", timeStyle: "short" }) })}</Typography.Text>}
      {!policy.weather && <Typography.Text type="secondary">{t("connections.blocked")}</Typography.Text>}
      <Typography.Link href="https://api.met.no/doc/License" target="_blank" rel="noopener noreferrer">{t("brief.weatherCredit")}</Typography.Link>
    </>}
    {news.map(item => <Flex vertical key={item.url} gap={token.marginXXS}>
      <Typography.Link href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</Typography.Link>
      <Typography.Text type="secondary">{NEWS_SOURCES.find(source => source.id === item.source)?.name}{item.published ? ` · ${format.date(new Date(item.published), { dateStyle: "short" })}` : ""}</Typography.Text>
    </Flex>)}
    {state.sources.length > 0 && <>
      <Typography.Text type="secondary">{t(news.length ? "brief.end" : "brief.noNews")}</Typography.Text>
      {state.sources.map(source => <Typography.Text type="secondary" key={source}>{NEWS_SOURCES.find(item => item.id === source)?.name} · {state.news[source] ? t("brief.savedAt", { date: format.date(state.news[source].at, { dateStyle: "short", timeStyle: "short" }) }) : t("brief.noNews")}</Typography.Text>)}
      {!policy.news && <Typography.Text type="secondary">{t("connections.blocked")}</Typography.Text>}
    </>}
  </QuietSummary></Reveal>;
}
