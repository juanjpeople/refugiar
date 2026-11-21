"use client";

import { App, Button, Col, Flex, Modal, Progress, Row, Typography, theme } from "antd";
import { Ambulance, BookUser, FileText, Flame, HeartHandshake, HeartPulse, LifeBuoy, MapPin, MessageSquareHeart, Phone, Printer, Radio, ShieldAlert, Siren, Users, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Callout, EmergencyAction, LoadingSkeleton, PageHeader, SectionPanes, type PaneSection } from "@/components/ui";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { useI18n } from "@/i18n";
import { useNow } from "@/hooks/useNow";
import { usePermission } from "@/lib/auth/hooks";
import { PUBLIC_NUMBERS, okMessage, readiness, smsHref, telHref, type EmergencyContact, type PublicNumber } from "../domain";
import { useEmergency, type EmergencyData } from "../hooks";
import { usePosition } from "../usePosition";
import { CardsPane, ContactsPane, DocsPane, GuidesPane, PlanPane, RadioPane, ShutoffsPane } from "./Panes";
import { PlacesPane } from "./PlacesPane";

const NUMBER_ICON: Record<PublicNumber["id"], typeof Phone> = { "911": Siren, "107": Ambulance, "100": Flame, "103": LifeBuoy, poison: ShieldAlert, "144": HeartHandshake };
const SECTION_IDS = ["contactos", "fichas", "plan", "lugares", "radio", "llaves", "documentos", "guias"] as const;
type SectionId = (typeof SECTION_IDS)[number];

/**
 * Emergencias: arriba, lo que se usa con nervios (llamar y "Estoy bien"), con botones grandes.
 * Abajo, lo que se prepara con calma: contactos, fichas, plan, lugares, radio, llaves y papeles.
 */
export function EmergencyPage() {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const data = useEmergency();
  const editable = usePermission("calendar.manage");
  // `/emergencias#lugares` abre esa sección (desde un atajo o un enlace).
  const [active, setActive] = useState<SectionId | null>(() => {
    const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return (SECTION_IDS as readonly string[]).includes(hash) ? (hash as SectionId) : null;
  });
  const [okOpen, setOkOpen] = useState(false);

  if (!data) return <LoadingSkeleton paragraph={{ rows: 6 }} />;
  const notify = data.contacts.filter((contact) => contact.notify && contact.mobile);
  const ready = readiness(data, notify.length);

  const sections: (PaneSection & { id: SectionId })[] = [
    { id: "contactos", icon: BookUser, title: t("emergency.sections.contact"), summary: t("emergency.sections.contactSummary", { count: data.contacts.length }), intro: t("emergency.sections.contactIntro") },
    { id: "fichas", icon: HeartPulse, title: t("emergency.sections.card"), summary: t("emergency.sections.cardSummary", { count: data.cards.length }), intro: t("emergency.sections.cardIntro") },
    { id: "plan", icon: Users, title: t("emergency.sections.plan"), summary: t("emergency.sections.planSummary"), intro: t("emergency.sections.planIntro") },
    { id: "lugares", icon: MapPin, title: t("emergency.sections.place"), summary: t("emergency.sections.placeSummary", { count: data.places.length }), intro: t("emergency.sections.placeIntro") },
    { id: "radio", icon: Radio, title: t("emergency.sections.radio"), summary: t("emergency.sections.radioSummary", { count: data.radio.length }), intro: t("emergency.sections.radioIntro") },
    { id: "llaves", icon: Wrench, title: t("emergency.sections.shutoff"), summary: t("emergency.sections.shutoffSummary", { count: data.shutoffs.length }), intro: t("emergency.sections.shutoffIntro") },
    { id: "documentos", icon: FileText, title: t("emergency.sections.doc"), summary: t("emergency.sections.docSummary", { count: data.docs.length }), intro: t("emergency.sections.docIntro") },
    { id: "guias", icon: HeartPulse, title: t("emergency.sections.guide"), summary: t("emergency.sections.guideSummary"), intro: t("emergency.sections.guideIntro") },
  ];

  return (
    <Flex vertical gap={token.marginLG}>
      <PageHeader
        title={t("emergency.title")}
        description={t("emergency.description")}
        extra={<Link href="/emergencias/imprimir"><Button icon={<Printer />}>{t("emergency.print")}</Button></Link>}
      />

      <Reveal>
        <EmergencyAction
          solid
          icon={MessageSquareHeart}
          color="green"
          title={t("emergency.ok.button")}
          detail={notify.length ? t("emergency.ok.to", { count: notify.length }) : t("emergency.ok.hint")}
          onClick={() => setOkOpen(true)}
        />
      </Reveal>

      <section aria-label={t("emergency.public.title")}>
        <Stagger>
          <Row gutter={[token.marginSM, token.marginSM]}>
            {PUBLIC_NUMBERS.map((entry) => (
              <Col key={entry.id} xs={12} md={8} xl={4}>
                <StaggerItem style={{ height: "100%" }}>
                  <EmergencyAction
                    icon={NUMBER_ICON[entry.id]}
                    color={entry.color}
                    href={telHref(entry.number)}
                    title={entry.id === "poison" ? "0800 333 0160" : entry.number}
                    detail={t(`emergency.public.${entry.id}`)}
                    aria-label={`${t("emergency.call")} ${t(`emergency.public.${entry.id}`)}: ${entry.number}`}
                  />
                </StaggerItem>
              </Col>
            ))}
          </Row>
        </Stagger>
        <Typography.Paragraph type="secondary" style={{ marginTop: token.marginXS }}>{t("emergency.public.note")}</Typography.Paragraph>
      </section>

      {ready.done < ready.total && (
        <Reveal>
          <Callout tone="primary" icon={ShieldAlert} title={t("emergency.ready", { count: ready.done, total: ready.total })}>
            <Flex vertical gap={token.marginXS}>
              <span>{editable ? t("emergency.readyHint") : t("emergency.readOnly")}</span>
              <Progress percent={Math.round((ready.done / ready.total) * 100)} showInfo={false} />
            </Flex>
          </Callout>
        </Reveal>
      )}

      <SectionPanes
        aria-label={t("emergency.sectionsLabel")}
        sections={sections}
        active={active}
        onSelect={(id) => { setActive(id as SectionId); history.replaceState(null, "", `#${id}`); }}
        onBack={() => { setActive(null); history.replaceState(null, "", window.location.pathname); }}
        backLabel={t("emergency.back")}
      >
        <Pane id={active ?? "contactos"} data={data} editable={editable} />
      </SectionPanes>

      <Typography.Text type="secondary">{t("emergency.offline")}</Typography.Text>
      {okOpen && <OkModal contacts={notify} message={data.plan?.okMessage} onClose={() => setOkOpen(false)} onSetup={() => { setOkOpen(false); setActive("contactos"); }} />}
    </Flex>
  );
}

