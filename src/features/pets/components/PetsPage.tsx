"use client";

import {
  Calendar,
  CalendarPlus,
  Dog,
  Heart,
  Pencil,
  Phone,
  Pill,
  Plus,
  ShieldAlert,
  Syringe,
  Trash2,
  Utensils,
} from "lucide-react";
import {
  App,
  Button,
  Card,
  Flex,
  Popconfirm,
  Segmented,
  Space,
  Tag,
  Typography,
  theme,
} from "antd";
import dayjs from "dayjs";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { EmptyState, PageHeader } from "@/components/ui";
import { Reveal, Stagger } from "@/components/motion";
import { useI18n } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { tint } from "@/lib/appearance";
import { HOVER_LIFT, TAP } from "@/lib/motion";
import { motion } from "framer-motion";
import type { PetProfile } from "../domain";
import { usePetActions, usePets } from "../hooks";
import { PetHealthModal } from "./PetHealthModal";
import { PetModal } from "./PetModal";

function formatAge(birthDateStr?: string): string | null {
  if (!birthDateStr) return null;
  const birth = dayjs(birthDateStr);
  const now = dayjs();
  const years = now.diff(birth, "year");
  const months = now.diff(birth, "month") % 12;

  if (years > 0 && months > 0) return `${years} a. ${months} m.`;
  if (years > 0) return `${years} ${years === 1 ? "año" : "años"}`;
  if (months > 0) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const days = now.diff(birth, "day");
  return `${days} ${days === 1 ? "día" : "días"}`;
}

