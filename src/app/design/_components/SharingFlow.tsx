"use client";
import { useState } from "react";
import { Button, Flex, Modal, Select, Typography, theme } from "antd";
import {
  PrivacySelect,
  ShareOptions,
  type ShareOptionsValue,
} from "@/components/ui";
import { useT } from "@/i18n";
import type { Privacy } from "@/lib/sync/scope";
import { ContentPreview } from "@/features/sharing/ContentPreview";
import {
  shareKinds,
  type SharedContentV1,
  type SharedRecipe,
  type ShareKind,
} from "@/features/sharing/domain";
import { shareMessage } from "@/features/sharing/format";
import { DemoBlock } from "./DemoBlock";

const common = {
  version: 1 as const,
  publishedAt: 1792324800000,
  attachments: [],
};
const recipe: SharedRecipe = {
  name: "Pan casero",
  servings: 4,
  minutes: 60,
  ingredients: [{ name: "Harina", quantity: 1, unit: "kg" }],
  steps: ["Mezclá los ingredientes.", "Dejá descansar y horneá."],
  stepSeconds: [0, 1800],
  tags: ["vegan"],
};
const itemId = "00000000-0000-4000-8000-000000000001";
const examples: Record<ShareKind, SharedContentV1> = {
  recipe: { ...common, kind: "recipe", recipe },
  project: {
    ...common,
    kind: "project",
    name: "Estante de cocina",
    currency: "ARS",
    tasks: ["Medí la pared.", "Cortá y fijá el estante."],
    materials: [{ name: "Madera", quantity: 1, unit: "unit" }],
    journal: [],
    contacts: [],
    expenses: [],
  },
  "shopping-list": {
    ...common,
    kind: "shopping-list",
    name: "Compras del domingo",
    currency: "ARS",
    items: [
      { id: itemId, name: "Harina", quantity: 1, unit: "kg", bought: false },
    ],
  },
  event: {
    ...common,
    kind: "event",
    name: "Almuerzo del domingo",
    start: 1792332000000,
    end: 1792335600000,
    allDay: false,
    startDate: "2026-10-18",
    endDate: "2026-10-18",
    timeZone: "America/Argentina/Buenos_Aires",
  },
  "meal-plan": {
    ...common,
    kind: "meal-plan",
    name: "Menú semanal",
    week: "2026-10-19",
    recipes: [recipe],
    meals: [
      { day: 0, recipe: 0, servings: 4 },
      { day: 3, recipe: 0, servings: 2 },
    ],
  },
};

export function SharingFlow() {
  const t = useT(),
    { token } = theme.useToken();
  const [value, setValue] = useState<ShareOptionsValue>({
    link: true,
    full: false,
    mode: "snapshot",
  });
  const [kind, setKind] = useState<ShareKind>("shopping-list");
  const [checked, setChecked] = useState(false);
  const [received, setReceived] = useState(false);
  const [review, setReview] = useState(false),
    [saved, setSaved] = useState(false),
    [privacy, setPrivacy] = useState<Privacy>("private");
  const content = examples[kind];
  return (
    <DemoBlock
      id="flujo-compartir"
      title="Compartir sin abrir la casa"
      description="Elegí contenido, texto o enlace, revisá la ficha y probá una marca externa o importación. Usa ShareCard a través de ContentPreview y ShareOptions. Esta demostración no publica ni modifica datos."
    >
      <Flex vertical gap={token.marginMD}>
        <Select
          aria-label={t("sharing.include")}
          value={kind}
          onChange={setKind}
          options={shareKinds.map((value) => ({
            value,
            label: t(`sharing.kinds.${value}`),
          }))}
        />
        <ShareOptions
          shopping={kind === "shopping-list"}
          value={value}
          onChange={setValue}
        />
        <ContentPreview
          content={content}
          marks={[
            { id: itemId, checked: checked || received, received, revision: 0 },
          ]}
          onCheck={
            value.link && value.mode === "live-check"
              ? (_, next) => setChecked(next)
              : undefined
          }
        />
        <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
          {shareMessage(content, t, value.full)}
        </Typography.Paragraph>
        {kind === "shopping-list" && checked && !received && (
          <Button onClick={() => setReceived(true)}>
            {t("sharing.confirmReceived")}
          </Button>
        )}
        <Button onClick={() => setReview(true)}>{t("sharing.save")}</Button>
        {saved && (
          <Typography.Text role="status">
            {t("sharing.imported")}
          </Typography.Text>
        )}
        <Button
          onClick={() => {
            setChecked(false);
            setReceived(false);
            setSaved(false);
            setPrivacy("private");
          }}
        >
          {t("sharing.resetDemo")}
        </Button>
        <Typography.Paragraph type="secondary">
          {t("sharing.safety")}
        </Typography.Paragraph>
      </Flex>
      <Modal
        open={review}
        title={t("sharing.importTitle")}
        onCancel={() => setReview(false)}
        footer={null}
      >
        <Flex vertical gap={token.marginMD}>
          <ContentPreview content={content} />
          <Typography.Paragraph>{t("sharing.ownCopy")}</Typography.Paragraph>
          <Typography.Text>{t("sharing.privacy")}</Typography.Text>
          <PrivacySelect value={privacy} onChange={setPrivacy} />
          <Button
            type="primary"
            onClick={() => {
              setReview(false);
              setSaved(true);
            }}
          >
            {t("sharing.confirmImport")}
          </Button>
        </Flex>
      </Modal>
    </DemoBlock>
  );
}
