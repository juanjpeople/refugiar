"use client";

import { Button, Flex, Modal, Typography, theme } from "antd";
import { Crosshair, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { PhotoSpot, type SpotPoint } from "@/components/ui";
import type { Photo } from "@/features/media/domain";
import { useEnsurePhoto, useObjectUrl, usePhoto } from "@/features/media/hooks";
import { useT } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { db } from "@/lib/db";
import type { InventoryItem, PhotoSpot as Spot } from "../domain";
import { useInventoryActions } from "../hooks";

/** Fotos del mueble de la cosa y de los que lo contienen (la alacena entera sirve para un frasco de adentro). */
function useSpotPhotos(containerIds: string[]) {
  return useLiveQuery(
    async () => (await db.photos.where("[ownerType+ownerId]").anyOf(containerIds.map((id) => ["container", id])).sortBy("createdAt")),
    [containerIds.join(",")],
  );
}

/**
 * Dónde está, en la foto: un punto que late sobre la foto del mueble. Quien puede editar lo marca
 * tocando la foto; al mover la cosa a otro lado, el punto se borra solo.
 */
export function ItemSpot({ item, containerIds }: { item: InventoryItem; containerIds: string[] }) {
  const t = useT();
  const { token } = theme.useToken();
  const canEdit = usePermission("inventory.create");
  const { update } = useInventoryActions();
  const photos = useSpotPhotos(containerIds);
  const [picking, setPicking] = useState(false);
  const blob = usePhoto(item.spot?.photoId, "blob");
  const url = useObjectUrl(blob, `${item.spot?.photoId}:blob`);

  if (!photos) return null;
  const spotPhotoExists = !!item.spot && photos.some((photo) => photo.id === item.spot?.photoId);

  return (
    <Flex vertical gap={token.marginXS}>
      {item.spot && spotPhotoExists && (
        <PhotoSpot src={url} alt={t("inventory.spot.alt", { name: item.name })} point={item.spot} />
      )}
      {canEdit && (
        photos.length ? (
          <Flex gap={token.marginXS} wrap>
            <Button icon={<Crosshair />} onClick={() => setPicking(true)}>
              {item.spot && spotPhotoExists ? t("inventory.spot.change") : t("inventory.spot.mark")}
            </Button>
            {item.spot && <Button type="text" icon={<X />} onClick={() => void update(item.id, { spot: null })}>{t("inventory.spot.clear")}</Button>}
          </Flex>
        ) : (
          <Typography.Text type="secondary">{t("inventory.spot.noPhotos")}</Typography.Text>
        )
      )}
      <SpotPicker
        open={picking}
        item={item}
        photos={photos}
        onClose={() => setPicking(false)}
        onSave={async (spot) => {
          if (await update(item.id, { spot })) setPicking(false);
        }}
      />
    </Flex>
  );
}

function SpotPicker({ open, item, photos, onClose, onSave }: { open: boolean; item: InventoryItem; photos: Photo[]; onClose: () => void; onSave: (spot: Spot) => Promise<void> }) {
  const t = useT();
  const { token } = theme.useToken();
  const [photoId, setPhotoId] = useState<string | null>(item.spot?.photoId ?? null);
  const [point, setPoint] = useState<SpotPoint | null>(item.spot ? { x: item.spot.x, y: item.spot.y } : null);
  const [saving, setSaving] = useState(false);
  const chosen = photos.find((photo) => photo.id === photoId) ?? photos[0];

  return (
    <Modal
      open={open}
      title={t("inventory.spot.title", { name: item.name })}
      onCancel={onClose}
      okText={t("inventory.spot.save")}
      cancelText={t("common.cancel")}
      okButtonProps={{ disabled: !point || !chosen }}
      confirmLoading={saving}
      onOk={async () => {
        if (!point || !chosen) return;
        setSaving(true);
        await onSave({ photoId: chosen.id, ...point });
        setSaving(false);
      }}
      destroyOnHidden
    >
      <Flex vertical gap={token.margin}>
        <Typography.Text type="secondary">{t("inventory.spot.hint")}</Typography.Text>
        {photos.length > 1 && (
          <Flex gap={token.marginXS} wrap role="group" aria-label={t("inventory.spot.photos")}>
            {photos.map((photo, index) => (
              <Thumb key={photo.id} photo={photo} label={t("inventory.spot.photo", { n: index + 1 })} selected={photo.id === chosen?.id} onSelect={() => { setPhotoId(photo.id); setPoint(null); }} />
            ))}
          </Flex>
        )}
        {chosen && <FullPhoto photo={chosen} name={item.name} point={point} onPick={setPoint} />}
      </Flex>
    </Modal>
  );
}

function FullPhoto({ photo, name, point, onPick }: { photo: Photo; name: string; point: SpotPoint | null; onPick: (point: SpotPoint) => void }) {
  const t = useT();
  useEnsurePhoto(photo, "blob");
  const url = useObjectUrl(photo.blob, `${photo.id}:blob`);
  return <PhotoSpot src={url} alt={t("inventory.spot.alt", { name })} point={point} onPick={onPick} pickLabel={t("inventory.spot.pick", { name })} />;
}

function Thumb({ photo, label, selected, onSelect }: { photo: Photo; label: string; selected: boolean; onSelect: () => void }) {
  const { token } = theme.useToken();
  useEnsurePhoto(photo, "thumb");
  const url = useObjectUrl(photo.thumb, `${photo.id}:thumb`);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
      className="od-focusable"
      style={{
        width: token.controlHeightLG * 1.5,
        height: token.controlHeightLG * 1.5,
        padding: 0,
        borderRadius: token.borderRadius,
        overflow: "hidden",
        cursor: "pointer",
        border: `${token.lineWidthBold}px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
        background: token.colorFillTertiary,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Blob local (IndexedDB): next/image no aplica. */}
      {url && <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
    </button>
  );
}
