"use client";

import { App, Button, Card, Col, Dropdown, Flex, Row, Typography, theme } from "antd";
import { ArrowRightLeft, Boxes, Camera, CopyPlus, EllipsisVertical, Images, Layers, NotebookPen, PackageOpen, PackageX, Pencil, Plus, Printer, QrCode, RotateCcwClock, ScanBarcode, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useContext, useState, type CSSProperties } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Stagger, StaggerItem } from "@/components/motion";
import { HeaderDensityContext } from "@/components/ui/PageHeader";
import { DetailMissing, DetailPage, EmptyState, PathCrumbs, RoomFloor, StatTile, type StatTone } from "@/components/ui";
import { ActivityDrawer } from "@/features/activity/components/ActivityButton";
import { usePhotos } from "@/features/media/hooks";
import { AddTile, ContainerTile } from "@/features/storage/components/ContainerTiles";
import { ContainerScene } from "@/features/storage/components/ContainerScene";
import type { LabelData } from "@/features/storage/components/ContainerLabel";
import { NotesSection, PhotosSection } from "@/features/storage/components/ContainerContents";
import { LabelModal } from "@/features/storage/components/LabelModal";
import { BulkContainersModal, ContainerModal } from "@/features/storage/components/StorageForms";
import { containerAppearance, spaceAppearance, STORAGE_LIMITS } from "@/features/storage/domain";
import { useContainer, useContainerContents, useSpaces, useStorageActions } from "@/features/storage/hooks";
import { useT } from "@/i18n";
import { tint } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import { useTrackVisit } from "@/components/layout/useShell";
import { cameraHref, containerHref, loadHref, photosHref, spaceHref } from "@/lib/navigation/routes";
import { usePageCrumbs } from "@/store/useBreadcrumbStore";
import { getStockStatus, type StockStatus } from "../domain";
import { useInventoryItems } from "../hooks";
import { MoveItemsModal } from "./MoveItemsModal";
import { ProductModal } from "./ProductModal";
import { InventoryList } from "./InventoryList";
import { ItemDrawer } from "./ItemDrawer";

const SECTIONS = { children: "cajas", items: "cosas", notes: "anotaciones", photos: "fotos" } as const;

/**
 * Página de un contenedor. Arriba, dónde está (tocable) y la escena que se abre; después lo que
 * tiene, sección por sección y con la lista primero. Agregar algo es siempre un botón de su sección.
 */
