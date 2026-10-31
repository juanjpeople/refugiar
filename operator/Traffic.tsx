import { Card, Col, Descriptions, Flex, Progress, Row, Statistic, Table, Tag, Typography, theme } from "antd";
import { Activity, Compass, Download, Eye, Smartphone, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { CapacityData } from "./Capacity";
import { date, useT } from "./support";

export interface DailyMetricEntry {
  day: string;
  metric: string;
  count: number;
}

export interface TrafficOverviewSummary {
  metrics: {
    users: number;
    households: number;
    activeHouseholds: number;
    pausedHouseholds: number;
    activeSessions: number;
    licenses: number;
    availableLicenses: number;
    openFeedback: number;
    pendingNotices: number;
    waiting: number;
  };
  recentAudit: { action: string; targetType: string; targetId: string; createdAt: number; actorEmail?: string }[];
}

export interface TrafficMailSummary {
  config: "disabled" | "incomplete" | "configured";
  counts: Record<string, number>;
  usage: { daily: number; monthly: number };
  limits: { daily: number; monthly: number };
}

const MODULE_KEYS = [
  "module:dashboard",
  "module:inventory",
  "module:shopping",
  "module:recipes",
  "module:projects",
  "module:calendar",
  "module:pets",
  "module:family",
] as const;

const MB = 1024 * 1024;
const formatMB = (bytes: number) => `${Math.round(bytes / MB).toLocaleString("es-AR")} MB`;

export function OperatorTraffic({
  metrics,
  overview,
  capacity,
  mail,
}: {
  metrics: DailyMetricEntry[];
  overview?: TrafficOverviewSummary;
  capacity?: CapacityData;
  mail?: TrafficMailSummary;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const [mountedAt] = useState(() => Date.now());

  const { todayStats, stats7d, stats30d, totalToday, total7d, total30d } = useMemo(() => {
    const today = new Date(mountedAt).toISOString().slice(0, 10);
    const cut7 = new Date(mountedAt - 7 * 86_400_000).toISOString().slice(0, 10);
    const cut30 = new Date(mountedAt - 30 * 86_400_000).toISOString().slice(0, 10);

    const sToday: Record<string, number> = {};
    const s7: Record<string, number> = {};
    const s30: Record<string, number> = {};
    let tToday = 0;
    let t7 = 0;
    let t30 = 0;

    for (const m of metrics) {
      if (m.day === today) {
        sToday[m.metric] = (sToday[m.metric] || 0) + m.count;
        tToday += m.count;
      }
      if (m.day >= cut7) {
        s7[m.metric] = (s7[m.metric] || 0) + m.count;
        t7 += m.count;
      }
      if (m.day >= cut30) {
        s30[m.metric] = (s30[m.metric] || 0) + m.count;
        t30 += m.count;
      }
    }
    return { todayStats: sToday, stats7d: s7, stats30d: s30, totalToday: tToday, total7d: t7, total30d: t30 };
  }, [metrics, mountedAt]);

  const moduleRows = useMemo(() => {
    const list = MODULE_KEYS.map((key) => ({
      key,
      label: t(`platformAdmin.traffic.metricLabels.${key}`),
      count7d: stats7d[key] || 0,
      count30d: stats30d[key] || 0,
    })).sort((a, b) => b.count30d - a.count30d);
    const max30d = Math.max(1, ...list.map((item) => item.count30d));
    return list.map((item) => ({ ...item, percent: Math.round((item.count30d / max30d) * 100) }));
  }, [stats7d, stats30d, t]);

  const pulseCards = [
    { key: "landing", title: t("platformAdmin.traffic.landing"), today: todayStats["landing"] || 0, d7: stats7d["landing"] || 0, d30: stats30d["landing"] || 0, Icon: Eye },
    { key: "demo_open", title: t("platformAdmin.traffic.demoOpen"), today: todayStats["demo_open"] || 0, d7: stats7d["demo_open"] || 0, d30: stats30d["demo_open"] || 0, Icon: Compass },
    { key: "pwa_boot", title: t("platformAdmin.traffic.pwaBoot"), today: todayStats["pwa_boot"] || 0, d7: stats7d["pwa_boot"] || 0, d30: stats30d["pwa_boot"] || 0, Icon: Download },
    { key: "android_boot", title: t("platformAdmin.traffic.androidBoot"), today: todayStats["android_boot"] || 0, d7: stats7d["android_boot"] || 0, d30: stats30d["android_boot"] || 0, Icon: Smartphone },
    { key: "waitlist_submit", title: t("platformAdmin.traffic.waitlistSubmit"), today: todayStats["waitlist_submit"] || 0, d7: stats7d["waitlist_submit"] || 0, d30: stats30d["waitlist_submit"] || 0, Icon: Users },
    { key: "total", title: t("platformAdmin.traffic.totalEvents"), today: totalToday, d7: total7d, d30: total30d, Icon: TrendingUp },
  ] as const;

  const photoPercent = capacity ? Math.min(100, Math.round((capacity.photos.bytes / capacity.photos.freeBytes) * 100)) : 0;

  return (
    <Flex vertical gap={token.marginMD}>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        {t("platformAdmin.traffic.intro")}
      </Typography.Paragraph>

      <Card size="small" title={t("platformAdmin.traffic.pulseTitle")}>
        <Row gutter={[16, 16]}>
          {pulseCards.map(({ key, title, today, d7, d30, Icon }) => (
            <Col xs={24} sm={12} lg={8} key={key}>
              <Card size="small">
                <Flex vertical gap={token.marginXXS}>
                  <Statistic
                    title={title}
                    value={d7}
                    suffix={`/ ${d30}`}
                    prefix={<Icon />}
                  />
                  <Flex align="center" justify="space-between">
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      {t("platformAdmin.traffic.periodHint")}
                    </Typography.Text>
                    <Tag color={today > 0 ? "green" : "default"}>
                      {t("platformAdmin.traffic.todayLabel", { count: today })}
                    </Tag>
                  </Flex>
                </Flex>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card size="small" title={t("platformAdmin.traffic.modulesTitle")}>
            <Flex vertical gap={token.marginSM}>
              {moduleRows.map((row) => (
                <Flex key={row.key} vertical gap={2}>
                  <Flex justify="space-between" align="center" wrap gap={token.marginXS}>
                    <Flex align="center" gap={token.marginXS}>
                      <Activity />
                      <Typography.Text strong>{row.label}</Typography.Text>
                    </Flex>
                    <Flex gap={token.marginXS}>
                      <Tag>{t("platformAdmin.traffic.module7d", { count: row.count7d })}</Tag>
                      <Tag color="green">{t("platformAdmin.traffic.module30d", { count: row.count30d })}</Tag>
                    </Flex>
                  </Flex>
                  <Progress percent={row.count30d > 0 ? row.percent : 0} showInfo={false} size="small" />
                </Flex>
              ))}
            </Flex>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card size="small" title={t("platformAdmin.traffic.cloudTitle")}>
            <Flex vertical gap={token.marginSM}>
              {overview && (
                <Descriptions
                  size="small"
                  column={1}
                  items={[
                    { key: "users", label: t("platformAdmin.metrics.users"), children: overview.metrics.users },
                    { key: "active", label: t("platformAdmin.metrics.active"), children: `${overview.metrics.activeHouseholds} / ${overview.metrics.households}` },
                    { key: "sessions", label: t("platformAdmin.metrics.sessions"), children: overview.metrics.activeSessions },
                    { key: "waiting", label: t("platformAdmin.metrics.waiting"), children: overview.metrics.waiting },
                    { key: "licenses", label: t("platformAdmin.metrics.availableLicenses"), children: `${overview.metrics.availableLicenses} / ${overview.metrics.licenses}` },
                  ]}
                />
              )}
              {capacity && (
                <Flex vertical gap={4}>
                  <Flex justify="space-between">
                    <Typography.Text type="secondary">{t("platformAdmin.traffic.photosUsed")}</Typography.Text>
                    <Typography.Text strong>{formatMB(capacity.photos.bytes)} / {formatMB(capacity.photos.freeBytes)}</Typography.Text>
                  </Flex>
                  <Progress percent={photoPercent} size="small" />
                </Flex>
              )}
              {mail && (
                <Descriptions
                  size="small"
                  column={1}
                  items={[
                    { key: "mailDaily", label: t("platformAdmin.traffic.mailToday"), children: `${mail.usage?.daily ?? 0} / ${mail.limits.daily}` },
                    { key: "mailMonthly", label: t("platformAdmin.traffic.mailMonth"), children: `${mail.usage?.monthly ?? 0} / ${mail.limits.monthly}` },
                  ]}
                />
              )}
            </Flex>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" title={t("platformAdmin.traffic.dailyTitle")}>
            <Table
              scroll={{ x: "max-content" }}
              rowKey={(row) => `${row.day}:${row.metric}`}
              dataSource={metrics}
              pagination={{ pageSize: 10 }}
              size="small"
              columns={[
                { title: t("platformAdmin.traffic.dayCol"), dataIndex: "day" },
                {
                  title: t("platformAdmin.traffic.metricCol"),
                  dataIndex: "metric",
                  render: (value: string) => t(`platformAdmin.traffic.metricLabels.${value}`),
                },
                { title: t("platformAdmin.traffic.countCol"), dataIndex: "count" },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title={t("platformAdmin.traffic.auditTitle")}>
            <Table
              scroll={{ x: "max-content" }}
              rowKey={(row) => `${row.createdAt}:${row.action}:${row.targetId}`}
              dataSource={overview?.recentAudit ?? []}
              locale={{ emptyText: t("platformAdmin.traffic.auditEmpty") }}
              pagination={{ pageSize: 10 }}
              size="small"
              columns={[
                { title: t("platformAdmin.traffic.auditAction"), dataIndex: "action", render: (value: string) => <Tag>{value}</Tag> },
                { title: t("platformAdmin.traffic.auditTarget"), render: (_: unknown, row: TrafficOverviewSummary["recentAudit"][number]) => `${row.targetType} · ${row.targetId.slice(0, 8)}` },
                { title: t("platformAdmin.traffic.auditDate"), dataIndex: "createdAt", render: date },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
