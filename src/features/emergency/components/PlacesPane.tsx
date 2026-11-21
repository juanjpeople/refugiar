"use client";

import { Alert, Button, Checkbox, Flex, Input, Tag, Typography, theme } from "antd";
import { Crosshair, MapPin, Navigation, Phone, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState, IconTile, ListRow, PlaceRadar } from "@/components/ui";
import { useI18n } from "@/i18n";
import { servicePermitted, serviceFetch, useNetworkPolicy } from "@/lib/network/policy";
import { isAndroidApp } from "@/lib/platform";
import {
  PLACE_CATEGORIES,
  PLACE_COLORS,
  bearingDegrees,
  compassPoint,
  distanceMeters,
  mapHref,
  mapLink,
  overpassQuery,
  parseCoordinates,
  parseOverpass,
  roughPosition,
  telHref,
  type EmergencyPlace,
  type FoundPlace,
  type Position,
} from "../domain";
import { useEmergencyActions, type EmergencyData } from "../hooks";
import { usePosition } from "../usePosition";
import { RecordModal, type Field } from "./RecordModal";

const PHONE = /^[+\d][\d\s().-]*$/;

/** "350 m", "1,2 km": la distancia como se dice. */
export function useDistance() {
  const { format } = useI18n();
  return (meters: number) => meters < 1000 ? `${format.number(Math.round(meters / 10) * 10)} m` : `${format.number(Math.round(meters / 100) / 10)} km`;
}

/** El mapa del celular: en Android, la app de mapas (`geo:`); en la web, Google Maps. */
const openMap = (place: Position, label: string) => isAndroidApp() ? mapHref(place, label) : mapLink(place);

