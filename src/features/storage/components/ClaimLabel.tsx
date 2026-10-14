"use client";

import { Button, Flex, Form, Input, Segmented, Select, TreeSelect, Typography, theme } from "antd";
import { Link2, Plus } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n";
import { normalizeContainerCode, STORAGE_LIMITS } from "../domain";
import { useContainers, useStorageActions } from "../hooks";
import { useLocationTree, type LocationValue } from "./StorageForms";

/**
 * Una etiqueta impresa en blanco que se escanea por primera vez: crear la caja acá mismo (solo el
 * nombre y dónde está) o pegarla a una caja que ya existe. `onDone` recibe el id de la caja.
 */
export function ClaimLabel({ code, defaultLocation, onDone }: { code: string; defaultLocation?: LocationValue; onDone: (containerId: string) => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const containers = useContainers();
  const treeData = useLocationTree();
  const { createContainer, assignLabel } = useStorageActions();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const [location, setLocation] = useState<LocationValue | undefined>(defaultLocation);
  const [existing, setExisting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const label = normalizeContainerCode(code);
  const place = location ?? (treeData[0]?.value as LocationValue | undefined);

  async function submit() {
    setSaving(true);
    if (mode === "existing") {
      if (existing && (await assignLabel(existing, label))) onDone(existing);
    } else if (place && name.trim()) {
      const [type, id] = place.split(":") as ["space" | "container", string];
      const parent = type === "container" ? containers?.find((candidate) => candidate.id === id) : undefined;
      const created = await createContainer({ name, kind: "box", spaceId: parent?.spaceId ?? id, parentId: parent?.id }, label);
      if (created) onDone(created);
    }
    setSaving(false);
  }

  return (
    <Form layout="vertical" disabled={saving} onFinish={submit}>
      <Typography.Paragraph type="secondary">{t("labels.claim.text", { code: label })}</Typography.Paragraph>
      <Form.Item>
        <Segmented<"new" | "existing">
          block
          value={mode}
          onChange={setMode}
          options={[
            { value: "new", label: t("labels.claim.new"), icon: <Plus /> },
            { value: "existing", label: t("labels.claim.existing"), icon: <Link2 /> },
          ]}
        />
      </Form.Item>
      {mode === "new" ? (
        <>
          <Form.Item label={t("labels.claim.name")} extra={t("labels.claim.nameHelp")}>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={STORAGE_LIMITS.nameMaxLength} placeholder={t("storage.bulk.namesPlaceholder").split("\n")[0]} autoFocus />
          </Form.Item>
          <Form.Item label={t("storage.fields.location")}>
            <TreeSelect<LocationValue> value={place} onChange={setLocation} treeData={treeData} treeDefaultExpandAll showSearch={{ treeNodeFilterProp: "title" }} />
          </Form.Item>
        </>
      ) : (
        <Form.Item label={t("labels.claim.which")} extra={t("labels.claim.existingHelp")}>
          <Select
            value={existing}
            onChange={setExisting}
            showSearch={{ optionFilterProp: "label" }}
            placeholder={t("labels.claim.which")}
            options={(containers ?? []).map((container) => ({ value: container.id, label: `${container.spaceName} › ${container.path}` }))}
          />
        </Form.Item>
      )}
      <Flex justify="flex-end" gap={token.marginXS}>
        <Button type="primary" htmlType="submit" loading={saving} disabled={mode === "new" ? !name.trim() || !place : !existing}>
          {t(mode === "new" ? "labels.claim.create" : "labels.claim.assign")}
        </Button>
      </Flex>
    </Form>
  );
}
