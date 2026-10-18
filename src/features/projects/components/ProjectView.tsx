"use client";
import { ProjectCover } from "@/components/ui";
import { projectExampleCover } from "../example-covers";
import { ProjectWorkspace } from "./ProjectWorkspace";

import { App, Button, Card, Col, Dropdown, Flex, Row, Tag, Tooltip, Typography, theme } from "antd";
import { CircleCheck, Ellipsis, ListChecks, Pencil, Plus, RotateCcw, SearchX, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { DetailMissing, DetailPage, EmptyState, IconTile, ListGrid } from "@/components/ui";
import { BudgetBar } from "@/features/shopping/components/BudgetBar";
import { ListModal } from "@/features/shopping/components/ListModal";
import { listName, type ListSummary } from "@/features/shopping/hooks";
import { useI18n } from "@/i18n";
import { APPEARANCE_ICONS } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import { useTrackVisit } from "@/components/layout/useShell";
import { projectHref } from "@/lib/navigation/routes";
import { usePageCrumbs } from "@/store/useBreadcrumbStore";
import { useProject, useProjectActions } from "../hooks";
import { ProjectModal } from "./ProjectModal";

/** Un proyecto: su presupuesto total contra lo que suman sus listas, y las listas en sí. */
export function ProjectView() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const router = useRouter();
  const { modal } = App.useApp();
  const id = useSearchParams().get("id");
  const summary = useProject(id);
  const { setStatus, remove } = useProjectActions();
  const canManageLists = usePermission("shopping.manage");
  const [dialog, setDialog] = useState<"edit" | "list" | null>(null);
  usePageCrumbs(summary ? [{ label: summary.project.name }] : null);
  useTrackVisit(summary ? projectHref(summary.project.id) : null);

  if (!summary) {
    return (
      <DetailMissing loading={summary === undefined} icon={SearchX} title={t("errors.notFound.project")} backHref="/proyectos" backLabel={t("projects.back")} />
    );
  }

  const { project, lists, budget } = summary;
  const done = project.status === "done";
  const money = (cents: number) => format.money(cents, budget.currency);

  const confirmDelete = () =>
    modal.confirm({
      title: t("projects.deleteConfirm", { name: project.name }),
      content: `${t("projects.deleteText")} ${t("projects.deleteShares")}`,
      okText: t("projects.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        if ((await remove(project.id)) !== null) router.push("/proyectos");
      },
    });

  return (
    <RequirePermission perform="projects.view">
      <DetailPage
        header={{
          eyebrow: t("projects.eyebrow"),
          leading: <IconTile icon={APPEARANCE_ICONS[project.icon]} color={project.color} size={44} />,
          title: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: token.marginSM, flexWrap: "wrap" }}>
              {project.name}
              {done && <Tag color="success">{t("projects.done")}</Tag>}
            </span>
          ),
          description: project.notes,
          extra: (
            <Can perform="projects.manage">
              <Button icon={done ? <RotateCcw /> : <CircleCheck />} onClick={() => setStatus(project.id, done ? "active" : "done")}>
                {done ? t("projects.reopen") : t("projects.markDone")}
              </Button>
              <Tooltip title={t("projects.edit")}>
                <Button icon={<Pencil />} aria-label={t("projects.edit")} onClick={() => setDialog("edit")} />
              </Tooltip>
              <Dropdown trigger={["click"]} placement="bottomRight" menu={{ items: [{ key: "delete", danger: true, icon: <Trash2 />, label: t("projects.delete"), onClick: confirmDelete }] }}>
                <Button icon={<Ellipsis />} aria-label={t("shopping.lists.more")} />
              </Dropdown>
            </Can>
          ),
        }}
        summary={
          <><div>{projectExampleCover(project.id,project.name) && <ProjectCover src={projectExampleCover(project.id,project.name)!}/>}</div><Card style={{ marginBottom: token.marginLG }}>
            <Row gutter={[24, 16]} align="middle">
              <Col xs={24} md={8}>
                <Typography.Text type="secondary">{t("shopping.summary.total")}</Typography.Text>
                <div style={{ fontSize: token.fontSizeHeading2, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.2, color: budget.remainingCents !== undefined && budget.remainingCents < 0 ? token.colorError : undefined }}>
                  {money(budget.totalCents)}
                </div>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {budget.budgetCents !== undefined ? t("shopping.summary.ofBudget", { budget: money(budget.budgetCents) }) : t("shopping.budget.none")}
                </Typography.Text>
              </Col>
              <Col xs={24} md={16}>
                <BudgetBar currency={budget.currency} spentCents={budget.spentCents} pendingCents={budget.pendingCents} budgetCents={budget.budgetCents} />
                {(budget.unpriced > 0 || budget.otherCurrency > 0) && (
                  <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: token.fontSizeSM }}>
                    {[budget.unpriced > 0 && t("shopping.budget.unpricedHint", { count: budget.unpriced }), budget.otherCurrency > 0 && t("projects.otherCurrency", { count: budget.otherCurrency })].filter(Boolean).join(" ")}
                  </Typography.Text>
                )}
              </Col>
            </Row>
          </Card></>
        }
        sections={[{ id: "avance", header: { title: t("projects.workspace") }, content: <ProjectWorkspace project={project} totals={budget} /> },
          {
            id: "listas",
            header: {
              icon: ListChecks,
              color: project.color,
              title: t("projects.lists"),
              description: t("projects.listCount", { count: lists.length }),
              extra: canManageLists && !done && (
                <Button icon={<Plus />} onClick={() => setDialog("list")}>
                  {t("projects.newList")}
                </Button>
              ),
            },
            content:
              lists.length === 0 ? (
                <Card>
                  <EmptyState icon={Plus} title={t("projects.noListsTitle")} description={t("projects.noListsText")} />
                </Card>
              ) : (
                <ListGrid items={lists} getKey={(list) => list.list.id} renderItem={(list) => <ListCard summary={list} />} />
              ),
          },
        ]}
      >
        <ProjectModal open={dialog === "edit"} project={project} onClose={() => setDialog(null)} />
        <ListModal open={dialog === "list"} projectId={project.id} initialPrivacy={project.privacy ?? "family"} onClose={() => setDialog(null)} onSaved={(listId) => router.push(`/compras?lista=${listId}`)} />
      </DetailPage>
    </RequirePermission>
  );
}

