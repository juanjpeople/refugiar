"use client";

import { Button, Flex, Form, Select, Switch, Typography } from "antd";
import { useI18n } from "@/i18n";
import { Reveal } from "@/components/motion";

export interface ReminderValue { events: string[]; minutes: number; all?: boolean; tasks?: boolean }

/** Minutos antes de cada evento que se pueden elegir (0: a la hora; 1440: el día anterior). */
const MINUTES = [0, 15, 60, 1440];

/**
 * Qué avisa este perfil en este dispositivo: todos los eventos o algunos, cuánto antes, y las
 * tareas de proyectos con fecha. Sólo describe; quien la usa guarda y agenda.
 */
export function ReminderPreferences({ events, selected, minutes, all = false, tasks = false, busy, onChange, onSave }: {
  events: { value: string; label: string }[]; selected: string[]; minutes: number; all?: boolean; tasks?: boolean; busy: boolean;
  onChange: (value: ReminderValue) => void; onSave: () => void;
}) {
  const { t } = useI18n();
  const value = { events: selected, minutes, all, tasks };
  const label = (count: number) => count === 0 ? t("reminders.atTime") : count === 1440 ? t("reminders.dayBefore") : t("reminders.minutes", { count });
  return <Reveal><Form layout="vertical" onFinish={onSave} disabled={busy}>
    <Flex vertical gap="middle">
      <Typography.Paragraph>{t("reminders.hint")}</Typography.Paragraph>
      <Flex align="center" justify="space-between" gap="middle">
        <Flex vertical><Typography.Text strong>{t("reminders.all")}</Typography.Text><Typography.Text type="secondary">{t("reminders.allHint")}</Typography.Text></Flex>
        <Switch aria-label={t("reminders.all")} checked={all} onChange={checked => onChange({ ...value, all: checked })} />
      </Flex>
      {!all && <Form.Item label={t("reminders.events")}><Select aria-label={t("reminders.events")} mode="multiple" value={selected} options={events} optionFilterProp="label" onChange={events => onChange({ ...value, events })} /></Form.Item>}
      <Form.Item label={t("reminders.before")}><Select aria-label={t("reminders.before")} value={minutes} options={MINUTES.map(count => ({ value: count, label: label(count) }))} onChange={minutes => onChange({ ...value, minutes })} /></Form.Item>
      <Flex align="center" justify="space-between" gap="middle">
        <Flex vertical><Typography.Text strong>{t("reminders.tasks")}</Typography.Text><Typography.Text type="secondary">{t("reminders.tasksHint")}</Typography.Text></Flex>
        <Switch aria-label={t("reminders.tasks")} checked={tasks} onChange={checked => onChange({ ...value, tasks: checked })} />
      </Flex>
      <Typography.Text type="secondary">{t("reminders.limits")}</Typography.Text>
      <Button type="primary" htmlType="submit" loading={busy}>{t("reminders.save")}</Button>
    </Flex>
  </Form></Reveal>;
}