export function ContainerPage() {
  const t = useT();
  const router = useRouter();
  const { modal } = App.useApp();
  const { token } = theme.useToken();
  const params = useSearchParams();
  const containerId = params.get("id") ?? undefined;
  const arrivedItem = params.get("item");
  const container = useContainer(containerId);
  const spaces = useSpaces();
  const items = useInventoryItems(containerId ?? "");
  const notes = useContainerContents(containerId ?? "");
  const photos = usePhotos("container", containerId ?? "");
  const { deleteContainer } = useStorageActions();
  const [openItem, setOpenItem] = useState<string | null>(null);
  // La ficha a la que se llegó (`?item=`) se abre sola una vez; cerrarla no la vuelve a abrir.
  const [closedArrival, setClosedArrival] = useState<string | null>(null);
  const shownItem = openItem ?? (arrivedItem && arrivedItem !== closedArrival ? arrivedItem : null);
  const [dialog, setDialog] = useState<"edit" | "addChild" | "addMany" | "product" | "move" | null>(null);
  const [labels, setLabels] = useState<LabelData[] | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const canManage = usePermission("storage.manage");
  const canCreate = usePermission("inventory.create");
  const canViewActivity = usePermission("activity.view");
  const [activityOpen, setActivityOpen] = useState(false);
  useTrackVisit(container ? containerHref(container.id) : null);
  usePageCrumbs(
    container
      ? [
          { label: container.spaceName, href: spaceHref(container.spaceId) },
          ...container.ancestors.map((ancestor) => ({ label: ancestor.name, href: containerHref(ancestor.id) })),
          { label: container.name },
        ]
      : null,
  );

  if (!container) {
    return <DetailMissing loading={container === undefined} icon={PackageX} title={t("errors.notFound.container")} backHref="/inventario" backLabel={t("qr.back")} />;
  }

  const space = spaces?.find((candidate) => candidate.id === container.spaceId);
  const appearance = containerAppearance(container);
  const place = [container.spaceName, ...container.ancestors.map((ancestor) => ancestor.name)].join(" › ");
  const canAddChild = canManage && container.depth < STORAGE_LIMITS.maxDepth;
  const counts = { children: container.children.length, items: items?.length ?? 0, notes: notes?.length ?? 0, photos: photos?.length ?? 0 };
  const loaded = items !== undefined && notes !== undefined && photos !== undefined;
  const empty = loaded && counts.children + counts.items + counts.notes + counts.photos === 0;

  const closeItem = () => {
    setOpenItem(null);
    setClosedArrival(arrivedItem);
    // Si se llegó con `?item=`, cerrar la ficha la saca de la URL: "atrás" no la vuelve a abrir.
    if (arrivedItem) router.replace(containerHref(container.id));
  };

  const confirmDelete = () =>
    modal.confirm({
      title: t("storage.deleteContainerConfirm", { name: container.name }),
      okText: t("storage.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        const parent = container.ancestors.at(-1);
        if (await deleteContainer(container.id)) router.push(parent ? containerHref(parent.id) : spaceHref(container.spaceId));
      },
    });

  const addNote = () => {
    setNotesOpen(true);
    requestAnimationFrame(() => document.getElementById(SECTIONS.notes)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  return (
    <RequirePermission perform="inventory.view">
      <DetailPage
        header={{
          crumbs: (
            <PathCrumbs
              items={[
                { label: t("storage.title"), href: "/inventario", icon: Boxes },
                { label: container.spaceName, href: spaceHref(container.spaceId), icon: space ? spaceAppearance(space).Icon : undefined },
                ...container.ancestors.map((ancestor) => ({ label: ancestor.name, href: containerHref(ancestor.id) })),
                { label: container.name },
              ]}
            />
          ),
          leading: <ContainerScene container={container} compact open key={container.id} />,
          title: container.name,
          keepDescription: true,
          description: (
            <>
              {t(`storage.containerKinds.${container.kind}`)} · {t("storage.code")}{" "}
              <span style={{ fontFamily: "var(--font-geist-mono)", letterSpacing: "0.08em" }}>{container.code}</span>
            </>
          ),
          extra: (
            <>
              <Link href={cameraHref(container.id)}><Button icon={<Camera />}>{t("camera.openMode")}</Button></Link>
              <Button icon={<QrCode />} onClick={() => setLabels([labelOf(container, place)])}>
                {t("storage.label")}
              </Button>
              {(canManage || canViewActivity || counts.children > 0) && (
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    items: [
                      ...(counts.children > 0 ? [{ key: "photos", icon: <Images />, label: <Link href={photosHref({ id: container.id })}>{t("photos.title")}</Link> }] : []),
                      ...(canManage ? [{ key: "edit", icon: <Pencil />, label: t("storage.edit"), onClick: () => setDialog("edit") }] : []),
                      ...(canAddChild ? [{ key: "child", icon: <Layers />, label: t("storage.addSubcontainer"), onClick: () => setDialog("addChild") }] : []),
                      ...(canAddChild ? [{ key: "many", icon: <CopyPlus />, label: t("storage.bulk.title"), onClick: () => setDialog("addMany") }] : []),
                      ...(canViewActivity ? [{ key: "activity", icon: <RotateCcwClock />, label: t("activity.button"), onClick: () => setActivityOpen(true) }] : []),
                      ...(canManage ? [{ type: "divider" as const }, { key: "delete", danger: true, icon: <Trash2 />, label: t("storage.delete"), onClick: confirmDelete }] : []),
                    ],
                  }}
                >
                  <Button icon={<EllipsisVertical />} aria-label={t("common.moreActions")} />
                </Dropdown>
              )}
            </>
          ),
        }}
        summary={loaded && !empty && <Summary counts={counts} />}
        sections={[
          empty && {
            id: "vacio",
            content: (
              <Card style={{ marginBottom: token.marginXL }}>
                <EmptyState
                  icon={PackageOpen}
                  title={t("storage.emptyContainer.title")}
                  description={t("storage.emptyContainer.text")}
                  action={
                    <Flex gap={token.marginXS} wrap justify="center">
                      <Can perform="inventory.create"><Button type="primary" icon={<Plus />} onClick={() => setDialog("product")}>{t("inventory.form.title")}</Button></Can>
                      <Can perform="inventory.create"><Link href={loadHref(container.id)}><Button icon={<ScanBarcode />}>{t("inventory.scanned.button")}</Button></Link></Can>
                      <Can perform="storage.manage"><Button icon={<NotebookPen />} onClick={addNote}>{t("storage.contents.new")}</Button></Can>
                      {canAddChild && <Button icon={<Layers />} onClick={() => setDialog("addChild")}>{t("storage.addSubcontainer")}</Button>}
                      {canAddChild && <Button icon={<CopyPlus />} onClick={() => setDialog("addMany")}>{t("storage.bulk.title")}</Button>}
                    </Flex>
                  }
                />
              </Card>
            ),
          },
          counts.children > 0 && {
            id: SECTIONS.children,
            header: {
              icon: Layers,
              color: appearance.color,
              title: t("storage.subcontainers"),
              description: t("storage.childCount", { count: counts.children }),
              extra: (
                <>
                  <Button icon={<Printer />} onClick={() => setLabels(container.children.map((child) => labelOf(child, `${place} › ${container.name}`)))}>{t("storage.printLabels")}</Button>
                  {canAddChild && <Button icon={<CopyPlus />} onClick={() => setDialog("addMany")}>{t("storage.addMany")}</Button>}
                  {canAddChild && <Button icon={<Plus />} onClick={() => setDialog("addChild")}>{t("storage.addSubcontainer")}</Button>}
                </>
              ),
            },
            content: (
              <>
                <RoomFloor color={appearance.color} minTileWidth={token.controlHeightLG * 3}>
                  {container.children.map((child) => (
                    <ContainerTile key={child.id} container={child} onLabel={() => setLabels([labelOf(child, `${place} › ${container.name}`)])} />
                  ))}
                  {canAddChild && <AddTile color={tint(token, appearance.color).solid} label={t("storage.addSubcontainer")} onClick={() => setDialog("addChild")} />}
                </RoomFloor>
                {canManage && container.depth + 1 >= STORAGE_LIMITS.maxDepth && (
                  <Typography.Text type="secondary" style={{ display: "block", marginTop: token.marginXS, fontSize: token.fontSizeSM }}>
                    {t("storage.maxDepth")}
                  </Typography.Text>
                )}
              </>
            ),
          },
          !empty && {
            id: SECTIONS.items,
            header: {
              icon: Boxes,
              title: t("storage.contents.inventory"),
              description: counts.items ? t("storage.itemCount", { count: counts.items }) : t("inventory.list.emptyHint"),
              extra: canCreate && (
                <>
                  {counts.items > 0 && <Button icon={<ArrowRightLeft />} onClick={() => setDialog("move")}>{t("inventory.move.button")}</Button>}
                  <Link href={loadHref(container.id)}><Button icon={<ScanBarcode />}>{t("inventory.scanned.button")}</Button></Link>
                  <Button type="primary" icon={<Plus />} onClick={() => setDialog("product")}>{t("inventory.form.title")}</Button>
                </>
              ),
            },
            content: (
              <>
                {(items ?? []).some((item) => !item.reusable) && <StockTiles statuses={(items ?? []).filter((item) => !item.reusable).map(getStockStatus)} />}
                <InventoryList containerId={container.id} onOpen={setOpenItem} highlightId={arrivedItem} />
              </>
            ),
          },
          (!empty || notesOpen) && {
            id: SECTIONS.notes,
            content: <NotesSection key={container.id} containerId={container.id} id={SECTIONS.notes} startOpen={notesOpen} />,
          },
          { id: SECTIONS.photos, content: <PhotosSection containerId={container.id} id={SECTIONS.photos} /> },
        ]}
      >
        <ActivityDrawer containerId={container.id} place={container.name} open={activityOpen} onClose={() => setActivityOpen(false)} />
        <ItemDrawer itemId={shownItem} onClose={closeItem} />
        <MoveItemsModal containerId={container.id} open={dialog === "move"} onClose={() => setDialog(null)} />
        <ProductModal containerId={container.id} place={container.name} open={dialog === "product"} onClose={() => setDialog(null)} />
        <ContainerModal open={dialog === "edit"} container={container} onClose={() => setDialog(null)} />
        <ContainerModal open={dialog === "addChild"} parentId={container.id} onClose={() => setDialog(null)} />
        <BulkContainersModal
          open={dialog === "addMany"}
          parentId={container.id}
          onClose={() => setDialog(null)}
          onCreated={(created, where) => setLabels(created.map((child) => labelOf(child, where)))}
        />
        <LabelModal open={!!labels} labels={labels ?? []} onClose={() => setLabels(null)} />
      </DetailPage>
    </RequirePermission>
  );
}

