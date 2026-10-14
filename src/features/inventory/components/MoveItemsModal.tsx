"use client";

import { Button, Checkbox, Flex, Form, Modal, Select, Typography, theme } from "antd";
import { ScanLine } from "lucide-react";
import { useState } from "react";
import { ScanContainerModal } from "@/features/storage/components/ScanContainerModal";
import { useContainers } from "@/features/storage/hooks";
import { useT } from "@/i18n";
import { useInventoryActions, useInventoryItems } from "../hooks";

/**
 * Pasar cosas de un contenedor a otro: se marcan las que se mueven y se elige el destino de la
 * lista o escaneando su etiqueta. Queda en el historial; se puede volver a mover cuando quieras.
 */
export function MoveItemsModal({ containerId, open, onClose }: { containerId: string; open: boolean; onClose: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const items = useInventoryItems(containerId);
  const containers = useContainers();
  const { move } = useInventoryActions();
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Destinos agrupados por recinto (sin el contenedor de origen).
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const candidate of containers ?? []) {
    if (candidate.id === containerId) continue;
    groups.set(candidate.spaceName, [...(groups.get(candidate.spaceName) ?? []), { value: candidate.id, label: candidate.path }]);
  }
  const all = (items ?? []).map((item) => item.id);

  async function submit() {
    if (!target || selected.length === 0) return;
    setSaving(true);
    const ok = await move(selected, target);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        title={t("inventory.move.title")}
        onOk={submit}
        okText={t("inventory.move.submit", { count: selected.length })}
        okButtonProps={{ disabled: !target || selected.length === 0 }}
        confirmLoading={saving}
        width={520}
        destroyOnHidden
        afterOpenChange={(visible) => { if (!visible) { setSelected([]); setTarget(null); } }}
      >
        <Form layout="vertical" disabled={saving}>
          <Form.Item label={t("inventory.move.what")} extra={t("inventory.move.whatHelp")}>
            <Flex vertical gap={token.marginXXS}>
              <Checkbox
                checked={all.length > 0 && selected.length === all.length}
                indeterminate={selected.length > 0 && selected.length < all.length}
                onChange={(event) => setSelected(event.target.checked ? all : [])}
              >
                <Typography.Text strong>{t("inventory.move.all", { count: all.length })}</Typography.Text>
              </Checkbox>
              <Flex vertical gap={token.marginXXS} style={{ maxHeight: 240, overflowY: "auto", paddingInlineStart: token.paddingSM }}>
                <Checkbox.Group value={selected} onChange={setSelected} style={{ display: "flex", flexDirection: "column", gap: token.marginXXS }}
                  options={(items ?? []).map((item) => ({ value: item.id, label: item.name }))} />
              </Flex>
            </Flex>
          </Form.Item>
          <Form.Item label={t("inventory.move.to")} extra={t("inventory.move.toHelp")}>
            <Flex gap={token.marginXS} wrap>
              <Select
                aria-label={t("inventory.move.to")}
                placeholder={t("inventory.item.moveTo")}
                value={target}
                showSearch={{ optionFilterProp: "label" }}
                options={[...groups].map(([label, options]) => ({ label, options }))}
                onChange={setTarget}
                style={{ flex: "1 1 220px", minWidth: 0 }}
              />
              <Button icon={<ScanLine />} onClick={() => setScanning(true)}>{t("inventory.move.scan")}</Button>
            </Flex>
          </Form.Item>
        </Form>
      </Modal>
      <ScanContainerModal
        open={scanning}
        title={t("inventory.move.scanTitle")}
        onClose={() => setScanning(false)}
        onFound={(container) => {
          setScanning(false);
          if (container.id !== containerId) setTarget(container.id);
        }}
      />
    </>
  );
}
