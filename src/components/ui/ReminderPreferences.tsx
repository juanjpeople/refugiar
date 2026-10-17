"use client";

import { Button, Flex, Form, Select, Typography } from "antd";
import { useI18n } from "@/i18n";
import { Reveal } from "@/components/motion";

export function ReminderPreferences({ events, selected, minutes, busy, onChange, onSave }: {
  events: { value: string; label: string }[]; selected: string[]; minutes: number; busy: boolean;
  onChange: (value: { events: string[]; minutes: number }) => void; onSave: () => void;
}) {
  const { t } = useI18n();
  return <Reveal><Form layout="vertical" onFinish={onSave} disabled={busy}>
    <Flex vertical gap="middle">
      <Typography.Paragraph>{t("reminders.hint")}</Typography.Paragraph>
      <Form.Item label={t("reminders.events")}><Select aria-label={t("reminders.events")} mode="multiple" value={selected} options={events} optionFilterProp="label" onChange={events => onChange({ events, minutes })} /></Form.Item>
      <Form.Item label={t("reminders.before")}><Select aria-label={t("reminders.before")} value={minutes} options={[0, 15, 60].map(value => ({ value, label: value ? t("reminders.minutes", { count: value }) : t("reminders.atTime") }))} onChange={minutes => onChange({ events: selected, minutes })} /></Form.Item>
      <Typography.Text type="secondary">{t("reminders.limits")}</Typography.Text>
      <Button type="primary" htmlType="submit" loading={busy}>{t("reminders.save")}</Button>
    </Flex>
  </Form></Reveal>;
}