export function PlacesPane({ data, editable }: { data: EmergencyData; editable: boolean }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const distance = useDistance();
  const { position, status, locate } = usePosition();
  const { save, savePlaces, remove } = useEmergencyActions();
  useNetworkPolicy((state) => state.places);
  const [search, setSearch] = useState<{ status: "idle" | "searching" | "done" | "failed"; found: FoundPlace[]; chosen: Set<string> }>({ status: "idle", found: [], chosen: new Set() });
  const [editing, setEditing] = useState<EmergencyPlace | "new" | null>(null);
  const [draft, setDraft] = useState<Partial<EmergencyPlace> | null>(null);
  const [pasted, setPasted] = useState("");
  const current = editing && editing !== "new" ? editing : undefined;

  const sorted = position
    ? [...data.places].map((place) => ({ place, meters: distanceMeters(position, place), bearing: bearingDegrees(position, place) })).sort((a, b) => a.meters - b.meters)
    : data.places.map((place) => ({ place, meters: undefined, bearing: undefined }));

  async function searchNearby() {
    const here = position ?? (await locate());
    if (!here) return;
    setSearch({ status: "searching", found: [], chosen: new Set() });
    try {
      const response = await serviceFetch("places", "https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(overpassQuery(roughPosition(here)))}`,
      });
      if (!response.ok) throw new Error("overpass");
      const saved = new Set(data.places.map((place) => `${place.lat.toFixed(4)},${place.lng.toFixed(4)}`));
      const found = parseOverpass(await response.json(), (category) => t(`emergency.places.categories.${category}`))
        .filter((place) => !saved.has(`${place.lat.toFixed(4)},${place.lng.toFixed(4)}`))
        .sort((a, b) => distanceMeters(here, a) - distanceMeters(here, b))
        .slice(0, 40);
      setSearch({ status: "done", found, chosen: new Set(found.filter((place) => place.category !== "fuel").slice(0, 12).map((place) => place.osmId)) });
    } catch {
      setSearch({ status: "failed", found: [], chosen: new Set() });
    }
  }

  async function saveChosen() {
    const chosen = search.found.filter((place) => search.chosen.has(place.osmId));
    const saved = await savePlaces(chosen.map(({ name, category, lat, lng, address, phone }) => ({ name, category, lat, lng, address, phone: phone && PHONE.test(phone) ? phone : undefined })));
    if (saved !== undefined) setSearch({ status: "idle", found: [], chosen: new Set() });
  }

  async function addHere() {
    const here = position ?? (await locate());
    if (here) { setDraft({ lat: here.lat, lng: here.lng, category: "meeting" }); setEditing("new"); }
  }

  const fields: Field[] = [
    { name: "name", label: t("emergency.places.name"), required: true },
    { name: "category", label: t("emergency.places.category"), type: "select", required: true, options: PLACE_CATEGORIES.map((category) => ({ value: category, label: t(`emergency.places.categories.${category}`) })) },
    { name: "lat", label: t("emergency.places.lat"), inputMode: "decimal" },
    { name: "lng", label: t("emergency.places.lng"), inputMode: "decimal" },
    { name: "address", label: t("emergency.places.address") },
    { name: "phone", label: t("emergency.places.phone"), type: "phone" },
    { name: "note", label: t("emergency.places.note"), type: "textarea" },
  ];

  return <Flex vertical gap={token.marginSM} style={{ paddingBlock: token.paddingSM }}>
    <Flex gap="small" wrap>
      <Button size="large" icon={<Crosshair />} loading={status === "locating"} onClick={() => void locate()}>{t("emergency.places.locate")}</Button>
      {editable && <Button size="large" icon={<Search />} loading={search.status === "searching"} disabled={!servicePermitted("places")} onClick={() => void searchNearby()}>{t("emergency.places.search")}</Button>}
    </Flex>
    {status === "failed" && <Alert type="warning" showIcon title={t("emergency.places.noLocation")} />}
    {position?.accuracy !== undefined && <Typography.Text type="secondary">{t("emergency.places.accuracy", { meters: position.accuracy })}</Typography.Text>}
    {editable && !servicePermitted("places") && (
      <Alert type="info" showIcon title={t("emergency.places.permission")} action={<Link href="/ajustes#datos"><Button size="small">{t("emergency.places.openSettings")}</Button></Link>} />
    )}
    {editable && servicePermitted("places") && search.status === "idle" && <Typography.Text type="secondary">{t("emergency.places.searchHint")}</Typography.Text>}

    {search.status === "failed" && <Alert type="error" showIcon title={t("emergency.places.searchFailed")} />}
    {search.status === "done" && (
      <Flex vertical gap={token.marginXS} style={{ padding: token.paddingSM, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
        <Typography.Text strong>{search.found.length ? t("emergency.places.found", { count: search.found.length }) : t("emergency.places.noneFound")}</Typography.Text>
        {search.found.map((place) => (
          <Checkbox
            key={place.osmId}
            checked={search.chosen.has(place.osmId)}
            onChange={(event) => setSearch((state) => {
              const chosen = new Set(state.chosen);
              if (event.target.checked) chosen.add(place.osmId); else chosen.delete(place.osmId);
              return { ...state, chosen };
            })}
          >
            {`${place.name} · ${t(`emergency.places.categories.${place.category}`)}${position ? ` · ${distance(distanceMeters(position, place))}` : ""}`}
          </Checkbox>
        ))}
        <Flex gap="small" wrap>
          {search.chosen.size > 0 && <Button type="primary" onClick={() => void saveChosen()}>{t("emergency.places.saveSelected", { count: search.chosen.size })}</Button>}
          <Button onClick={() => setSearch({ status: "idle", found: [], chosen: new Set() })}>{t("emergency.cancel")}</Button>
        </Flex>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("emergency.places.credit")}</Typography.Text>
      </Flex>
    )}

    {position && data.places.length > 0 && (
      <PlaceRadar
        aria-label={t("emergency.places.radar")}
        centerLabel={t("emergency.places.here")}
        formatDistance={distance}
        points={sorted.map(({ place, meters, bearing }) => ({ id: place.id, label: place.name, color: PLACE_COLORS[place.category], distance: meters ?? 0, bearing: bearing ?? 0 }))}
      />
    )}
    {data.places.length === 0 && <EmptyState icon={MapPin} title={t("emergency.places.empty")} />}
    <div>
      {sorted.map(({ place, meters, bearing }, index) => (
        <ListRow
          key={place.id}
          index={index}
          leading={<IconTile icon={MapPin} color={PLACE_COLORS[place.category]} size={40} />}
          title={place.name}
          wrapTitle
          meta={<>
            <Tag bordered={false} color={PLACE_COLORS[place.category]}>{t(`emergency.places.categories.${place.category}`)}</Tag>
            {meters !== undefined && bearing !== undefined && <Typography.Text strong>{t("emergency.places.away", { distance: distance(meters), direction: t(`emergency.places.compass.${compassPoint(bearing)}`) })}</Typography.Text>}
            {place.address && <span>{place.address}</span>}
          </>}
          trailing={<Flex gap="small">
            {place.phone && <Button size="large" href={telHref(place.phone)} icon={<Phone />} aria-label={t("emergency.calling", { name: place.name })} />}
            <Button size="large" href={openMap(place, place.name)} target={isAndroidApp() ? undefined : "_blank"} rel="noreferrer" icon={<Navigation />} aria-label={t("emergency.openMap")} />
          </Flex>}
          onOpen={editable ? () => { setDraft(null); setEditing(place); } : undefined}
          divider={index < sorted.length - 1}
        />
      ))}
    </div>
    <Typography.Text type="secondary">{t("emergency.places.noMap")}</Typography.Text>
    {editable && <Flex gap="small" wrap>
      <Button icon={<Crosshair />} onClick={() => void addHere()}>{t("emergency.places.addHere")}</Button>
      <Button onClick={() => { setDraft({ category: "hospital" }); setEditing("new"); }}>{t("emergency.places.addManual")}</Button>
    </Flex>}

    {editing && <RecordModal
      open
      title={current ? current.name : t("emergency.places.addManual")}
      fields={fields}
      initial={current ?? draft ?? undefined}
      onClose={() => { setEditing(null); setPasted(""); }}
      extra={!current && <Flex vertical gap={token.marginXXS} style={{ marginBottom: token.margin }}>
        <Typography.Text>{t("emergency.places.paste")}</Typography.Text>
        <Input value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder="-34.6037, -58.3816" />
        <Typography.Text type={pasted && !parseCoordinates(pasted) ? "danger" : "secondary"} style={{ fontSize: token.fontSizeSM }}>
          {pasted && !parseCoordinates(pasted) ? t("emergency.places.pasteInvalid") : t("emergency.places.coordsHint")}
        </Typography.Text>
      </Flex>}
      onSave={async (values) => {
        const coords = !current && pasted ? parseCoordinates(pasted) : null;
        const number = (value: unknown) => value === undefined || value === null || String(value).trim() === "" ? Number.NaN : Number(String(value).replace(",", "."));
        const input = { ...values, lat: coords?.lat ?? number(values.lat), lng: coords?.lng ?? number(values.lng) };
        return Boolean(await save("place", input as never, current?.id));
      }}
      onDelete={current ? async () => (await remove(current.id)) !== undefined : undefined}
    />}
  </Flex>;
}
