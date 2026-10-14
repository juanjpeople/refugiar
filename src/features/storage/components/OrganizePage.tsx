"use client";

import { Button, Card, Col, Flex, Input, Row, Select, Space, Tag, Typography, theme } from "antd";
import { Camera, CameraOff, Check, ExternalLink, ScanLine, Tag as TagIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { Callout, CameraViewport, IconTile, PageHeader, SectionHeader } from "@/components/ui";
import { PhotoGallery } from "@/features/media/components/PhotoGallery";
import { useHydrated } from "@/hooks/useHydrated";
import { useT } from "@/i18n";
import { db } from "@/lib/db";
import { containerHref } from "@/lib/navigation/routes";
import { containerAppearance, isValidContainerCode, normalizeContainerCode, reservedLabelId, STORAGE_LIMITS } from "../domain";
import { useContainerContents, useContainers, useStorageActions } from "../hooks";
import { codeFromScan } from "../scan";
import { useCameraScanner } from "../useCameraScanner";
import { ClaimLabel } from "./ClaimLabel";
import type { LocationValue } from "./StorageForms";

/**
 * Ordenar: una caja por vez. Se escanea (o se elige), se le saca una foto, se anota qué tiene
 * (una cosa por línea, sin cantidades) y "Listo, siguiente caja" vuelve a la cámara. Una etiqueta
 * en blanco se convierte en caja acá mismo.
 */
export function OrganizePage() {
  return <RequirePermission perform="storage.manage"><OrganizeView /></RequirePermission>;
}

function OrganizeView() {
  const t = useT();
  const { token } = theme.useToken();
  const hydrated = useHydrated();
  const startSpace = useSearchParams().get("space") ?? "";
  const containers = useContainers();
  const byCode = useMemo(() => new Map((containers ?? []).map((container) => [container.code, container])), [containers]);
  const { addContents } = useStorageActions();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [problem, setProblem] = useState<"invalid" | "unknown" | null>(null);
  const [manual, setManual] = useState("");
  const [text, setText] = useState("");
  const [lastPlace, setLastPlace] = useState<LocationValue | undefined>(startSpace ? `space:${startSpace}` : undefined);
  const [done, setDone] = useState<string[]>([]);
  const current = containers?.find((container) => container.id === currentId);

  async function open(code: string) {
    const match = byCode.get(code);
    if (match) return choose(match.id);
    if (await db.houseSettings.get(reservedLabelId(code))) {
      camera.stop();
      setClaiming(code);
      return;
    }
    setProblem("unknown");
  }

  const camera = useCameraScanner((detections, stopFrame) => {
    const code = detections.map((detection) => codeFromScan(detection.rawValue)).find(Boolean);
    if (!code) {
      if (detections.length) setProblem("invalid");
      return;
    }
    stopFrame();
    void open(code);
  });

  function choose(id: string) {
    camera.stop();
    setProblem(null);
    setClaiming(null);
    setCurrentId(id);
    const container = containers?.find((candidate) => candidate.id === id);
    // Las cajas nuevas van, por defecto, al mismo lugar que la última.
    if (container) setLastPlace(container.parentId ? `container:${container.parentId}` : `space:${container.spaceId}`);
  }

  async function next() {
    if (current && text.trim() && !(await addContents(current.id, text))) return;
    if (current) setDone((list) => (list.includes(current.id) ? list : [...list, current.id]));
    setText("");
    setCurrentId(null);
    setProblem(null);
    void camera.start();
  }

  const supported = hydrated && !!navigator.mediaDevices?.getUserMedia;
  const manualCode = normalizeContainerCode(manual);

  return (
    <>
      <PageHeader eyebrow={t("storage.eyebrow")} title={t("organize.title")} description={t("organize.description")} />
      <Row gutter={[token.marginLG, token.marginLG]}>
        <Col xs={24} lg={current || claiming ? 12 : 14}>
          <Reveal delay={0.05}>
            {current ? (
              <CurrentBox container={current} text={text} onText={setText} onNext={next} />
            ) : claiming ? (
              <Card>
                <SectionHeader icon={TagIcon} title={t("labels.claim.title")} />
                <ClaimLabel code={claiming} defaultLocation={lastPlace} onDone={choose} />
                <Button type="text" onClick={() => setClaiming(null)}>{t("common.cancel")}</Button>
              </Card>
            ) : (
              <Flex vertical gap={token.margin}>
                {hydrated && !supported && <Callout>{t("scan.unsupported")}</Callout>}
                {(camera.status === "denied" || camera.status === "failed") && <Callout tone="danger" role="alert">{t(`scan.${camera.status}`)}</Callout>}
                {problem && <Callout tone="warning">{t(problem === "invalid" ? "scan.invalid" : "scan.unknown")}</Callout>}
                <CameraViewport videoRef={camera.videoRef} active={camera.active} aspectRatio="4/3" frame={camera.active} placeholder={<IconTile icon={ScanLine} size={token.controlHeightLG * 2} />} />
                {camera.active ? (
                  <Button icon={<CameraOff />} onClick={camera.stop}>{t("scan.stop")}</Button>
                ) : (
                  <Button type="primary" size="large" icon={<Camera />} disabled={!supported} onClick={() => { setProblem(null); void camera.start(); }}>
                    {t("organize.scan")}
                  </Button>
                )}
              </Flex>
            )}
          </Reveal>
        </Col>
        <Col xs={24} lg={current || claiming ? 12 : 10}>
          <Reveal delay={0.1}>
            <Flex vertical gap={token.margin}>
              {!current && !claiming && (
                <Card>
                  <SectionHeader icon={ScanLine} title={t("organize.withoutCamera")} />
                  <Flex vertical gap={token.marginSM}>
                    <Space.Compact style={{ width: "100%" }}>
                      <Input aria-label={t("storage.code")} value={manual} onChange={(event) => setManual(event.target.value)} onPressEnter={() => isValidContainerCode(manualCode) && void open(manualCode)}
                        placeholder={t("scan.manualPlaceholder")} maxLength={STORAGE_LIMITS.codeLength} style={{ fontFamily: "var(--font-geist-mono)", textTransform: "uppercase" }} />
                      <Button type="primary" disabled={!isValidContainerCode(manualCode)} onClick={() => void open(manualCode)}>{t("scan.use")}</Button>
                    </Space.Compact>
                    <Select
                      showSearch={{ optionFilterProp: "label" }}
                      placeholder={t("organize.pick")}
                      value={null}
                      onChange={(id: string | null) => id && choose(id)}
                      options={(containers ?? []).map((container) => ({ value: container.id, label: `${container.spaceName} › ${container.path}` }))}
                    />
                  </Flex>
                </Card>
              )}
              {done.length > 0 && (
                <Card>
                  <SectionHeader icon={Check} title={t("organize.done", { count: done.length })} />
                  <Flex wrap gap={token.marginXXS}>
                    {done.map((id) => {
                      const container = containers?.find((candidate) => candidate.id === id);
                      return container && <Link key={id} href={containerHref(id)}><Tag bordered={false} color="success">{container.name}</Tag></Link>;
                    })}
                  </Flex>
                </Card>
              )}
            </Flex>
          </Reveal>
        </Col>
      </Row>
    </>
  );
}

function CurrentBox({ container, text, onText, onNext }: {
  container: NonNullable<ReturnType<typeof useContainers>>[number];
  text: string;
  onText: (text: string) => void;
  onNext: () => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const notes = useContainerContents(container.id);
  const { color, Icon } = containerAppearance(container);
  const [saving, setSaving] = useState(false);

  return (
    <Card>
      <SectionHeader icon={Icon} color={color} title={container.name} description={`${container.spaceName} › ${container.path}`}
        extra={<Link href={containerHref(container.id)}><Button icon={<ExternalLink />} aria-label={t("camera.open")} /></Link>} />
      <Flex vertical gap={token.margin}>
        <div>
          <Typography.Text strong>{t("organize.photos")}</Typography.Text>
          <div style={{ marginTop: token.marginXS }}>
            <PhotoGallery ownerType="container" ownerId={container.id} editable />
          </div>
        </div>
        <div>
          <Typography.Text strong>{t("organize.contents")}</Typography.Text>
          {!!notes?.length && (
            <Typography.Paragraph type="secondary" style={{ margin: `${token.marginXXS}px 0` }}>
              {t("organize.already", { list: notes.map((note) => note.text).slice(0, 6).join(" · ") + (notes.length > 6 ? " …" : "") })}
            </Typography.Paragraph>
          )}
          <Input.TextArea value={text} onChange={(event) => onText(event.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} placeholder={t("organize.contentsPlaceholder")} style={{ marginTop: token.marginXS }} />
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("organize.contentsHelp")}</Typography.Text>
        </div>
        <Button type="primary" size="large" block icon={<Check />} loading={saving} onClick={async () => { setSaving(true); await onNext(); setSaving(false); }}>
          {t("organize.next")}
        </Button>
      </Flex>
    </Card>
  );
}
