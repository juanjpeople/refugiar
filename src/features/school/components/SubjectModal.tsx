"use client";

import { Checkbox, Col, DatePicker, Form, Input, Modal, Row, TimePicker, theme } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useRef, useState } from "react";
import { Callout } from "@/components/ui";
import { EVENT_LIMITS } from "@/features/calendar/domain";
import type { Member } from "@/features/members/domain";
import { useI18n } from "@/i18n";
import { DEFAULT_SCHOOL_DAYS, WEEKDAYS, weekdayDate, type SchoolProfile } from "../domain";
import { useSchoolActions } from "../hooks";

interface FormValues {
  title: string;
  weekdays: number[];
  time: [Dayjs, Dayjs];
  from: Dayjs;
  until: Dayjs;
  teacher?: string;
  notes?: string;
}

const at = (value: string | undefined, fallback: number) => {
  const [hours, minutes] = value ? value.split(":").map(Number) : [fallback, 0];
  return dayjs().hour(hours).minute(minutes).second(0);
};

/** Nueva materia: una clase semanal por cada día elegido, del primer día al fin de clases. */
export function SubjectModal({ member, profile, onClose }: { member: Member; profile?: SchoolProfile; onClose: () => void }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const [form] = Form.useForm<FormValues>();
  const { addSubject } = useSchoolActions();
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const days = profile?.days.length ? profile.days : DEFAULT_SCHOOL_DAYS;
  const start = at(profile?.entry, 8);

  async function onOk() {
    if (pending.current) return;
    pending.current = true;
    try {
      const values = await form.validateFields().catch(() => null);
      if (!values) return;
      setSaving(true);
      const ok = await addSubject({
        memberId: member.id,
        title: values.title,
        weekdays: values.weekdays,
        start: values.time[0].format("HH:mm"),
        end: values.time[1].format("HH:mm"),
        from: values.from.startOf("day").valueOf(),
        until: values.until.endOf("day").valueOf(),
        teacher: values.teacher,
        notes: values.notes,
        color: member.color,
      });
      if (ok) onClose();
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={t("schoolPage.subjectForm.title", { name: member.name })}
      onCancel={() => { if (!pending.current) onClose(); }}
      onOk={() => void onOk()}
      okText={t("schoolPage.subjectForm.save")}
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      width={620}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={saving}
        onFinish={() => void onOk()}
        initialValues={{
          weekdays: [],
          time: [start, start.add(1, "hour")],
          from: dayjs(),
          until: profile?.termEnd ? dayjs(profile.termEnd) : undefined,
        }}
      >
        <Form.Item name="title" label={t("schoolPage.subjectForm.name")} rules={[{ required: true, whitespace: true, message: t("schoolPage.subjectForm.nameRequired") }, { max: EVENT_LIMITS.titleMaxLength, message: t("errors.validation.nameTooLong", { max: EVENT_LIMITS.titleMaxLength }) }]}>
          <Input autoFocus placeholder={t("schoolPage.subjectForm.namePlaceholder")} />
        </Form.Item>
        <Form.Item name="weekdays" label={t("schoolPage.subjectForm.weekdays")} extra={t("schoolPage.subjectForm.weekdaysHelp")} rules={[{ required: true, type: "array", min: 1, message: t("schoolPage.subjectForm.weekdaysRequired") }]}>
          <Checkbox.Group options={WEEKDAYS.filter((day) => days.includes(day)).map((day) => ({ value: day, label: format.date(weekdayDate(day), { weekday: "long" }) }))} />
        </Form.Item>
        <Form.Item
          name="time"
          label={t("schoolPage.subjectForm.time")}
          rules={[{ required: true, message: t("schoolPage.subjectForm.timeRequired") }, { validator: (_, value?: [Dayjs, Dayjs]) => !value || value[1].format("HH:mm") > value[0].format("HH:mm") ? Promise.resolve() : Promise.reject(new Error(t("schoolPage.form.exitAfterEntry"))) }]}
        >
          <TimePicker.RangePicker format="HH:mm" minuteStep={5} needConfirm={false} style={{ width: "100%" }} />
        </Form.Item>
        <Row gutter={token.margin}>
          <Col xs={24} sm={12}>
            <Form.Item name="from" label={t("schoolPage.subjectForm.from")} rules={[{ required: true, message: t("schoolPage.subjectForm.fromRequired") }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="until"
              label={t("schoolPage.fields.termEnd")}
              dependencies={["from"]}
              rules={[{ required: true, message: t("school.termRequired") }, ({ getFieldValue }) => ({ validator: (_, value?: Dayjs) => {
                const from = getFieldValue("from") as Dayjs | undefined;
                return !value || !from || !value.isBefore(from, "day") ? Promise.resolve() : Promise.reject(new Error(t("schoolPage.subjectForm.untilAfterFrom")));
              } })]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="teacher" label={t("schoolPage.subjectForm.teacher")} rules={[{ max: EVENT_LIMITS.teacherMaxLength, message: t("errors.validation.nameTooLong", { max: EVENT_LIMITS.teacherMaxLength }) }]}>
          <Input />
        </Form.Item>
        <Form.Item name="notes" label={t("school.backpack")} rules={[{ max: EVENT_LIMITS.notesMaxLength, message: t("errors.validation.nameTooLong", { max: EVENT_LIMITS.notesMaxLength }) }]}>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} placeholder={t("schoolPage.subjectForm.notesPlaceholder")} />
        </Form.Item>
        <Callout>{t("schoolPage.subjectForm.help")}</Callout>
      </Form>
    </Modal>
  );
}
