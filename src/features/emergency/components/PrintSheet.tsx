"use client";

import { Button, Card, Flex, Typography, theme } from "antd";
import { Printer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LoadingSkeleton, PageHeader } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { useMembers } from "@/features/members/hooks";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { PUBLIC_NUMBERS } from "../domain";
import { useEmergency, type EmergencyData } from "../hooks";

/**
 * La hoja para la heladera: lo esencial en una página A4, en blanco y negro y letra grande.
 * Sirve cuando el celular no tiene batería. En pantalla se ve igual que impresa.
 */
export function PrintSheet() {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const data = useEmergency();
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    const frame = requestAnimationFrame(() => { window.print(); setPrinting(false); });
    return () => cancelAnimationFrame(frame);
  }, [printing]);

  if (!data) return <LoadingSkeleton paragraph={{ rows: 8 }} />;
  return (
    <Flex vertical gap={token.marginLG}>
      <PageHeader
        title={t("emergency.printSheet.title")}
        description={t("emergency.printSheet.hint")}
        extra={<Button type="primary" icon={<Printer />} onClick={() => setPrinting(true)}>{t("emergency.printSheet.print")}</Button>}
      />
      <Reveal>
        <Card><Sheet data={data} /></Card>
      </Reveal>
      {printing && createPortal(<div className="od-print-root"><style>{"@page { size: A4; margin: 12mm; }"}</style><Sheet data={data} print /></div>, document.body)}
    </Flex>
  );
}

/** Impresa: tinta negra pura sobre blanco, legible en cualquier impresora y con el tema oscuro. */
const PRINT_INK = "#000";
const PRINT_PAPER = "#fff";

function Sheet({ data, print = false }: { data: EmergencyData; print?: boolean }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const members = useMembers();
  const now = useNow();
  const name = new Map((members ?? []).map((member) => [member.id, member.name]));
  const ink = print ? PRINT_INK : token.colorText;
  const soft = print ? PRINT_INK : token.colorTextSecondary;
  const block = (title: string, children: ReactNode) => (
    <section style={{ breakInside: "avoid", marginBottom: token.margin }}>
      <h2 style={{ fontSize: token.fontSizeHeading4, margin: 0, marginBottom: token.marginXS, borderBottom: `2px solid ${ink}`, color: ink }}>{title}</h2>
      {children}
    </section>
  );
  const line = (label: ReactNode, value: ReactNode, key?: string) => (
    <div key={key} style={{ display: "flex", gap: token.marginSM, fontSize: token.fontSizeLG, lineHeight: token.lineHeightLG, color: ink }}>
      <strong style={{ minWidth: 0, flex: "0 0 auto" }}>{label}</strong><span style={{ color: soft, overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
  const plan = data.plan;

  return (
    <div style={{ color: ink, background: print ? PRINT_PAPER : undefined, padding: print ? 0 : token.paddingXS }}>
      <h1 style={{ fontSize: token.fontSizeHeading2, margin: 0, color: ink }}>{t("emergency.printSheet.title")}</h1>
      <Typography.Paragraph style={{ color: soft }}>{t("emergency.printSheet.updated", { date: format.date(now, { day: "numeric", month: "long", year: "numeric" }) })}</Typography.Paragraph>
      {block(t("emergency.printSheet.numbers"), PUBLIC_NUMBERS.map((entry) => line(entry.id === "poison" ? "0800 333 0160" : entry.number, t(`emergency.public.${entry.id}`), entry.id)))}
      {(plan?.meetingNear || plan?.meetingFar || plan?.pickups || plan?.outOfTown) && block(t("emergency.printSheet.plan"), <>
        {plan.meetingNear && line(t("emergency.plan.meetingNear"), plan.meetingNear)}
        {plan.meetingFar && line(t("emergency.plan.meetingFar"), plan.meetingFar)}
        {plan.pickups && line(t("emergency.plan.pickups"), plan.pickups)}
        {plan.outOfTown && line(t("emergency.plan.outOfTown"), plan.outOfTown)}
      </>)}
      {data.contacts.length > 0 && block(t("emergency.printSheet.contacts"), data.contacts.map((contact) =>
        line(contact.name, [contact.mobile, contact.landline && `${t("emergency.callLandline")}: ${contact.landline}`, contact.address].filter(Boolean).join(" · "), contact.id)))}
      {data.cards.length > 0 && block(t("emergency.printSheet.people"), data.cards.map((card) =>
        line(name.get(card.memberId) ?? "—", [card.bloodType, card.allergies && `${t("emergency.card.allergies")}: ${card.allergies}`, card.medications && `${t("emergency.card.medications")}: ${card.medications}`, card.insurance && [card.insurance, card.insuranceNumber].filter(Boolean).join(" ")].filter(Boolean).join(" · "), card.id)))}
      {data.shutoffs.length > 0 && block(t("emergency.printSheet.shutoffs"), data.shutoffs.map((shutoff) =>
        line(t(`emergency.shutoff.utilities.${shutoff.utility}`), [shutoff.where, shutoff.how].filter(Boolean).join(" · "), shutoff.id)))}
      {data.places.length > 0 && block(t("emergency.printSheet.places"), data.places.slice(0, 12).map((place) =>
        line(place.name, [t(`emergency.places.categories.${place.category}`), place.address, place.phone].filter(Boolean).join(" · "), place.id)))}
    </div>
  );
}
