"use client";

import { App, Flex, Input, Modal, Select, Typography, theme } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { Mic } from "lucide-react";
import { useMemo, useState } from "react";
import { ChoiceCards, type ChoiceOption } from "@/components/ui";
import { useInventoryActions } from "@/features/inventory/hooks";
import { useT } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { db } from "@/lib/db";
import { CONTENT_LIMITS } from "../domain";
import { useContainers, useStorageActions } from "../hooks";
import { rankPlaces, sameName, splitQuickNote } from "../quick-note";

type Mode = "move" | "item" | "note";

/**
 * Anotar rápido: "cinta aisladora en el cajón del medio del lavadero" y listo. La app separa qué y
 * dónde, propone el mueble que mejor coincide y, si esa cosa ya estaba en otro lado, ofrece moverla.
 * Se puede dictar con el micrófono del teclado del celular: la frase llega como texto.
 */
export function QuickNoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const containers = useContainers();
  const items = useLiveQuery(() => db.inventory.toArray());
  const canItem = usePermission("inventory.create");
  const canNote = usePermission("storage.manage");
  const { create, update } = useInventoryActions();
  const { addContents } = useStorageActions();
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [saving, setSaving] = useState(false);

  const parts = splitQuickNote(text);
  const ranked = useMemo(() => rankPlaces(parts.place, containers ?? []), [parts.place, containers]);
  const containerId = chosen ?? ranked[0]?.id ?? null;
  const target = containers?.find((container) => container.id === containerId);
  const existing = items?.find((item) => sameName(item.name, parts.what) && item.containerId !== containerId);
  const from = existing && containers?.find((container) => container.id === existing.containerId);
  const modes: ChoiceOption<Mode>[] = [
    ...(existing && canItem ? [{ value: "move" as const, title: t("quickNote.move"), description: from ? t("quickNote.moveFrom", { place: `${from.spaceName} › ${from.path}` }) : undefined }] : []),
    ...(canItem ? [{ value: "item" as const, title: t("quickNote.item"), description: t("quickNote.itemHint") }] : []),
    ...(canNote ? [{ value: "note" as const, title: t("quickNote.note"), description: t("quickNote.noteHint") }] : []),
  ];
  const selected = modes.find((option) => option.value === mode)?.value ?? modes[0]?.value;

  // Al cerrar se limpia: la próxima vez arranca vacío.
  const reset = () => { setText(""); setChosen(null); setMode(null); };

  async function save() {
    if (!parts.what || !containerId || !selected) return;
    if (parts.what.length > CONTENT_LIMITS.textMaxLength) return void message.error(t("errors.validation.contentTooLong", { max: CONTENT_LIMITS.textMaxLength }));
    setSaving(true);
    const ok = selected === "move" && existing
      ? await update(existing.id, { containerId })
      : selected === "item"
        ? await create(containerId, { name: parts.what, quantity: 1, unit: "unidades", minThreshold: 0, autoSuggest: false })
        : !!(await addContents(containerId, parts.what));
    setSaving(false);
    if (ok) {
      if (selected === "note") message.success(t("quickNote.saved", { place: target?.name ?? "" }));
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      title={t("quickNote.title")}
      onCancel={onClose}
      afterOpenChange={(visible) => { if (!visible) reset(); }}
      okText={t("quickNote.save")}
      cancelText={t("common.cancel")}
      okButtonProps={{ disabled: !parts.what || !containerId || !selected }}
      confirmLoading={saving}
      onOk={() => void save()}
      destroyOnHidden
    >
      <Flex vertical gap={token.margin}>
        <Flex vertical gap={token.marginXXS}>
          <Input.TextArea
            aria-label={t("quickNote.label")}
            autoFocus
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={CONTENT_LIMITS.textMaxLength + 120}
            placeholder={t("quickNote.placeholder")}
            value={text}
            onChange={(event) => { setText(event.target.value); setChosen(null); }}
          />
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            <Mic aria-hidden style={{ verticalAlign: "-0.125em" }} /> {t("quickNote.voice")}
          </Typography.Text>
        </Flex>

        {parts.what && (
          <Flex vertical gap={token.marginSM}>
            <div>
              <Typography.Text type="secondary">{t("quickNote.what")}</Typography.Text>
              <Typography.Title level={5} style={{ margin: 0 }}>{parts.what}</Typography.Title>
            </div>
            <Flex vertical gap={token.marginXXS}>
              <Typography.Text type="secondary">{t("quickNote.where")}</Typography.Text>
              <Select
                aria-label={t("quickNote.where")}
                showSearch={{ optionFilterProp: "label" }}
                placeholder={t("quickNote.wherePlaceholder")}
                value={containerId}
                onChange={setChosen}
                options={[
                  ...(ranked.length ? [{ label: t("quickNote.suggested"), options: ranked.slice(0, 3).map((container) => ({ value: container.id, label: `${container.spaceName} › ${container.path}` })) }] : []),
                  { label: t("quickNote.all"), options: (containers ?? []).filter((container) => !ranked.slice(0, 3).includes(container)).map((container) => ({ value: container.id, label: `${container.spaceName} › ${container.path}` })) },
                ]}
              />
              {parts.place && !ranked.length && <Typography.Text type="secondary">{t("quickNote.noMatch", { place: parts.place })}</Typography.Text>}
            </Flex>
            {modes.length > 1 && <ChoiceCards<Mode> aria-label={t("quickNote.how")} layout="list" compact options={modes} value={selected ?? modes[0].value} onChange={setMode} />}
          </Flex>
        )}
      </Flex>
    </Modal>
  );
}
