"use client";

import { Button, Card, Flex, Image, Select, Typography, theme } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { ExternalLink, Images } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Stagger, StaggerItem } from "@/components/motion";
import { EmptyState, LoadingSkeleton, PageHeader } from "@/components/ui";
import type { Photo } from "@/features/media/domain";
import { useEnsurePhoto, useObjectUrl } from "@/features/media/hooks";
import { useT } from "@/i18n";
import { db } from "@/lib/db";
import { containerHref, photosHref } from "@/lib/navigation/routes";
import { useContainers, useSpaces } from "../hooks";
import { descendantIds } from "../tree";

/**
 * Buscar mirando: todas las fotos de las cajas de la casa, de un lugar o de un mueble (con lo que
 * tiene adentro), en una grilla grande. Se abren en grande y se deslizan; cada una lleva a su caja.
 */
export function PhotosPage() {
  return <RequirePermission perform="inventory.view"><PhotosView /></RequirePermission>;
}

function PhotosView() {
  const t = useT();
  const { token } = theme.useToken();
  const router = useRouter();
  const params = useSearchParams();
  const spaceId = params.get("space") ?? "";
  const containerId = params.get("id") ?? "";
  const spaces = useSpaces();
  const containers = useContainers();
  const photos = useLiveQuery(() => db.photos.where("[ownerType+ownerId]").between(["container", ""], ["container", "￿"]).toArray());

  const scope = (() => {
    if (!containers) return null;
    if (containerId) return new Set([containerId, ...descendantIds(containerId, containers)]);
    if (spaceId) return new Set(containers.filter((container) => container.spaceId === spaceId).map((container) => container.id));
    return new Set(containers.map((container) => container.id));
  })();
  const byId = new Map((containers ?? []).map((container) => [container.id, container]));
  // En el orden de la casa (lugar › mueble › caja), y en cada caja, de la más vieja a la más nueva.
  const order = new Map((containers ?? []).map((container, index) => [container.id, index]));
  const shown = (photos ?? [])
    .filter((photo) => scope?.has(photo.ownerId))
    .sort((a, b) => (order.get(a.ownerId) ?? 0) - (order.get(b.ownerId) ?? 0) || a.createdAt - b.createdAt);

  const value = containerId ? `container:${containerId}` : spaceId ? `space:${spaceId}` : "all";
  const options = [
    { value: "all", label: t("photos.wholeHouse") },
    ...(spaces ?? []).map((space) => ({ value: `space:${space.id}`, label: space.name })),
    ...(containers ?? []).filter((container) => !container.parentId || (containers ?? []).some((child) => child.parentId === container.id))
      .map((container) => ({ value: `container:${container.id}`, label: `${container.spaceName} › ${container.path}` })),
  ];

  return (
    <>
      <PageHeader eyebrow={t("storage.eyebrow")} title={t("photos.title")} description={t("photos.description")}
        extra={
          <Select
            aria-label={t("photos.scope")}
            value={value}
            onChange={(next: string) => {
              const [kind, id] = next.split(":");
              router.replace(photosHref(kind === "space" ? { space: id } : kind === "container" ? { id } : {}));
            }}
            options={options}
            showSearch={{ optionFilterProp: "label" }}
            popupMatchSelectWidth={false}
            style={{ minWidth: 220 }}
          />
        }
      />
      {!photos || !containers ? (
        <LoadingSkeleton />
      ) : shown.length === 0 ? (
        <Card><EmptyState icon={Images} title={t("photos.empty")} description={t("photos.emptyText")} /></Card>
      ) : (
        <>
          <Typography.Paragraph type="secondary">{t("photos.count", { count: shown.length })}</Typography.Paragraph>
          <Image.PreviewGroup>
            <Stagger style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${token.controlHeightLG * 4}px, 1fr))`, gap: token.marginSM }}>
              {shown.map((photo) => {
                const container = byId.get(photo.ownerId);
                return (
                  <StaggerItem key={photo.id}>
                    <PhotoCard photo={photo} title={container?.name ?? ""} place={container ? `${container.spaceName} › ${container.path}` : ""} />
                  </StaggerItem>
                );
              })}
            </Stagger>
          </Image.PreviewGroup>
        </>
      )}
    </>
  );
}

function PhotoCard({ photo, title, place }: { photo: Photo; title: string; place: string }) {
  const t = useT();
  const { token } = theme.useToken();
  useEnsurePhoto(photo, "thumb", "blob");
  const thumb = useObjectUrl(photo.thumb, `${photo.id}:thumb`);
  const full = useObjectUrl(photo.blob, `${photo.id}:blob`);

  return (
    <Card size="small" styles={{ body: { padding: 0 } }} style={{ overflow: "hidden" }}>
      <div style={{ aspectRatio: "1", background: token.colorFillTertiary }}>
        {thumb && <Image src={thumb} preview={{ src: full ?? thumb }} alt={title} width="100%" height="100%" style={{ objectFit: "cover", aspectRatio: "1" }} rootClassName="od-photo-tile" />}
      </div>
      <Flex align="center" justify="space-between" gap={token.marginXXS} style={{ padding: token.paddingXS }}>
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis style={{ display: "block" }}>{title}</Typography.Text>
          <Typography.Text type="secondary" ellipsis style={{ display: "block", fontSize: token.fontSizeSM }}>{place}</Typography.Text>
        </div>
        <Link href={containerHref(photo.ownerId)}><Button type="text" icon={<ExternalLink />} aria-label={t("camera.openContainer", { name: title })} /></Link>
      </Flex>
    </Card>
  );
}