function Pane({ id, data, editable }: { id: SectionId; data: EmergencyData; editable: boolean }) {
  switch (id) {
    case "contactos": return <ContactsPane data={data} editable={editable} />;
    case "fichas": return <CardsPane data={data} editable={editable} />;
    case "plan": return <PlanPane data={data} editable={editable} />;
    case "lugares": return <PlacesPane data={data} editable={editable} />;
    case "radio": return <RadioPane data={data} editable={editable} />;
    case "llaves": return <ShutoffsPane data={data} editable={editable} />;
    case "documentos": return <DocsPane data={data} editable={editable} />;
    case "guias": return <GuidesPane />;
  }
}

/**
 * "Estoy bien": arma el SMS con dónde estás (si el GPS responde) y lo abre en la app de mensajes.
 * No se manda solo: la persona lo revisa y toca enviar. Un SMS no necesita datos.
 */
function OkModal({ contacts, message: base, onClose, onSetup }: { contacts: EmergencyContact[]; message?: string; onClose: () => void; onSetup: () => void }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { position, status, locate } = usePosition();
  const now = useNow();
  useEffect(() => { void locate(); }, [locate]);
  const text = okMessage(base || t("emergency.ok.default"), position, format.time(now), t("emergency.ok.here"));

  return (
    <Modal open title={t("emergency.ok.button")} onCancel={onClose} footer={null}>
      <Flex vertical gap={token.margin}>
        {contacts.length === 0 ? (
          <>
            <Typography.Paragraph>{t("emergency.ok.noContacts")}</Typography.Paragraph>
            <Button type="primary" size="large" onClick={onSetup}>{t("emergency.sections.contact")}</Button>
          </>
        ) : (
          <>
            <Typography.Text type="secondary">{contacts.map((contact) => contact.name).join(", ")}</Typography.Text>
            <Typography.Paragraph style={{ whiteSpace: "pre-line", padding: token.paddingSM, background: token.colorFillQuaternary, borderRadius: token.borderRadiusLG, marginBottom: 0 }}>{text}</Typography.Paragraph>
            {status === "locating" && <Typography.Text type="secondary">{t("emergency.ok.locating")}</Typography.Text>}
            {status === "failed" && <Typography.Text type="warning">{t("emergency.ok.noPosition")}</Typography.Text>}
            <EmergencyAction solid icon={MessageSquareHeart} color="green" title={t("emergency.sendSms")} detail={t("emergency.ok.to", { count: contacts.length })} href={smsHref(contacts.map((contact) => contact.mobile!), text)} />
            <Button onClick={() => void navigator.clipboard?.writeText(text).then(() => message.success(t("emergency.ok.copied")), () => undefined)}>{t("emergency.ok.copy")}</Button>
          </>
        )}
      </Flex>
    </Modal>
  );
}
