"use client";

import { Alert, Button, Checkbox, Flex, Form, Input, InputNumber, Modal, Segmented, Select, Typography, theme } from "antd";
import { Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n";
import {
  A4_SIZE,
  LABEL_LIMITS,
  LABEL_PRESETS,
  clampLabelSize,
  containerQrUrl,
  isLocalhostUrl,
  packSheets,
  presetOf,
  slotsPerSheet,
  useLabelSettings,
  type LabelFields,
  type LabelMedia,
  type LabelSize,
  type PlacedLabel,
} from "../labels";
import { ContainerLabel, type LabelData } from "./ContainerLabel";

interface LabelModalProps {
  labels: LabelData[];
  open: boolean;
  onClose: () => void;
}

/** La hoja troquelada ya trae sus cortes: no lleva guía punteada. */
const isPreCut = (size: LabelSize) => presetOf(size)?.id === "sheet";

/**
 * Elegir medida (una para todas o una por caja), papel y qué lleva cada etiqueta; ver la vista
 * previa e imprimir (solo las etiquetas, sin la app). La medida de cada caja se recuerda.
 */
export function LabelModal({ labels, open, onClose }: LabelModalProps) {
  const t = useT();
  const { token } = theme.useToken();
  const { baseUrl, size, sizes, media, fields, setBaseUrl, setSize, setSizes, setMedia, setFields } = useLabelSettings();
  const [printing, setPrinting] = useState(false);
  const [skip, setSkip] = useState(0);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const effectiveBase = baseUrl || origin;

  // Al montarse el área de impresión, se abre el diálogo del navegador; al cerrarlo, se desmonta.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done, { once: true });
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  const entries = useMemo(() => labels.map((item) => ({ item, size: sizes[item.id] ?? size })), [labels, sizes, size]);
  const uniform = entries.every((entry) => entry.size.width === entries[0]?.size.width && entry.size.height === entries[0]?.size.height);
  const slots = uniform && entries[0] ? slotsPerSheet(entries[0].size) : 0;
  const effectiveSkip = media === "sheet" && uniform ? Math.min(skip, Math.max(0, slots - 1)) : 0;
  const pages = useMemo(() => (media === "sheet" ? packSheets(entries, effectiveSkip) : []), [media, entries, effectiveSkip]);

  const applyToAll = (next: LabelSize) => {
    setSize(next);
    setSizes(Object.fromEntries(labels.map((label) => [label.id, clampLabelSize(next)])));
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        title={t("labels.title", { count: labels.length })}
        width={640}
        footer={
          <Flex align="center" justify="space-between" gap={token.marginSM} wrap>
            <Typography.Text type="secondary">
              {media === "sheet" ? t("labels.pages", { count: pages.length }) : t("labels.rollCount", { count: labels.length })}
            </Typography.Text>
            <Button type="primary" icon={<Printer />} onClick={() => setPrinting(true)} disabled={labels.length === 0}>
              {t("labels.print")}
            </Button>
          </Flex>
        }
      >
        <Form layout="vertical">
          <Form.Item label={labels.length > 1 ? t("labels.sizeAll") : t("labels.size")} extra={t("labels.sizeHelp")}>
            <SizePicker value={uniform && entries[0] ? entries[0].size : undefined} onChange={applyToAll} />
          </Form.Item>

          {labels.length > 1 && (
            <Form.Item label={t("labels.sizeEach")} extra={t("labels.sizeEachHelp")}>
              <Flex vertical gap={token.marginXS} style={{ maxHeight: 220, overflowY: "auto", padding: token.paddingXS, borderRadius: token.borderRadius, background: token.colorFillQuaternary }}>
                {entries.map(({ item, size: itemSize }) => (
                  <Flex key={item.id} align="center" justify="space-between" gap={token.marginSM} wrap>
                    <Typography.Text ellipsis style={{ flex: "1 1 140px", minWidth: 0 }}>{item.name}</Typography.Text>
                    <SizePicker compact value={itemSize} onChange={(next) => setSizes({ [item.id]: clampLabelSize(next) })} />
                  </Flex>
                ))}
              </Flex>
            </Form.Item>
          )}

          <Form.Item label={t("labels.media")} extra={t(`labels.mediaHelp.${media}`)}>
            <Segmented<LabelMedia>
              block
              value={media}
              onChange={setMedia}
              options={[
                { value: "sheet", label: t("labels.mediaOptions.sheet") },
                { value: "roll", label: t("labels.mediaOptions.roll") },
              ]}
            />
          </Form.Item>

          {media === "sheet" && uniform && slots > 1 && (
            <Form.Item label={t("labels.skip")} extra={t("labels.skipHelp", { count: slots })}>
              <InputNumber min={1} max={slots} value={effectiveSkip + 1} onChange={(value) => setSkip(Math.max(0, (value ?? 1) - 1))} />
            </Form.Item>
          )}

          <Form.Item label={t("labels.fields")} extra={t("labels.fieldsHelp")}>
            <Checkbox.Group<keyof LabelFields>
              value={(Object.keys(fields) as (keyof LabelFields)[]).filter((key) => fields[key])}
              onChange={(checked) => setFields({ name: checked.includes("name"), place: checked.includes("place"), code: checked.includes("code") })}
              options={(["name", "place", "code"] as const).map((value) => ({ value, label: t(`labels.fieldOptions.${value}`) }))}
            />
          </Form.Item>

          <Form.Item label={t("labels.baseUrl")} extra={t("labels.baseUrlHelp")}>
            <Input value={baseUrl} placeholder={origin} onChange={(event) => setBaseUrl(event.target.value)} inputMode="url" />
          </Form.Item>
          {isLocalhostUrl(effectiveBase) && <Alert type="warning" showIcon title={t("labels.localhostWarning")} style={{ marginBottom: token.margin }} />}
        </Form>

        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {t("labels.preview")}
        </Typography.Text>
        <Flex
          wrap
          gap={token.marginSM}
          justify="center"
          style={{ marginTop: token.marginXS, padding: token.padding, maxHeight: 360, overflowY: "auto", borderRadius: token.borderRadiusLG, background: token.colorFillTertiary }}
        >
          {media === "sheet"
            ? pages.map((page, index) => (
                <div key={index} style={{ zoom: 0.5, boxShadow: token.boxShadowTertiary }}>
                  <SheetPage page={page} baseUrl={effectiveBase} fields={fields} />
                </div>
              ))
            : entries.map(({ item, size: itemSize }) => (
                <div key={item.id} style={{ boxShadow: token.boxShadowTertiary, zoom: itemSize.width >= 90 ? 0.8 : itemSize.width > 60 ? 1.1 : 1.3 }}>
                  <ContainerLabel label={item} size={itemSize} fields={fields} url={containerQrUrl(effectiveBase, item.code)} />
                </div>
              ))}
        </Flex>
      </Modal>

      {printing &&
        createPortal(
          <PrintArea entries={entries} pages={pages} media={media} fields={fields} baseUrl={effectiveBase} />,
          document.body,
        )}
    </>
  );
}

/** Una medida lista o una propia, en mm. */
function SizePicker({ value, onChange, compact = false }: { value?: LabelSize; onChange: (size: LabelSize) => void; compact?: boolean }) {
  const t = useT();
  const { token } = theme.useToken();
  const [custom, setCustom] = useState(false);
  const preset = value ? presetOf(value) : undefined;
  const selected = custom ? "custom" : !value ? undefined : (preset?.id ?? "custom");
  const current = value ?? { width: 50, height: 25 };

  return (
    <Flex gap={token.marginXS} wrap align="center">
      <Select<string>
        value={selected}
        placeholder={t("labels.mixed")}
        style={{ minWidth: compact ? 170 : 260 }}
        popupMatchSelectWidth={false}
        onChange={(id) => {
          if (id === "custom") return setCustom(true);
          setCustom(false);
          const next = LABEL_PRESETS.find((option) => option.id === id);
          if (next) onChange({ width: next.width, height: next.height });
        }}
        options={[
          ...LABEL_PRESETS.map((option) => ({ value: option.id, label: compact ? `${format(option.width)} × ${format(option.height)} mm` : t(`labels.sizes.${option.id}`) })),
          { value: "custom", label: t("labels.sizes.custom") },
        ]}
      />
      {selected === "custom" && (
        <Flex gap={token.marginXXS} align="center">
          <InputNumber
            aria-label={t("labels.width")}
            min={LABEL_LIMITS.min}
            max={LABEL_LIMITS.maxWidth}
            step={1}
            value={current.width}
            onChange={(width) => width && onChange({ ...current, width })}
            style={{ width: 76 }}
          />
          <Typography.Text type="secondary">×</Typography.Text>
          <InputNumber
            aria-label={t("labels.height")}
            min={LABEL_LIMITS.min}
            max={LABEL_LIMITS.maxHeight}
            step={1}
            value={current.height}
            onChange={(height) => height && onChange({ ...current, height })}
            style={{ width: 76 }}
          />
          <Typography.Text type="secondary">mm</Typography.Text>
        </Flex>
      )}
    </Flex>
  );
}

const format = (value: number) => String(value).replace(".", ",");

/** Una hoja A4 con sus etiquetas en su lugar exacto. */
function SheetPage({ page, baseUrl, fields, print = false }: { page: PlacedLabel<LabelData>[]; baseUrl: string; fields: LabelFields; print?: boolean }) {
  return (
    <div style={{ position: "relative", width: `${A4_SIZE.width}mm`, height: `${A4_SIZE.height}mm`, background: "white", overflow: "hidden", breakAfter: print ? "page" : undefined }}>
      {page.map(({ item, size, x, y }) => (
        <div key={item.id} style={{ position: "absolute", left: `${x}mm`, top: `${y}mm` }}>
          <ContainerLabel label={item} size={size} fields={fields} outline={!isPreCut(size)} url={containerQrUrl(baseUrl, item.code)} />
        </div>
      ))}
    </div>
  );
}

/** Lo único visible al imprimir (ver `.od-print-root` en globals.css). */
function PrintArea({ entries, pages, media, fields, baseUrl }: {
  entries: { item: LabelData; size: LabelSize }[];
  pages: PlacedLabel<LabelData>[][];
  media: LabelMedia;
  fields: LabelFields;
  baseUrl: string;
}) {
  if (media === "sheet") {
    return (
      <div className="od-print-root">
        <style>{"@page { size: A4; margin: 0; }"}</style>
        {pages.map((page, index) => <SheetPage key={index} page={page} baseUrl={baseUrl} fields={fields} print />)}
      </div>
    );
  }

  // Rollo: una etiqueta por página. Cada medida distinta es una página con nombre propio.
  const unique = [...new Map(entries.map(({ size }) => [`${size.width}x${size.height}`, size])).entries()];
  const pageName = (size: LabelSize) => `od-label-${unique.findIndex(([, value]) => value.width === size.width && value.height === size.height)}`;
  return (
    <div className="od-print-root">
      <style>{unique.map(([, size], index) => `@page od-label-${index} { size: ${size.width}mm ${size.height}mm; margin: 0; }`).join("\n")}</style>
      {entries.map(({ item, size }) => (
        <div key={item.id} style={{ page: pageName(size), breakAfter: "page" }}>
          <ContainerLabel label={item} size={size} fields={fields} url={containerQrUrl(baseUrl, item.code)} />
        </div>
      ))}
    </div>
  );
}
