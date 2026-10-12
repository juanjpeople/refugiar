"use client";

import { AutoComplete, Checkbox, Col, DatePicker, Form, Input, Modal, Row, Select, TimePicker, Typography, theme } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useRef, useState } from "react";
import { Callout, ChoiceCards } from "@/components/ui";
import type { Member } from "@/features/members/domain";
import { useMembers } from "@/features/members/hooks";
import { useI18n } from "@/i18n";
import { COMMUTES, DEFAULT_SCHOOL_DAYS, SCHOOL_LIMITS, SHIFTS, WEEKDAYS, weekdayDate, type Commute, type SchoolProfile, type Shift } from "../domain";
import { useSchoolActions } from "../hooks";

interface FormValues {
  schoolName?: string;
  grade?: string;
  shift?: Shift;
  entry?: Dayjs;
  exit?: Dayjs;
  days: number[];
  termEnd?: Dayjs;
  address?: string;
  phone?: string;
  toSchool?: Commute;
  dropOff?: string;
  fromSchool?: Commute;
  pickUp?: string;
  commuteNotes?: string;
  notes?: string;
}

const time = (value?: string) => {
  if (!value) return undefined;
  const [hours, minutes] = value.split(":").map(Number);
  return dayjs().hour(hours).minute(minutes).second(0);
};