export function PetsPage() {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const editable = usePermission("calendar.manage");
  const searchParams = useSearchParams();
  const pets = usePets();
  const { deletePet, scheduleEvent } = usePetActions();

  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ open: boolean; editing?: PetProfile | null }>({ open: false });
  const [healthModal, setHealthModal] = useState<{ open: boolean; type: "vaccine" | "medication" }>({
    open: false,
    type: "vaccine",
  });

  const queryId = searchParams?.get("id");
  const activePet =
    (pets && pets.find((p) => p.id === (selectedPetId ?? queryId))) ?? (pets && pets[0]) ?? null;

  async function copyMicrochip(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      message.success(t("pets.copiedMicrochip"));
    } catch {
      // ignore
    }
  }

  return (
    <Flex vertical gap={token.marginLG}>
      <PageHeader
        title={t("pets.title")}
        description={t("pets.description")}
        extra={
          editable && (
            <Button
              type="primary"
              icon={<Plus />}
              onClick={() => setModalState({ open: true, editing: null })}
            >
              {t("pets.add")}
            </Button>
          )
        }
      />

      {pets && pets.length === 0 && (
        <Reveal>
          <Card>
            <EmptyState
              icon={Dog}
              title={t("pets.emptyTitle")}
              description={t("pets.emptyText")}
              action={
                editable && (
                  <Button
                    type="primary"
                    icon={<Plus />}
                    onClick={() => setModalState({ open: true, editing: null })}
                  >
                    {t("pets.add")}
                  </Button>
                )
              }
            />
          </Card>
        </Reveal>
      )}

      {pets && pets.length > 0 && activePet && (
        <Flex vertical gap={token.marginMD}>
          {pets.length > 1 && (
            <Reveal>
              <Segmented
                value={activePet.id}
                onChange={(val) => setSelectedPetId(String(val))}
                options={pets.map((p) => ({
                  value: p.id,
                  label: (
                    <Space size={token.marginXXS}>
                      <span>{p.name}</span>
                    </Space>
                  ),
                }))}
              />
            </Reveal>
          )}

          {/* Ficha principal */}
          <Reveal>
            <Card>
              <Flex vertical gap={token.marginMD}>
                <Flex justify="space-between" align="flex-start" wrap gap={token.marginSM}>
                  <Flex align="center" gap={token.marginMD}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: token.borderRadiusLG,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: tint(token, activePet.color ?? "gold").bg,
                        border: `1px solid ${tint(token, activePet.color ?? "gold").border}`,
                        color: tint(token, activePet.color ?? "gold").text,
                      }}
                    >
                      <Dog />
                    </div>

                    <Flex vertical gap={token.marginXXS}>
                      <Typography.Title level={3} style={{ margin: 0 }}>
                        {activePet.name}
                      </Typography.Title>
                      <Flex wrap orientation="horizontal" gap={token.marginXS}>
                        <Tag bordered={false} color={activePet.color}>
                          {t(`pets.species.${activePet.species}`)}
                        </Tag>
                        {activePet.breed && <Tag bordered={false}>{activePet.breed}</Tag>}
                        {activePet.gender && (
                          <Tag bordered={false}>{t(`pets.gender.${activePet.gender}`)}</Tag>
                        )}
                        {activePet.birthDate && (
                          <Tag bordered={false} icon={<Calendar />}>
                            {formatAge(activePet.birthDate) ?? activePet.birthDate}
                          </Tag>
                        )}
                        {activePet.weightKg && (
                          <Tag bordered={false}>{`${activePet.weightKg} kg`}</Tag>
                        )}
                      </Flex>
                    </Flex>
                  </Flex>

                  {editable && (
                    <Flex gap={token.marginXS}>
                      <Button
                        icon={<Pencil />}
                        onClick={() => setModalState({ open: true, editing: activePet })}
                      >
                        {t("pets.edit")}
                      </Button>
                      <Popconfirm
                        title={t("pets.deleteConfirm", { name: activePet.name })}
                        okText={t("common.delete")}
                        cancelText={t("common.cancel")}
                        okButtonProps={{ danger: true }}
                        onConfirm={() => void deletePet(activePet.id)}
                      >
                        <Button danger icon={<Trash2 />} />
                      </Popconfirm>
                    </Flex>
                  )}
                </Flex>

                {activePet.microchip && (
                  <Flex align="center" gap={token.marginSM} wrap>
                    <Typography.Text type="secondary">
                      {t("pets.fields.microchip")}:
                    </Typography.Text>
                    <Tag
                      style={{ cursor: "pointer" }}
                      onClick={() => void copyMicrochip(activePet.microchip!)}
                    >
                      {activePet.microchip}
                    </Tag>
                  </Flex>
                )}

                {activePet.diet && (
                  <Card
                    size="small"
                    style={{
                      background: token.colorFillAlter,
                      borderColor: token.colorBorderSecondary,
                    }}
                  >
                    <Flex gap={token.marginSM} align="flex-start">
                      <Utensils style={{ color: token.colorTextSecondary }} />
                      <Flex vertical gap={token.marginXXS}>
                        <Typography.Text strong>
                          {t("pets.fields.diet")}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          {activePet.diet}
                        </Typography.Text>
                      </Flex>
                    </Flex>
                  </Card>
                )}

                {activePet.notes && (
                  <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                    {activePet.notes}
                  </Typography.Paragraph>
                )}
              </Flex>
            </Card>
          </Reveal>

          {/* Tres columnas responsivas: Vacunas, Medicamentos y Veterinaria */}
          <Stagger>
            <Flex wrap gap={token.marginMD}>
              {/* Libreta sanitaria */}
              <div style={{ flex: "1 1 340px" }}>
                <Card
                  title={
                    <Flex justify="space-between" align="center">
                      <Space>
                        <Syringe style={{ color: token.colorSuccess }} />
                        <span>{t("pets.vaccines.title")}</span>
                      </Space>
                      {editable && (
                        <Button
                          size="small"
                          type="dashed"
                          icon={<Plus />}
                          onClick={() => setHealthModal({ open: true, type: "vaccine" })}
                        >
                          {t("pets.vaccines.add")}
                        </Button>
                      )}
                    </Flex>
                  }
                >
                  <Flex vertical gap={token.marginSM}>
                    {(!activePet.vaccines || activePet.vaccines.length === 0) && (
                      <Typography.Text type="secondary">
                        {t("pets.vaccines.empty")}
                      </Typography.Text>
                    )}

                    {(activePet.vaccines ?? []).map((v) => {
                      const isOverdue = v.nextDueDate && v.nextDueDate < dayjs().format("YYYY-MM-DD");
                      return (
                        <Card
                          key={v.id}
                          size="small"
                          style={{
                            background: token.colorFillAlter,
                            borderColor: token.colorBorderSecondary,
                          }}
                        >
                          <Flex justify="space-between" align="flex-start" wrap gap={token.marginXS}>
                            <Flex vertical gap={token.marginXXS}>
                              <Typography.Text strong>{v.name}</Typography.Text>
                              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                                {dayjs(v.date).format("DD/MM/YYYY")}
                              </Typography.Text>
                              {v.nextDueDate && (
                                <Tag
                                  bordered={false}
                                  color={isOverdue ? "error" : "success"}
                                  style={{ marginTop: token.marginXXS }}
                                >
                                  {isOverdue ? t("pets.vaccines.overdue") : t("pets.vaccines.nextDueBadge", { date: dayjs(v.nextDueDate).format("DD/MM/YYYY") })}
                                </Tag>
                              )}
                              {v.notes && (
                                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                                  {v.notes}
                                </Typography.Text>
                              )}
                            </Flex>

                            {editable && v.nextDueDate && (
                              <Button
                                size="small"
                                icon={<CalendarPlus />}
                                onClick={() =>
                                  void scheduleEvent(
                                    activePet,
                                    `${t("pets.vaccines.name")}: ${v.name}`,
                                    v.nextDueDate!,
                                    v.notes,
                                  )
                                }
                              />
                            )}
                          </Flex>
                        </Card>
                      );
                    })}
                  </Flex>
                </Card>
              </div>

              {/* Tratamientos */}
              <div style={{ flex: "1 1 340px" }}>
                <Card
                  title={
                    <Flex justify="space-between" align="center">
                      <Space>
                        <Pill style={{ color: token.colorInfo }} />
                        <span>{t("pets.medications.title")}</span>
                      </Space>
                      {editable && (
                        <Button
                          size="small"
                          type="dashed"
                          icon={<Plus />}
                          onClick={() => setHealthModal({ open: true, type: "medication" })}
                        >
                          {t("pets.medications.add")}
                        </Button>
                      )}
                    </Flex>
                  }
                >
                  <Flex vertical gap={token.marginSM}>
                    {(!activePet.medications || activePet.medications.length === 0) && (
                      <Typography.Text type="secondary">
                        {t("pets.medications.empty")}
                      </Typography.Text>
                    )}

                    {(activePet.medications ?? []).map((m) => (
                      <Card
                        key={m.id}
                        size="small"
                        style={{
                          background: token.colorFillAlter,
                          borderColor: token.colorBorderSecondary,
                        }}
                      >
                        <Flex justify="space-between" align="flex-start" wrap gap={token.marginXS}>
                          <Flex vertical gap={token.marginXXS}>
                            <Typography.Text strong>{m.name}</Typography.Text>
                            {(m.dose || m.frequency) && (
                              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                                {[m.dose, m.frequency].filter(Boolean).join(" · ")}
                              </Typography.Text>
                            )}
                            {(m.startDate || m.endDate) && (
                              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                                {[
                                  m.startDate ? dayjs(m.startDate).format("DD/MM/YYYY") : null,
                                  m.endDate ? dayjs(m.endDate).format("DD/MM/YYYY") : null,
                                ]
                                  .filter(Boolean)
                                  .join(" al ")}
                              </Typography.Text>
                            )}
                            {m.notes && (
                              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                                {m.notes}
                              </Typography.Text>
                            )}
                          </Flex>

                          {editable && m.endDate && (
                            <Button
                              size="small"
                              icon={<CalendarPlus />}
                              onClick={() =>
                                void scheduleEvent(
                                  activePet,
                                  `${t("pets.medications.name")}: ${m.name}`,
                                  m.endDate!,
                                  m.notes,
                                )
                              }
                            />
                          )}
                        </Flex>
                      </Card>
                    ))}
                  </Flex>
                </Card>
              </div>

              {/* Veterinaria y emergencias */}
              <div style={{ flex: "1 1 340px" }}>
                <Card
                  title={
                    <Space>
                      <Heart style={{ color: token.colorError }} />
                      <span>{t("pets.veterinarian")}</span>
                    </Space>
                  }
                >
                  <Flex vertical gap={token.marginMD}>
                    {activePet.veterinarian ? (
                      <>
                        <Flex vertical gap={token.marginXXS}>
                          {activePet.veterinarian.clinic && (
                            <Typography.Text strong style={{ fontSize: token.fontSizeLG }}>
                              {activePet.veterinarian.clinic}
                            </Typography.Text>
                          )}
                          {activePet.veterinarian.name && (
                            <Typography.Text type="secondary">
                              {activePet.veterinarian.name}
                            </Typography.Text>
                          )}
                          {activePet.veterinarian.address && (
                            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                              {activePet.veterinarian.address}
                            </Typography.Text>
                          )}
                        </Flex>

                        <Flex vertical gap={token.marginSM}>
                          {activePet.veterinarian.phone && (
                            <motion.div whileHover={HOVER_LIFT} whileTap={TAP}>
                              <Button
                                block
                                icon={<Phone />}
                                href={`tel:${activePet.veterinarian.phone}`}
                              >
                                {t("pets.callClinic")} ({activePet.veterinarian.phone})
                              </Button>
                            </motion.div>
                          )}

                          {activePet.veterinarian.emergencyPhone && (
                            <motion.div whileHover={HOVER_LIFT} whileTap={TAP}>
                              <Button
                                block
                                danger
                                icon={<ShieldAlert />}
                                href={`tel:${activePet.veterinarian.emergencyPhone}`}
                              >
                                {t("pets.callEmergency")} ({activePet.veterinarian.emergencyPhone})
                              </Button>
                            </motion.div>
                          )}
                        </Flex>
                      </>
                    ) : (
                      <Typography.Text type="secondary">
                        {t("pets.emptyText")}
                      </Typography.Text>
                    )}
                  </Flex>
                </Card>
              </div>
            </Flex>
          </Stagger>
        </Flex>
      )}

      {modalState.open && (
        <PetModal pet={modalState.editing} onClose={() => setModalState({ open: false })} />
      )}

      {healthModal.open && activePet && (
        <PetHealthModal
          pet={activePet}
          type={healthModal.type}
          onClose={() => setHealthModal({ open: false, type: "vaccine" })}
        />
      )}
    </Flex>
  );
}
