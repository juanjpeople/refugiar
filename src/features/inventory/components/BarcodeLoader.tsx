"use client";

import { Button, Card, Flex, Input, Switch, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Camera, CameraOff, Check, ScanBarcode, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { Callout, CameraViewport, EmptyState, IconTile, PageHeader, PathCrumbs, QuantityStepper } from "@/components/ui";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { useHydrated } from "@/hooks/useHydrated";
import { useI18n } from "@/i18n";
import { containerHref, spaceHref } from "@/lib/navigation/routes";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useContainer } from "@/features/storage/hooks";
import { productCodesSupported } from "@/features/storage/qr-reader";
import { useCameraScanner } from "@/features/storage/useCameraScanner";
import { INVENTORY_LIMITS, isBarcode } from "../domain";
import { useInventoryActions } from "../hooks";
import { useNetworkPolicy } from "@/lib/network/policy";
import { lookupProductName } from "../product-lookup";
import { knownBarcodeName } from "../service";

interface Read {
  barcode: string;
  name: string;
  count: number;
  /** Buscando el nombre (en la casa o en Open Food Facts). */
  looking: boolean;
}

/** Un mismo código frente a la cámara se cuenta una vez: para sumar otro, se aparta y se vuelve a pasar. */
const SAME_CODE_PAUSE = 1500;

export function BarcodeLoader() {
  return (
    <RequirePermission perform="inventory.create">
      <BarcodeLoaderView />
    </RequirePermission>
  );
}

/**
 * Carga en ráfaga: se elige el mueble, se pasan los envases frente a la cámara y cada lectura vibra
 * y queda en la lista. Al final se revisan los nombres y se guarda todo junto.
 */