/** Ficha escolar de un chico: si va, a cuál, horarios, cómo llega y vuelve, y detalles. */
export function SchoolProfileModal({ member, profile, onClose }: { member: Member; profile?: SchoolProfile; onClose: () => void }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const [form] = Form.useForm<FormValues>();
  const members = useMembers() ?? [];
  const { saveProfile } = useSchoolActions();
  const [attends, setAttends] = useState<"yes" | "no">(profile?.attends === false ? "no" : "yes");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const people = members.filter((entry) => entry.role !== "kid").map((entry) => ({ value: entry.name.replace(/ \(demo\)$/, "") }));

  async function onOk() {
    if (pending.current) return;
    pending.current = true;
    try {
      const values = await form.validateFields().catch(() => null);
      if (!values) return;
      setSaving(true);
      const ok = await saveProfile(member.id, attends === "no"
        ? { attends: false, days: [], notes: values.notes }
        : {
          ...values,
          attends: true,
          entry: values.entry?.format("HH:mm"),
          exit: values.exit?.format("HH:mm"),
          termEnd: values.termEnd?.format("YYYY-MM-DD"),
          days: values.days ?? [],
        });
      if (ok) onClose();
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const half = { xs: 24, sm: 12 };
  const text = (max: number = SCHOOL_LIMITS.textMaxLength) => [{ max, message: t("errors.validation.nameTooLong", { max }) }];

  return (
    <Modal
      open
      title={t("schoolPage.form.title", { name: member.name })}
      onCancel={() => { if (!pending.current) onClose(); }}
      onOk={() => void onOk()}
      okText={t("schoolPage.form.save")}
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      width={680}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={saving}
        onFinish={() => void onOk()}
        initialValues={{
          ...profile,
          entry: time(profile?.entry),
          exit: time(profile?.exit),
          termEnd: profile?.termEnd ? dayjs(profile.termEnd) : undefined,
          days: profile?.attends ? profile.days : DEFAULT_SCHOOL_DAYS,
        }}
      >
        <Form.Item label={t("schoolPage.form.attends")}>
          <ChoiceCards
            aria-label={t("schoolPage.form.attends")}
            value={attends}
            onChange={setAttends}
            compact
            options={[
              { value: "yes", title: t("schoolPage.form.attendsYes"), description: t("schoolPage.form.attendsYesHelp") },
              { value: "no", title: t("schoolPage.form.attendsNo"), description: t("schoolPage.form.attendsNoHelp") },
            ]}
          />
        </Form.Item>

        {attends === "yes" && (
          <>
            <Typography.Title level={5}>{t("schoolPage.form.schoolSection")}</Typography.Title>
            <Row gutter={token.margin}>
              <Col {...half}><Form.Item name="schoolName" label={t("schoolPage.fields.schoolName")} rules={text()}><Input placeholder={t("schoolPage.form.schoolNamePlaceholder")} /></Form.Item></Col>
              <Col {...half}><Form.Item name="grade" label={t("schoolPage.fields.grade")} rules={text()}><Input placeholder={t("schoolPage.form.gradePlaceholder")} /></Form.Item></Col>
              <Col {...half}><Form.Item name="address" label={t("schoolPage.fields.address")} rules={text()}><Input /></Form.Item></Col>
              <Col {...half}><Form.Item name="phone" label={t("schoolPage.fields.phone")} rules={text()}><Input inputMode="tel" /></Form.Item></Col>
            </Row>

            <Typography.Title level={5}>{t("schoolPage.form.scheduleSection")}</Typography.Title>
            <Row gutter={token.margin}>
              <Col {...half}>
                <Form.Item name="shift" label={t("schoolPage.fields.shift")}>
                  <Select allowClear options={SHIFTS.map((value) => ({ value, label: t(`schoolPage.shift.${value}`) }))} />
                </Form.Item>
              </Col>
              <Col xs={12} sm={6}><Form.Item name="entry" label={t("schoolPage.fields.entry")}><TimePicker format="HH:mm" minuteStep={5} needConfirm={false} style={{ width: "100%" }} /></Form.Item></Col>
              <Col xs={12} sm={6}>
                <Form.Item
                  name="exit"
                  label={t("schoolPage.fields.exit")}
                  dependencies={["entry"]}
                  rules={[({ getFieldValue }) => ({ validator: (_, value?: Dayjs) => {
                    const entry = getFieldValue("entry") as Dayjs | undefined;
                    return !value || !entry || value.format("HH:mm") > entry.format("HH:mm") ? Promise.resolve() : Promise.reject(new Error(t("schoolPage.form.exitAfterEntry")));
                  } })]}
                >
                  <TimePicker format="HH:mm" minuteStep={5} needConfirm={false} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="days" label={t("schoolPage.fields.days")} extra={t("schoolPage.form.daysHelp")}>
              <Checkbox.Group options={WEEKDAYS.map((day) => ({ value: day, label: format.date(weekdayDate(day), { weekday: "short" }) }))} />
            </Form.Item>
            <Form.Item name="termEnd" label={t("schoolPage.fields.termEnd")} extra={t("schoolPage.form.termEndHelp")}>
              <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
            </Form.Item>

            <Typography.Title level={5}>{t("schoolPage.form.commuteSection")}</Typography.Title>
            <Row gutter={token.margin}>
              <Col {...half}>
                <Form.Item name="toSchool" label={t("schoolPage.fields.toSchool")}>
                  <Select allowClear options={COMMUTES.map((value) => ({ value, label: t(`schoolPage.commute.${value}`) }))} />
                </Form.Item>
              </Col>
              <Col {...half}>
                <Form.Item name="dropOff" label={t("schoolPage.fields.dropOff")} rules={text()}>
                  <AutoComplete options={people} placeholder={t("schoolPage.form.whoPlaceholder")} filterOption />
                </Form.Item>
              </Col>
              <Col {...half}>
                <Form.Item name="fromSchool" label={t("schoolPage.fields.fromSchool")}>
                  <Select allowClear options={COMMUTES.map((value) => ({ value, label: t(`schoolPage.commute.${value}`) }))} />
                </Form.Item>
              </Col>
              <Col {...half}>
                <Form.Item name="pickUp" label={t("schoolPage.fields.pickUp")} rules={text()}>
                  <AutoComplete options={people} placeholder={t("schoolPage.form.whoPlaceholder")} filterOption />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="commuteNotes" label={t("schoolPage.fields.commuteNotes")} rules={text(SCHOOL_LIMITS.notesMaxLength)}>
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} placeholder={t("schoolPage.form.commuteNotesPlaceholder")} />
            </Form.Item>
          </>
        )}

        <Form.Item name="notes" label={t("schoolPage.fields.notes")} rules={text(SCHOOL_LIMITS.notesMaxLength)}>
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} placeholder={t(attends === "yes" ? "schoolPage.form.notesPlaceholder" : "schoolPage.form.notesNoSchoolPlaceholder")} />
        </Form.Item>
        <Callout>{t("schoolPage.form.privacy")}</Callout>
      </Form>
    </Modal>
  );
}