/** "3 productos · 5 anotaciones · 2 fotos": cada parte lleva a su sección. */
function Summary({ counts }: { counts: Record<keyof typeof SECTIONS, number> }) {
  const t = useT();
  const { token } = theme.useToken();
  const parts = [
    { key: "children" as const, text: t("storage.childCount", { count: counts.children }) },
    { key: "items" as const, text: t("storage.itemCount", { count: counts.items }) },
    { key: "notes" as const, text: t("storage.noteCount", { count: counts.notes }) },
    { key: "photos" as const, text: t("storage.photoCount", { count: counts.photos }) },
  ].filter((part) => counts[part.key] > 0);
  const headerDensity = useContext(HeaderDensityContext);
  const link: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: token.controlHeightLG + token.paddingXXS, color: token.colorTextSecondary, textDecoration: "underline", textDecorationColor: token.colorBorder, textUnderlineOffset: 4 };
  return (
    <nav aria-label={t("storage.summary")} style={{ marginTop: headerDensity === "compact" ? -token.marginXS : -token.marginLG, marginBottom: token.marginLG }}>
      <Flex wrap align="center" gap={token.marginXS}>
        {parts.map((part, index) => (
          <Flex key={part.key} align="center" gap={token.marginXS}>
            {index > 0 && <Typography.Text type="secondary" aria-hidden>·</Typography.Text>}
            <a href={`#${SECTIONS[part.key]}`} className="od-focusable" style={link}>{part.text}</a>
          </Flex>
        ))}
      </Flex>
    </nav>
  );
}

/** Bien · Poco · Agotado de los insumos: las herramientas no se gastan, así que no suman acá. */
function StockTiles({ statuses }: { statuses: StockStatus[] }) {
  const t = useT();
  const { token } = theme.useToken();
  const tones: Record<StockStatus, StatTone> = { ok: "success", low: "warning", empty: "error" };
  return (
    <Stagger delay={0.1}>
      <Row gutter={[token.marginSM, token.marginSM]} style={{ marginBottom: token.margin }}>
        {(["ok", "low", "empty"] as const).map((status) => (
          <Col key={status} xs={8}>
            <StaggerItem style={{ height: "100%" }}>
              <StatTile label={t(`inventory.stock.${status}`)} value={statuses.filter((value) => value === status).length} tone={tones[status]} />
            </StaggerItem>
          </Col>
        ))}
      </Row>
    </Stagger>
  );
}

/** Datos de la etiqueta: el nombre grande y debajo dónde está ("Dormitorio › Placard"). */
function labelOf(container: { id: string; name: string; code: string }, path: string): LabelData {
  return { id: container.id, name: container.name, code: container.code, spaceName: path };
}