function ListCard({ summary }: { summary: ListSummary }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { list, budget, pending, bought } = summary;

  return (
    <Link href={`/compras?lista=${list.id}`} style={{ display: "block", height: "100%" }}>
      <Card hoverable size="small" styles={{ body: { padding: 16 } }} style={{ height: "100%", opacity: list.archivedAt ? 0.6 : 1 }}>
        <Flex vertical gap={12}>
          <Flex align="center" gap={10}>
            <IconTile icon={APPEARANCE_ICONS[list.icon]} color={list.color} size={36} />
            <Flex vertical style={{ minWidth: 0, flex: 1 }}>
              <Typography.Text strong ellipsis>
                {listName(list, t)}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t("projects.listProgress", { pending, bought })}
              </Typography.Text>
            </Flex>
            {list.archivedAt && <Tag>{t("shopping.lists.archived")}</Tag>}
          </Flex>
          <Flex justify="space-between" style={{ fontSize: token.fontSizeSM }}>
            <Typography.Text type="secondary" style={{ fontSize: "inherit" }}>
              {t("shopping.summary.total")}
            </Typography.Text>
            <Typography.Text strong style={{ fontSize: "inherit" }}>
              {format.money(budget.totalCents, budget.currency)}
              {budget.budgetCents !== undefined && (
                <Typography.Text type="secondary" style={{ fontSize: "inherit", fontWeight: 400 }}>
                  {" "}
                  / {format.money(budget.budgetCents, budget.currency)}
                </Typography.Text>
              )}
            </Typography.Text>
          </Flex>
          <BudgetBar compact currency={budget.currency} spentCents={budget.spentCents} pendingCents={budget.pendingCents + budget.boughtEstimateCents} budgetCents={budget.budgetCents} />
        </Flex>
      </Card>
    </Link>
  );
}
