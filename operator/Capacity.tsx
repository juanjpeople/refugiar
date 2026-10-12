import { Alert, App, Button, Card, Col, Descriptions, Flex, Form, InputNumber, Modal, Progress, Row, Skeleton, Statistic, Table, Tag, Typography, theme } from "antd";
import { Gauge, Hourglass, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { api, date, getErrorMessage, useT } from "./support";

type QuotaKind = "ops" | "log" | "photos";
interface Quotas { opsPerDay: number; logBytes: number; photoBytes: number }
type QuotaOverride = { [K in keyof Quotas]: number | null };

export interface CapacityData {
  enforced: boolean;
  households: { total: number; active: number };
  waiting: number;
  photos: { bytes: number; freeBytes: number };
  defaults: Quotas;
  codeDefaults: Quotas;
  hits: { householdId: string; kind: QuotaKind; at: number }[];
  overrides: ({ householdId: string } & QuotaOverride)[];
}

const MB = 1024 * 1024;
const toMB = (bytes: number) => Math.round(bytes / MB);
const mb = (bytes: number) => `${toMB(bytes).toLocaleString("es-AR")} MB`;
const shortId = (value: string) => `${value.slice(0, 8)}…`;

/**
 * Capacidad: para decidir si habilitar más casas o contratar un plan. Muestra casas, lista de
 * espera, fotos sobre la capa gratuita y qué casas llegaron a su tope. Desde acá se cambian los
 * topes de todas las casas, sin deploy.
 */
export function OperatorCapacity({ capacity, busy, onSaveDefaults, onOpenHousehold }: {
  capacity: CapacityData;
  busy: boolean;
  onSaveDefaults: (quotas: Quotas) => Promise<unknown>;
  onOpenHousehold: (id: string) => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const photoPercent = Math.min(100, Math.round((capacity.photos.bytes / capacity.photos.freeBytes) * 100));
  const watched = [...new Set([...capacity.hits.map((hit) => hit.householdId), ...capacity.overrides.map((entry) => entry.householdId)])].map((id) => ({
    id,
    hits: capacity.hits.filter((hit) => hit.householdId === id),
    own: capacity.overrides.some((entry) => entry.householdId === id),
  }));

  return (
    <Flex vertical gap={token.margin}>
      {!capacity.enforced && <Alert type="info" showIcon title={t("platformAdmin.capacity.off")} />}
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Card><Statistic title={t("platformAdmin.capacity.households")} value={capacity.households.active} prefix={<Gauge />} />
            <Typography.Text type="secondary">{t("platformAdmin.capacity.householdsOf", { active: capacity.households.active, total: capacity.households.total })}</Typography.Text></Card>
        </Col>
        <Col xs={24} md={8}>
          <Card><Statistic title={t("platformAdmin.capacity.waiting")} value={capacity.waiting} prefix={<Hourglass />} /></Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title={t("platformAdmin.capacity.photos")} value={mb(capacity.photos.bytes)} prefix={<ImageIcon />} />
            <Progress percent={photoPercent} status={photoPercent >= 80 ? "exception" : "normal"} size="small" />
            <Typography.Text type="secondary">{t("platformAdmin.capacity.photosOf", { free: mb(capacity.photos.freeBytes) })}</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: token.fontSizeSM }}>{t("platformAdmin.capacity.photosNote")}</Typography.Paragraph>
          </Card>
        </Col>
      </Row>
      <Card title={t("platformAdmin.capacity.defaults")}>
        <Typography.Paragraph type="secondary">{t("platformAdmin.capacity.defaultsHelp")}</Typography.Paragraph>
        <Form layout="vertical" requiredMark={false} disabled={busy}
          initialValues={{ opsPerDay: capacity.defaults.opsPerDay, logMB: toMB(capacity.defaults.logBytes), photoMB: toMB(capacity.defaults.photoBytes) }}
          onFinish={(values: { opsPerDay: number; logMB: number; photoMB: number }) => onSaveDefaults({ opsPerDay: values.opsPerDay, logBytes: values.logMB * MB, photoBytes: values.photoMB * MB })}>
          <Row gutter={12}>
            <Col xs={24} md={8}><Form.Item name="opsPerDay" label={t("platformAdmin.capacity.opsPerDay")} rules={[{ required: true }]}><InputNumber min={10} max={1_000_000} style={{ width: "100%" }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="logMB" label={t("platformAdmin.capacity.logMB")} rules={[{ required: true }]}><InputNumber min={1} max={10_240} style={{ width: "100%" }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="photoMB" label={t("platformAdmin.capacity.photoMB")} rules={[{ required: true }]}><InputNumber min={1} max={102_400} style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Flex align="center" gap={token.marginSM} wrap>
            <Button type="primary" htmlType="submit" loading={busy} style={{ minHeight: 44 }}>{t("platformAdmin.capacity.save")}</Button>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("platformAdmin.capacity.codeDefaults", { ops: capacity.codeDefaults.opsPerDay.toLocaleString("es-AR"), log: toMB(capacity.codeDefaults.logBytes), photos: toMB(capacity.codeDefaults.photoBytes) })}
            </Typography.Text>
          </Flex>
        </Form>
      </Card>
      <Card title={t("platformAdmin.capacity.watch")}>
        <Typography.Paragraph type="secondary">{t("platformAdmin.capacity.watchHelp")}</Typography.Paragraph>
        <Table scroll={{ x: "max-content" }} rowKey="id" dataSource={watched} pagination={{ pageSize: 10 }} locale={{ emptyText: t("platformAdmin.capacity.watchEmpty") }}
          columns={[
            { title: t("operator.id"), dataIndex: "id", render: (id: string) => <Typography.Text copyable={{ text: id }}>{shortId(id)}</Typography.Text> },
            {
              title: t("platformAdmin.capacity.reached"),
              render: (_: unknown, row: (typeof watched)[number]) => <Flex gap={4} wrap>{row.hits.map((hit) => <Tag key={hit.kind} color="orange">{t(`platformAdmin.capacity.kinds.${hit.kind}`)} · {date(hit.at)}</Tag>)}</Flex>,
            },
            { title: t("platformAdmin.capacity.own"), render: (_: unknown, row: (typeof watched)[number]) => (row.own ? <Tag color="blue">{t("platformAdmin.capacity.ownYes")}</Tag> : "—") },
            { title: t("platformAdmin.actions"), render: (_: unknown, row: (typeof watched)[number]) => <Button style={{ minHeight: 44 }} onClick={() => onOpenHousehold(row.id)}>{t("platformAdmin.capacity.open")}</Button> },
          ]}
        />
      </Card>
    </Flex>
  );
}

interface HouseholdUsage {
  usage: { opsToday: number; logBytes: number; photoBytes: number };
  limits: Quotas;
  override: QuotaOverride | null;
}

/** Uso y topes de una casa. Cuenta operaciones y bytes cifrados: nunca ve contenido. */
export function HouseholdQuotaModal({ householdId, onClose, onSaved }: { householdId: string | null; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  return (
    <Modal open={Boolean(householdId)} title={householdId ? t("platformAdmin.householdQuota.title", { id: shortId(householdId) }) : null} onCancel={onClose} footer={null} width={560} destroyOnHidden>
      {householdId && <HouseholdQuota key={householdId} householdId={householdId} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function HouseholdQuota({ householdId, onClose, onSaved }: { householdId: string; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [data, setData] = useState<HouseholdUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<HouseholdUsage>("GET", `/api/admin/platform/households/${householdId}/usage`)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((failure: unknown) => { if (!cancelled) setError(getErrorMessage(failure)); });
    return () => { cancelled = true; };
  }, [householdId]);

  async function save(override: QuotaOverride) {
    setSaving(true);
    setError(null);
    try {
      await api("PUT", `/api/admin/platform/households/${householdId}/quotas`, override);
      void message.success(t("platformAdmin.householdQuota.saved"));
      onSaved();
      onClose();
    } catch (failure) {
      setError(getErrorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  const meter = (used: number, limit: number, format: (value: number) => string) => (
    <Flex vertical style={{ minWidth: 200 }}>
      <Typography.Text>{t("platformAdmin.householdQuota.of", { used: format(used), limit: format(limit) })}</Typography.Text>
      <Progress percent={Math.min(100, Math.round((used / limit) * 100))} size="small" status={used >= limit ? "exception" : "normal"} />
    </Flex>
  );
  const count = (value: number) => value.toLocaleString("es-AR");

  return (
    <>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: token.margin }} />}
      {!data && !error && <Skeleton active />}
      {data && (
        <Flex vertical gap={token.margin}>
          <Descriptions column={1} size="small" items={[
            { key: "today", label: t("platformAdmin.householdQuota.today"), children: meter(data.usage.opsToday, data.limits.opsPerDay, count) },
            { key: "log", label: t("platformAdmin.householdQuota.log"), children: meter(data.usage.logBytes, data.limits.logBytes, mb) },
            { key: "photos", label: t("platformAdmin.householdQuota.photos"), children: meter(data.usage.photoBytes, data.limits.photoBytes, mb) },
          ]} />
          <Form layout="vertical" requiredMark={false} disabled={saving}
            initialValues={{
              opsPerDay: data.override?.opsPerDay ?? undefined,
              logMB: data.override?.logBytes ? toMB(data.override.logBytes) : undefined,
              photoMB: data.override?.photoBytes ? toMB(data.override.photoBytes) : undefined,
            }}
            onFinish={(values: { opsPerDay?: number | null; logMB?: number | null; photoMB?: number | null }) => save({
              opsPerDay: values.opsPerDay ?? null,
              logBytes: values.logMB ? values.logMB * MB : null,
              photoBytes: values.photoMB ? values.photoMB * MB : null,
            })}>
            <Typography.Text strong>{t("platformAdmin.householdQuota.own")}</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("platformAdmin.householdQuota.ownHelp")}</Typography.Paragraph>
            <Row gutter={12}>
              <Col xs={24} md={8}><Form.Item name="opsPerDay" label={t("platformAdmin.capacity.opsPerDay")}><InputNumber min={10} max={1_000_000} style={{ width: "100%" }} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="logMB" label={t("platformAdmin.capacity.logMB")}><InputNumber min={1} max={10_240} style={{ width: "100%" }} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="photoMB" label={t("platformAdmin.capacity.photoMB")}><InputNumber min={1} max={102_400} style={{ width: "100%" }} /></Form.Item></Col>
            </Row>
            <Flex gap={token.marginXS} wrap>
              <Button type="primary" htmlType="submit" loading={saving} style={{ minHeight: 44 }}>{t("platformAdmin.householdQuota.save")}</Button>
              {data.override && <Button disabled={saving} style={{ minHeight: 44 }} onClick={() => save({ opsPerDay: null, logBytes: null, photoBytes: null })}>{t("platformAdmin.householdQuota.reset")}</Button>}
            </Flex>
          </Form>
        </Flex>
      )}
    </>
  );
}
