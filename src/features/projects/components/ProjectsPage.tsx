"use client";
import { ProjectCover } from "@/components/ui";
import { projectExampleCover } from "../example-covers";

import { Button, Card, Flex, Segmented, Tag, Typography, theme } from "antd";
import { CheckCheck, HardHat, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { IconTile, ListPage, PrivacyBadge } from "@/components/ui";
import { BudgetBar } from "@/features/shopping/components/BudgetBar";
import { useI18n } from "@/i18n";
import { APPEARANCE_ICONS } from "@/lib/appearance";
import { useProjects, type ProjectSummary } from "../hooks";
import { ProjectModal } from "./ProjectModal";
import { projectHref } from "@/lib/navigation/routes";

type Show = "all" | "active" | "done";

export function ProjectsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const projects = useProjects();
  const [show, setShow] = useState<Show>("all");
  const [creating, setCreating] = useState(false);
  const visible = (projects ?? []).filter((summary) => show === "all" || summary.project.status === show);
  const doneCount = projects?.filter((summary) => summary.project.status === "done").length ?? 0;

  const newButton = (
    <Can perform="projects.manage">
      <Button type="primary" icon={<Plus />} onClick={() => setCreating(true)}>
        {t("projects.new")}
      </Button>
    </Can>
  );

  return (
    <RequirePermission perform="projects.view">
      <ListPage
        header={{ eyebrow: t("projects.eyebrow"), title: t("projects.title"), description: t("projects.description"), extra: newButton }}
        items={projects}
        visible={visible}
        getKey={(summary) => summary.project.id}
        renderItem={(summary) => <ProjectCard summary={summary} />}
        empty={{ icon: HardHat, title: t("projects.emptyTitle"), description: t("projects.emptyText"), action: newButton }}
        noMatch={{ icon: CheckCheck, title: t("projects.noActiveTitle"), description: t("projects.noActiveText") }}
        filters={
          doneCount > 0 && (
            <Segmented<Show>
              value={show}
              onChange={setShow}
              options={[
                { value: "all", label: t("projects.all") },
                { value: "active", label: t("projects.filter.active", { count: (projects?.length ?? 0) - doneCount }) },
                { value: "done", label: t("projects.filter.done", { count: doneCount }) },
              ]}
            />
          )
        }
        minItemWidth={300}
      />

      <ProjectModal open={creating} onClose={() => setCreating(false)} onSaved={(id) => router.push(projectHref(id))} />
    </RequirePermission>
  );
}

function ProjectCard({ summary }: { summary: ProjectSummary }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { project, lists, budget } = summary;
  const pending = lists.reduce((sum, list) => sum + list.pending, 0);

  return (
    <Link href={projectHref(project.id)} style={{ display: "block", height: "100%" }}>
      <Card hoverable style={{ height: "100%" }}>
        <Flex vertical gap={14}>
          {projectExampleCover(project.id,project.name) && <ProjectCover src={projectExampleCover(project.id,project.name)!}/>}
          <Flex align="center" gap={12}>
            <IconTile icon={APPEARANCE_ICONS[project.icon]} color={project.color} size={44} />
            <Flex vertical style={{ minWidth: 0, flex: 1 }}>
              <Flex align="center" gap={6} style={{ minWidth: 0 }}>
                <Typography.Title level={5} style={{ margin: 0, minWidth: 0 }} ellipsis>
                  {project.name}
                </Typography.Title>
                <PrivacyBadge privacy={project.privacy} />
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t("projects.listCount", { count: lists.length })} · {t("shopping.lists.pendingCount", { count: pending })}
              </Typography.Text>
            </Flex>
            {project.status === "done" && <Tag color="success">{t("projects.done")}</Tag>}
          </Flex>
          <div>
            <Flex justify="space-between" align="baseline" style={{ marginBottom: 6 }}>
              <Typography.Text style={{ fontSize: token.fontSizeHeading4, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {format.money(budget.totalCents, budget.currency)}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {budget.budgetCents !== undefined ? t("shopping.summary.ofBudget", { budget: format.money(budget.budgetCents, budget.currency) }) : t("shopping.budget.none")}
              </Typography.Text>
            </Flex>
            <BudgetBar compact currency={budget.currency} spentCents={budget.spentCents} pendingCents={budget.pendingCents} budgetCents={budget.budgetCents} />
          </div>
        </Flex>
      </Card>
    </Link>
  );
}
