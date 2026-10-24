"use client";

import { Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Typography, theme } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";
import { useI18n } from "@/i18n";
import {
  PET_GENDERS,
  PET_SPECIES,
  defaultPetColor,
  defaultPetIcon,
  type PetGender,
  type PetProfile,
  type PetProfileInput,
  type PetSpecies,
} from "../domain";
import { usePetActions } from "../hooks";

interface PetFormValues {
  name: string;
  species: PetSpecies;
  breed?: string;
  gender?: PetGender;
  birthDate?: Dayjs;
  weightKg?: number;
  microchip?: string;
  diet?: string;
  notes?: string;
  vetClinic?: string;
  vetName?: string;
  vetPhone?: string;
  vetEmergencyPhone?: string;
  vetAddress?: string;
}

export function PetModal({
  pet,
  onClose,
}: {
  pet?: PetProfile | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const [form] = Form.useForm<PetFormValues>();
  const { savePet } = usePetActions();
  const [saving, setSaving] = useState(false);

  const isEdit = !!pet;

  async function onOk() {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const input: PetProfileInput = {
        name: values.name.trim(),
        species: values.species,
        breed: values.breed?.trim() || undefined,
        gender: values.gender,
        birthDate: values.birthDate ? values.birthDate.format("YYYY-MM-DD") : undefined,
        weightKg: values.weightKg ? Number(values.weightKg) : undefined,
        microchip: values.microchip?.trim() || undefined,
        diet: values.diet?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
        veterinarian:
          values.vetClinic || values.vetName || values.vetPhone || values.vetEmergencyPhone || values.vetAddress
            ? {
                clinic: values.vetClinic?.trim() || undefined,
                name: values.vetName?.trim() || undefined,
                phone: values.vetPhone?.trim() || undefined,
                emergencyPhone: values.vetEmergencyPhone?.trim() || undefined,
                address: values.vetAddress?.trim() || undefined,
              }
            : undefined,
        vaccines: pet?.vaccines ?? [],
        medications: pet?.medications ?? [],
        color: pet?.color ?? defaultPetColor(values.species),
        icon: pet?.icon ?? defaultPetIcon(values.species),
      };

      const petId = pet?.id ?? crypto.randomUUID();
      const ok = await savePet(petId, input);
      if (ok) onClose();
    } catch {
      // Form validation failed
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={isEdit ? t("pets.edit") : t("pets.add")}
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      onOk={onOk}
      onCancel={onClose}
      destroyOnClose
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          name: pet?.name ?? "",
          species: pet?.species ?? "dog",
          breed: pet?.breed ?? "",
          gender: pet?.gender,
          birthDate: pet?.birthDate ? dayjs(pet.birthDate) : undefined,
          weightKg: pet?.weightKg,
          microchip: pet?.microchip ?? "",
          diet: pet?.diet ?? "",
          notes: pet?.notes ?? "",
          vetClinic: pet?.veterinarian?.clinic ?? "",
          vetName: pet?.veterinarian?.name ?? "",
          vetPhone: pet?.veterinarian?.phone ?? "",
          vetEmergencyPhone: pet?.veterinarian?.emergencyPhone ?? "",
          vetAddress: pet?.veterinarian?.address ?? "",
        }}
      >
        <Row gutter={token.marginMD}>
          <Col xs={24} sm={14}>
            <Form.Item
              name="name"
              label={t("pets.fields.name")}
              rules={[{ required: true, message: t("errors.validation.nameRequired") }]}
            >
              <Input placeholder="Ej. Luna" autoFocus maxLength={60} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item name="species" label={t("pets.fields.species")} rules={[{ required: true }]}>
              <Select
                options={PET_SPECIES.map((s) => ({
                  value: s,
                  label: t(`pets.species.${s}`),
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={token.marginMD}>
          <Col xs={24} sm={12}>
            <Form.Item name="breed" label={t("pets.fields.breed")}>
              <Input placeholder="Ej. Mestizo, Caniche, Siamés" maxLength={80} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="gender" label={t("pets.fields.gender")}>
              <Select
                allowClear
                options={PET_GENDERS.map((g) => ({
                  value: g,
                  label: t(`pets.gender.${g}`),
                }))}
              />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="weightKg" label={t("pets.fields.weight")}>
              <InputNumber min={0.1} max={300} step={0.1} style={{ width: "100%" }} placeholder="Ej. 12.5" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={token.marginMD}>
          <Col xs={24} sm={12}>
            <Form.Item name="birthDate" label={t("pets.fields.birthDate")}>
              <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="DD/MM/AAAA" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="microchip" label={t("pets.fields.microchip")}>
              <Input placeholder="Número de chip" maxLength={40} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="diet" label={t("pets.fields.diet")}>
          <Input.TextArea rows={2} placeholder="Ej. 200g alimento balanceado mañana y noche" maxLength={500} />
        </Form.Item>

        <Form.Item name="notes" label={t("pets.fields.notes")}>
          <Input.TextArea rows={2} placeholder="Alergias, comportamiento o cuidados especiales" maxLength={1000} />
        </Form.Item>

        <Typography.Title level={5} style={{ marginTop: token.marginMD, marginBottom: token.marginXS }}>
          {t("pets.veterinarian")}
        </Typography.Title>

        <Row gutter={token.marginMD}>
          <Col xs={24} sm={12}>
            <Form.Item name="vetClinic" label={t("pets.fields.clinic")}>
              <Input placeholder="Ej. Clínica Veterinaria San Roque" maxLength={80} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="vetName" label={t("pets.fields.vetName")}>
              <Input placeholder="Ej. Dr. Lucas García" maxLength={80} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={token.marginMD}>
          <Col xs={24} sm={12}>
            <Form.Item name="vetPhone" label={t("pets.fields.phone")}>
              <Input type="tel" placeholder="+54 11 1234-5678" maxLength={40} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="vetEmergencyPhone" label={t("pets.fields.emergencyPhone")}>
              <Input type="tel" placeholder="+54 11 9999-0000" maxLength={40} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="vetAddress" label={t("pets.fields.address")}>
          <Input placeholder="Dirección del consultorio o clínica" maxLength={120} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
