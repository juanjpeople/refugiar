"use client";

import { Button, Flex, Input, Modal, Space, Typography, theme } from "antd";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { useMemo, useState } from "react";
import { Callout, CameraViewport, IconTile } from "@/components/ui";
import { useHydrated } from "@/hooks/useHydrated";
import { useT } from "@/i18n";
import { isValidContainerCode, normalizeContainerCode, STORAGE_LIMITS } from "../domain";
import { useContainers } from "../hooks";
import { codeFromScan } from "../scan";
import { useCameraScanner } from "../useCameraScanner";

type FoundContainer = NonNullable<ReturnType<typeof useContainers>>[number];

/**
 * Elegir un contenedor escaneando su etiqueta (o tipeando su código), sin salir de la pantalla.
 * Lo usan "Mover a" y cualquier flujo que necesite "¿en qué caja?". La cámara se apaga al cerrar.
 */
export function ScanContainerModal({ open, title, onClose, onFound }: {
  open: boolean;
  title: string;
  onClose: () => void;
  onFound: (container: FoundContainer) => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const hydrated = useHydrated();
  const containers = useContainers();
  const byCode = useMemo(() => new Map((containers ?? []).map((container) => [container.code, container])), [containers]);
  const [problem, setProblem] = useState<"invalid" | "unknown" | null>(null);
  const [manual, setManual] = useState("");
  const camera = useCameraScanner((detections, stopFrame) => {
    const code = detections.map((detection) => codeFromScan(detection.rawValue)).find(Boolean);
    if (!code) {
      if (detections.length) setProblem("invalid");
      return;
    }
    const match = byCode.get(code);
    if (!match) return setProblem("unknown");
    stopFrame();
    onFound(match);
  });
  const { stop } = camera;

  // Al cerrar (con la X, Escape o al encontrar la caja), la cámara se libera siempre.
  const reset = () => {
    stop();
    setProblem(null);
    setManual("");
  };

  const supported = hydrated && !!navigator.mediaDevices?.getUserMedia;
  const manualCode = normalizeContainerCode(manual);
  const submitManual = () => {
    if (!isValidContainerCode(manualCode)) return;
    const match = byCode.get(manualCode);
    if (match) onFound(match);
    else setProblem("unknown");
  };

  return (
    <Modal open={open} title={title} onCancel={() => { stop(); onClose(); }} afterOpenChange={(visible) => { if (!visible) reset(); }} footer={null} width={480} destroyOnHidden>
      <Flex vertical gap={token.margin}>
        {hydrated && !supported && <Callout>{t("scan.unsupported")}</Callout>}
        {(camera.status === "denied" || camera.status === "failed") && <Callout tone="danger" role="alert">{t(`scan.${camera.status}`)}</Callout>}
        {problem && <Callout tone="warning">{t(problem === "invalid" ? "scan.invalid" : "scan.unknown")}</Callout>}
        <CameraViewport
          videoRef={camera.videoRef}
          active={camera.active}
          aspectRatio="4/3"
          frame={camera.active}
          placeholder={<IconTile icon={ScanLine} size={token.controlHeightLG * 2} />}
        />
        {camera.active ? (
          <Button icon={<CameraOff />} onClick={stop}>{t("scan.stop")}</Button>
        ) : (
          <Button type="primary" size="large" icon={<Camera />} disabled={!supported} onClick={() => { setProblem(null); void camera.start(); }}>
            {t("scan.start")}
          </Button>
        )}
        <Flex vertical gap={token.marginXXS}>
          <Typography.Text type="secondary">{t("scan.manual")}</Typography.Text>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              aria-label={t("storage.code")}
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              onPressEnter={submitManual}
              placeholder={t("scan.manualPlaceholder")}
              maxLength={STORAGE_LIMITS.codeLength}
              style={{ fontFamily: "var(--font-geist-mono)", textTransform: "uppercase" }}
            />
            <Button type="primary" disabled={!isValidContainerCode(manualCode)} onClick={submitManual}>{t("scan.use")}</Button>
          </Space.Compact>
        </Flex>
      </Flex>
    </Modal>
  );
}
