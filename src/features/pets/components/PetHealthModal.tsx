"use client";

import { Checkbox, Col, DatePicker, Form, Input, Modal, Row, theme } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";
import { useI18n } from "@/i18n";
import type { PetMedication, PetProfile, PetVaccine } from "../domain";
import { usePetActions } from "../hooks";

interface VaccineFormValues {
  name: string;
  date: Dayjs;
  nextDueDate?: Dayjs;
  notes?: string;
  scheduleCalendar?: boolean;
}

interface MedicationFormValues {
  name: string;
  dose?: string;
  frequency?: string;
  startDate?: Dayjs;
  endDate?: Dayjs;
  notes?: string;
  scheduleCalendar?: boolean;
}

export function PetHealthModal({
  pet,
  type,
  onClose,
}: {
  pet: PetProfile;
  type: "vaccine" | "medication";
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const [form] = Form.useForm<VaccineFormValues & MedicationFormValues>();
  const { savePet, scheduleEvent } = usePetActions();
  const [saving, setSaving] = useState(false);

  async function onOk() {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (type === "vaccine") {
        const dateStr = values.date.format("YYYY-MM-DD");
        const nextDueStr = values.nextDueDate?.format("YYYY-MM-DD");
        const newVaccine: PetVaccine = {
          id: crypto.randomUUID(),
          name: values.name.trim(),
          date: dateStr,
          nextDueDate: nextDueStr,
          notes: values.notes?.trim() || undefined,
        };

        const updatedVaccines = [...(pet.vaccines ?? []), newVaccine];
        const ok = await savePet(pet.id, {
          ...pet,
          vaccines: updatedVaccines,
        });

        if (ok && values.scheduleCalendar && nextDueStr) {
          await scheduleEvent(
            pet,
            `${t("pets.vaccines.name")}: ${values.name.trim()}`,
            nextDueStr,
            values.notes?.trim(),
          );
        }
        if (ok) onClose();
      } else {
        const startStr = values.startDate?.format("YYYY-MM-DD");
        const endStr = values.endDate?.format("YYYY-MM-DD");
        const newMed: PetMedication = {
          id: crypto.randomUUID(),
          name: values.name.trim(),
          dose: values.dose?.trim() || undefined,
          frequency: values.frequency?.trim() || undefined,
          startDate: startStr,
          endDate: endStr,
          notes: values.notes?.trim() || undefined,
        };

        const updatedMeds = [...(pet.medications ?? []), newMed];
        const ok = await savePet(pet.id, {
          ...pet,
          medications: updatedMeds,
        });

        if (ok && values.scheduleCalendar && endStr) {
          await scheduleEvent(
            pet,
            `${t("pets.medications.name")}: ${values.name.trim()}`,
            endStr,
            values.notes?.trim(),
          );
        }
        if (ok) onClose();
      }
    } catch {
      // validation failed
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={type === "vaccine" ? t("pets.vaccines.add") : t("pets.medications.add")}
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      onOk={onOk}
      onCancel={onClose}
      destroyOnClose
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          date: dayjs(),
          scheduleCalendar: true,
        }}
      >
        <Form.Item
          name="name"
          label={type === "vaccine" ? t("pets.vaccines.name") : t("pets.medications.name")}
          rules={[{ required: true, message: t("errors.validation.nameRequired") }]}
        >
          <Input
            placeholder={type === "vaccine" ? "Ej. Antirrábica, Séxtuple, Pipeta" : "Ej. Amoxicilina, Gotas óticas"}
            autoFocus
            maxLength={80}
          />
        </Form.Item>

        {type === "vaccine" ? (
          <>
            <Row gutter={token.marginMD}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="date"
                  label={t("pets.vaccines.date")}
                  rules={[{ required: true, message: t("errors.validation.dateInvalid") }]}
                >
                  <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="DD/MM/AAAA" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="nextDueDate" label={t("pets.vaccines.nextDueDate")}>
                  <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="DD/MM/AAAA" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="scheduleCalendar" valuePropName="checked">
              <Checkbox>{t("pets.vaccines.scheduleCalendar")}</Checkbox>
            </Form.Item>
          </>
        ) : (
          <>
            <Row gutter={token.marginMD}>
              <Col xs={24} sm={12}>
                <Form.Item name="dose" label={t("pets.medications.dose")}>
                  <Input placeholder="Ej. 1 comprimido, 5 ml" maxLength={60} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="frequency" label={t("pets.medications.frequency")}>
                  <Input placeholder="Ej. Cada 12 horas, diario" maxLength={60} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={token.marginMD}>
              <Col xs={24} sm={12}>
                <Form.Item name="startDate" label={t("pets.medications.startDate")}>
                  <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="DD/MM/AAAA" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="endDate" label={t("pets.medications.endDate")}>
                  <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="DD/MM/AAAA" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="scheduleCalendar" valuePropName="checked">
              <Checkbox>{t("pets.medications.scheduleCalendar")}</Checkbox>
            </Form.Item>
          </>
        )}

        <Form.Item name="notes" label={t("pets.fields.notes")}>
          <Input.TextArea rows={2} placeholder="Laboratorio, lote o instrucciones del veterinario" maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