function BarcodeLoaderView() {
  const { t, locale } = useI18n();
  const { token } = theme.useToken();
  const router = useRouter();
  const hydrated = useHydrated();
  const containerId = useSearchParams().get("id") ?? undefined;
  const container = useContainer(containerId);
  const productsAllowed = useNetworkPolicy(s => s.products);
  const { productLookup } = usePreferences();
  const setPreference = useSetPreference();
  const { addScanned } = useInventoryActions();
  const [reads, setReads] = useState<Read[]>([]);
  const [manual, setManual] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const lastSeen = useRef(new Map<string, number>());
  // Códigos ya en la lista: el primero de cada uno busca su nombre una sola vez.
  const listed = useRef(new Set<string>());
  const lookup = useRef(productLookup && productsAllowed);
  useEffect(() => { lookup.current = productLookup && productsAllowed; }, [productLookup, productsAllowed]);
  useEffect(() => { void productCodesSupported().then(setSupported); }, []);

  async function resolveName(barcode: string) {
    const known = await knownBarcodeName(barcode);
    const found = known ?? (lookup.current && navigator.onLine ? await lookupProductName(barcode, locale) : null);
    setReads((current) => current.map((read) => (read.barcode === barcode ? { ...read, looking: false, name: read.name || found || "" } : read)));
  }

  function add(barcode: string) {
    navigator.vibrate?.(50);
    if (listed.current.has(barcode)) {
      setReads((current) => current.map((read) => (read.barcode === barcode ? { ...read, count: Math.min(INVENTORY_LIMITS.maxQuantity, read.count + 1) } : read)));
      return;
    }
    listed.current.add(barcode);
    setReads((current) => [{ barcode, name: "", count: 1, looking: true }, ...current]);
    void resolveName(barcode);
  }

  function remove(barcode?: string) {
    if (barcode) listed.current.delete(barcode);
    else listed.current.clear();
    setReads((current) => (barcode ? current.filter((read) => read.barcode !== barcode) : []));
  }

  const camera = useCameraScanner((detections) => {
    const now = Date.now();
    for (const detection of detections) {
      const code = detection.rawValue.trim();
      if (!isBarcode(code)) continue;
      const seen = lastSeen.current.get(code) ?? 0;
      lastSeen.current.set(code, now);
      if (now - seen > SAME_CODE_PAUSE) add(code);
    }
  }, "product");

  function submitManual() {
    const code = manual.replace(/\s/g, "");
    if (!isBarcode(code)) return setInvalid(true);
    setInvalid(false);
    setManual("");
    add(code);
  }

  const total = reads.reduce((sum, read) => sum + read.count, 0);
  const unnamed = reads.some((read) => !read.name.trim());

  async function save() {
    if (!containerId || !reads.length || unnamed) return;
    setSaving(true);
    const ok = await addScanned(containerId, reads.map(({ barcode, name, count }) => ({ barcode, name: name.trim(), count })));
    setSaving(false);
    if (ok) {
      camera.stop();
      router.push(containerHref(containerId));
    }
  }

  if (container === null) {
    return <EmptyState icon={Boxes} title={t("inventory.scanned.noContainer")} action={<Link href="/inventario"><Button type="primary">{t("storage.title")}</Button></Link>} />;
  }

  const update = (barcode: string, patch: Partial<Read>) => setReads((current) => current.map((read) => (read.barcode === barcode ? { ...read, ...patch } : read)));
  const canUseCamera = hydrated && !!navigator.mediaDevices?.getUserMedia && supported !== false;

  return (
    <>
      <PageHeader
        crumbs={container && (
          <PathCrumbs
            items={[
              { label: t("storage.title"), href: "/inventario", icon: Boxes },
              { label: container.spaceName, href: spaceHref(container.spaceId) },
              ...container.ancestors.map((ancestor) => ({ label: ancestor.name, href: containerHref(ancestor.id) })),
              { label: container.name, href: containerHref(container.id) },
            ]}
          />
        )}
        title={t("inventory.scanned.title")}
        description={container ? t("inventory.scanned.description", { place: container.name }) : undefined}
      />

      <Flex vertical gap={token.marginLG} style={{ maxWidth: token.screenSM + token.paddingLG * 4 }}>
        <Reveal>
          <Flex vertical gap={token.margin}>
            {supported === false && <Callout tone="warning" title={t("inventory.scanned.unsupportedTitle")}>{t("inventory.scanned.unsupported")}</Callout>}
            {(camera.status === "denied" || camera.status === "failed") && <Callout tone="danger" role="alert">{t(`scan.${camera.status}`)}</Callout>}
            {supported !== false && (
              <CameraViewport
                videoRef={camera.videoRef}
                active={camera.active}
                aspectRatio="16/9"
                frame={camera.active}
                placeholder={<IconTile icon={ScanBarcode} size={token.controlHeightLG * 2} />}
              />
            )}
            {supported !== false && (camera.active ? (
              <Button icon={<CameraOff />} onClick={camera.stop}>{t("scan.stop")}</Button>
            ) : (
              <Button type="primary" size="large" icon={<Camera />} disabled={!canUseCamera} onClick={() => void camera.start()}>
                {t("inventory.scanned.start")}
              </Button>
            ))}
            <Flex vertical gap={token.marginXXS}>
              <Typography.Text type="secondary">{t("inventory.scanned.manual")}</Typography.Text>
              <Input.Search
                aria-label={t("inventory.scanned.manual")}
                inputMode="numeric"
                placeholder="7790000000000"
                value={manual}
                status={invalid ? "error" : undefined}
                enterButton={t("inventory.scanned.addCode")}
                onChange={(event) => { setManual(event.target.value); setInvalid(false); }}
                onSearch={submitManual}
              />
              {invalid && <Typography.Text type="danger">{t("errors.validation.barcodeInvalid")}</Typography.Text>}
            </Flex>
            <Flex align="flex-start" gap={token.marginSM}>
              <Switch
                id="product-lookup"
                checked={productLookup}
                onChange={(checked) => setPreference("productLookup", checked)}
              />
              <label htmlFor="product-lookup" style={{ cursor: "pointer" }}>
                <Typography.Text strong style={{ display: "block" }}>{t("inventory.scanned.lookup")}</Typography.Text>
                <Typography.Text type="secondary">{t("inventory.scanned.lookupHint")}</Typography.Text>
                {productLookup && !productsAllowed && <Typography.Text type="warning" style={{ display: "block" }}>{t("connections.blocked")}</Typography.Text>}
              </label>
            </Flex>
          </Flex>
        </Reveal>

        <Card
          title={t("inventory.scanned.listTitle", { count: total })}
          extra={reads.length > 0 && <Button type="text" danger onClick={() => remove()}>{t("inventory.scanned.clear")}</Button>}
        >
          {reads.length === 0 ? (
            <Typography.Text type="secondary">{t("inventory.scanned.empty")}</Typography.Text>
          ) : (
            <Flex vertical gap={token.marginSM} role="list">
              <AnimatePresence initial={false}>
                {reads.map((read) => (
                  <motion.div
                    key={read.barcode}
                    role="listitem"
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: DURATION.base, ease: EASE_OUT }}
                  >
                    <Flex gap={token.marginSM} align="center" wrap>
                      <Flex vertical gap={2} style={{ flex: "1 1 200px", minWidth: 0 }}>
                        <Input
                          aria-label={t("inventory.scanned.nameOf", { code: read.barcode })}
                          value={read.name}
                          maxLength={INVENTORY_LIMITS.nameMaxLength}
                          placeholder={read.looking ? t("inventory.scanned.looking") : t("inventory.scanned.namePlaceholder")}
                          status={!read.looking && !read.name.trim() ? "warning" : undefined}
                          onChange={(event) => update(read.barcode, { name: event.target.value })}
                        />
                        <Typography.Text type="secondary" style={{ fontFamily: "var(--font-geist-mono)", fontSize: token.fontSizeSM }}>{read.barcode}</Typography.Text>
                      </Flex>
                      <QuantityStepper
                        aria-label={t("inventory.scanned.countOf", { code: read.barcode })}
                        value={read.count}
                        min={1}
                        max={INVENTORY_LIMITS.maxQuantity}
                        onChange={(count) => update(read.barcode, { count })}
                      />
                      <Button type="text" icon={<Trash2 />} aria-label={t("inventory.scanned.remove", { code: read.barcode })} onClick={() => remove(read.barcode)} />
                    </Flex>
                  </motion.div>
                ))}
              </AnimatePresence>
            </Flex>
          )}
        </Card>

        <Flex gap={token.marginSM} wrap align="center">
          <Button type="primary" size="large" icon={<Check />} loading={saving} disabled={!reads.length || unnamed} onClick={() => void save()}>
            {t("inventory.scanned.save", { count: total })}
          </Button>
          {unnamed && reads.length > 0 && <Typography.Text type="secondary">{t("inventory.scanned.needsNames")}</Typography.Text>}
        </Flex>
      </Flex>
    </>
  );
}
