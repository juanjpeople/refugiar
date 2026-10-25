import { Card, Col, Flex, Row, Statistic, Table, Typography, theme } from "antd";
import { Activity, Compass, Download, Eye, Users } from "lucide-react";
import { useMemo, useState } from "react";

export interface DailyMetricEntry {
  day: string;
  metric: string;
  count: number;
}

const METRIC_LABELS: Record<string, string> = {
  landing: "Portada / Landing",
  demo_open: "Apertura Demo",
  pwa_boot: "Inicio PWA",
  android_boot: "Inicio Android",
  waitlist_submit: "Anotados Lista de Espera",
  "module:recipes": "Visitas a Recetas",
  "module:inventory": "Visitas a Inventario",
  "module:projects": "Visitas a Proyectos",
};

export function OperatorTraffic({ metrics }: { metrics: DailyMetricEntry[] }) {
  const { token } = theme.useToken();
  const [mountedAt] = useState(() => Date.now());

  const { stats7d, stats30d } = useMemo(() => {
    const cut7 = new Date(mountedAt - 7 * 86_400_000).toISOString().slice(0, 10);
    const cut30 = new Date(mountedAt - 30 * 86_400_000).toISOString().slice(0, 10);

    const s7: Record<string, number> = {};
    const s30: Record<string, number> = {};

    for (const m of metrics) {
      if (m.day >= cut7) s7[m.metric] = (s7[m.metric] || 0) + m.count;
      if (m.day >= cut30) s30[m.metric] = (s30[m.metric] || 0) + m.count;
    }
    return { stats7d: s7, stats30d: s30 };
  }, [metrics, mountedAt]);

  const appBoots7d = (stats7d["pwa_boot"] || 0) + (stats7d["android_boot"] || 0);
  const appBoots30d = (stats30d["pwa_boot"] || 0) + (stats30d["android_boot"] || 0);

  return (
    <Flex vertical gap={token.marginMD}>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        Telemetría anónima agregada en D1 (sin guardar IP, sin cookies, sin seguimiento personal).
      </Typography.Paragraph>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Visitas Portada (7d / 30d)"
              value={stats7d["landing"] || 0}
              suffix={`/ ${stats30d["landing"] || 0}`}
              prefix={<Eye />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Aperturas Demo (7d / 30d)"
              value={stats7d["demo_open"] || 0}
              suffix={`/ ${stats30d["demo_open"] || 0}`}
              prefix={<Compass />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Inicios App (7d / 30d)"
              value={appBoots7d}
              suffix={`/ ${appBoots30d}`}
              prefix={<Download />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Lista de espera (7d / 30d)"
              value={stats7d["waitlist_submit"] || 0}
              suffix={`/ ${stats30d["waitlist_submit"] || 0}`}
              prefix={<Users />}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Uso por Módulo (Últimos 30 días)">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Statistic
              title="Recetas"
              value={stats30d["module:recipes"] || 0}
              prefix={<Activity />}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="Inventario"
              value={stats30d["module:inventory"] || 0}
              prefix={<Activity />}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="Proyectos"
              value={stats30d["module:projects"] || 0}
              prefix={<Activity />}
            />
          </Col>
        </Row>
      </Card>

      <Typography.Title level={5} style={{ margin: 0, marginTop: token.marginSM }}>
        Registro Diario de Tráfico
      </Typography.Title>
      <Table
        scroll={{ x: "max-content" }}
        rowKey={(row) => `${row.day}:${row.metric}`}
        dataSource={metrics}
        pagination={{ pageSize: 15 }}
        columns={[
          { title: "Día (UTC)", dataIndex: "day" },
          {
            title: "Métrica",
            dataIndex: "metric",
            render: (value: string) => METRIC_LABELS[value] || value,
          },
          { title: "Ocurrencias", dataIndex: "count" },
        ]}
      />
    </Flex>
  );
}
