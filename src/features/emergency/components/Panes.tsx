"use client";

import { Button, Collapse, Divider, Flex, Tag, Typography, theme } from "antd";
import { BookUser, Dog, Droplet, FileText, Flame, HeartPulse, MapPin, MessageSquare, Phone, Plus, Radio, Wrench, Zap } from "lucide-react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, type ReactNode } from "react";
import { EmergencyIllustration, EmptyState, IconTile, ListRow, MemberAvatar } from "@/components/ui";
import { PhotoGallery } from "@/features/media/components/PhotoGallery";
import { useMembers } from "@/features/members/hooks";
import { usePets } from "@/features/pets/hooks";
import { useI18n } from "@/i18n";
import { db } from "@/lib/db";
import { spaceHref } from "@/lib/navigation/routes";
import {
  BLOOD_TYPES,
  CONTACT_ROLES,
  PLAN_ID,
  RADIO_USES,
  REFERENCE_RADIO_STATIONS,
  UTILITIES,
  cardId,
  smsHref,
  telHref,
  type EmergencyContact,
  type EmergencyDocument,
  type EmergencyId,
  type FamilyPlan,
  type RadioChannel,
  type Shutoff,
} from "../domain";
import type { EmergencyData } from "../hooks";
import { useEmergencyActions } from "../hooks";
import { RecordModal, type Field } from "./RecordModal";

type Values = Record<string, unknown>;

/** Lo que muestra cada fila y abre su ficha (solo para quien edita). */
function Rows<T extends { id: EmergencyId }>({ items, title, meta, trailing, leading, onOpen }: {
  items: T[]; title: (item: T) => string; meta?: (item: T) => ReactNode; trailing?: (item: T) => ReactNode;
  leading: (item: T) => ReactNode; onOpen?: (item: T) => void;
}) {
  return <>{items.map((item, index) => (
    <ListRow key={item.id} index={index} leading={leading(item)} title={title(item)} wrapTitle meta={meta?.(item)} trailing={trailing?.(item)} onOpen={onOpen ? () => onOpen(item) : undefined} divider={index < items.length - 1} />
  ))}</>;
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { token } = theme.useToken();
  return <Button type="dashed" block icon={<Plus />} onClick={onClick} style={{ marginBlock: token.marginSM, minHeight: token.controlHeightLG }}>{label}</Button>;
}

/** Llamar al celular y al fijo: botones grandes, uno por número. */
function CallButtons({ mobile, landline }: { mobile?: string; landline?: string }) {
  const { t } = useI18n();
  return <Flex gap="small" wrap>
    {mobile && <Button size="large" href={telHref(mobile)} icon={<Phone />} aria-label={`${t("emergency.callMobile")} ${mobile}`}>{t("emergency.callMobile")}</Button>}
    {mobile && <Button size="large" href={smsHref([mobile], "")} icon={<MessageSquare />} aria-label={`${t("emergency.sendSms")} ${mobile}`} />}
    {landline && <Button size="large" href={telHref(landline)} icon={<Phone />} aria-label={`${t("emergency.callLandline")} ${landline}`}>{t("emergency.callLandline")}</Button>}
  </Flex>;
}

// --- Contactos ---------------------------------------------------------------------------

export function ContactsPane({ data, editable }: { data: EmergencyData; editable: boolean }) {
  const { t } = useI18n();
  const { save, remove } = useEmergencyActions();
  const pets = usePets();
  const [editing, setEditing] = useState<EmergencyContact | "new" | null>(null);
  const petGuards = (pets ?? []).filter((pet) => Boolean(pet.veterinarian?.emergencyPhone?.trim()));
  const fields: Field[] = [
    { name: "name", label: t("emergency.contact.name"), required: true },
    { name: "role", label: t("emergency.contact.role"), type: "select", required: true, options: CONTACT_ROLES.map((role) => ({ value: role, label: t(`emergency.contact.roles.${role}`) })) },
    { name: "mobile", label: t("emergency.contact.mobile"), type: "phone" },
    { name: "landline", label: t("emergency.contact.landline"), type: "phone" },
    { name: "address", label: t("emergency.contact.address") },
    { name: "notify", label: t("emergency.contact.notify"), hint: t("emergency.contact.notifyHint"), type: "switch" },
    { name: "note", label: t("emergency.contact.note"), type: "textarea" },
  ];
  const current = editing && editing !== "new" ? editing : undefined;
  return <>
    {data.contacts.length === 0 && petGuards.length === 0 && <EmptyState icon={BookUser} title={t("emergency.contact.empty")} />}
    <Rows
      items={data.contacts}
      leading={() => <IconTile icon={BookUser} color="blue" size={40} />}
      title={(contact) => contact.name}
      meta={(contact) => <>
        <Tag bordered={false}>{t(`emergency.contact.roles.${contact.role}`)}</Tag>
        {contact.notify && <Tag bordered={false} color="green">{t("emergency.contact.notify")}</Tag>}
        {contact.address && <span>{contact.address}</span>}
      </>}
      trailing={(contact) => <CallButtons mobile={contact.mobile} landline={contact.landline} />}
      onOpen={editable ? setEditing : undefined}
    />
    {petGuards.map((pet, index) => (
      <ListRow
        key={pet.id}
        index={data.contacts.length + index}
        leading={<IconTile icon={Dog} color="gold" size={40} />}
        title={t("emergency.contact.vetGuard", { pet: pet.name })}
        wrapTitle
        meta={<>
          {pet.veterinarian?.clinic && <span>{pet.veterinarian.clinic}</span>}
          {pet.veterinarian?.address && <span>{pet.veterinarian.address}</span>}
        </>}
        trailing={<CallButtons landline={pet.veterinarian?.emergencyPhone} />}
        divider={index < petGuards.length - 1}
      />
    ))}
    {editable && <AddButton label={t("emergency.contact.add")} onClick={() => setEditing("new")} />}
    {editing && <RecordModal
      open
      title={current ? current.name : t("emergency.contact.add")}
      fields={fields}
      initial={current ?? { role: "family" }}
      onClose={() => setEditing(null)}
      onSave={async (values: Values) => Boolean(await save("contact", values as never, current?.id))}
      onDelete={current ? async () => (await remove(current.id)) !== undefined : undefined}
    />}
  </>;
}

// --- Fichas médicas ----------------------------------------------------------------------

export function CardsPane({ data, editable }: { data: EmergencyData; editable: boolean }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const members = useMembers();
  const { save, remove } = useEmergencyActions();
  const [editing, setEditing] = useState<string | null>(null);
  const byMember = new Map(data.cards.map((card) => [card.memberId, card]));
  const fields: Field[] = [
    { name: "bloodType", label: t("emergency.card.bloodType"), type: "select", options: BLOOD_TYPES.map((value) => ({ value, label: value })) },
    { name: "allergies", label: t("emergency.card.allergies"), type: "textarea" },
    { name: "medications", label: t("emergency.card.medications"), type: "textarea" },
    { name: "conditions", label: t("emergency.card.conditions"), type: "textarea" },
    { name: "insurance", label: t("emergency.card.insurance") },
    { name: "insuranceNumber", label: t("emergency.card.insuranceNumber") },
    { name: "doctor", label: t("emergency.card.doctor") },
    { name: "note", label: t("emergency.card.note"), type: "textarea" },
  ];
  const member = members?.find((entry) => entry.id === editing);
  const card = editing ? byMember.get(editing) : undefined;
  return <>
    {(members ?? []).map((person, index, all) => {
      const entry = byMember.get(person.id);
      return <ListRow
        key={person.id}
        index={index}
        leading={<MemberAvatar member={person} size={40} />}
        title={person.name}
        wrapTitle
        meta={entry ? <>
          {entry.bloodType && <Tag bordered={false} color="red">{entry.bloodType}</Tag>}
          <span>{entry.allergies ? `${t("emergency.card.allergies")}: ${entry.allergies}` : t("emergency.card.none")}</span>
          {entry.medications && <span style={{ color: token.colorText }}>{`${t("emergency.card.medications")}: ${entry.medications}`}</span>}
          {entry.insurance && <span>{[entry.insurance, entry.insuranceNumber].filter(Boolean).join(" · ")}</span>}
        </> : <span>{t("emergency.card.empty")}</span>}
        onOpen={editable ? () => setEditing(person.id) : undefined}
        divider={index < all.length - 1}
      />;
    })}
    {editing && member && <RecordModal
      open
      title={member.name}
      fields={fields}
      initial={card}
      onClose={() => setEditing(null)}
      onSave={async (values: Values) => Boolean(await save("card", { ...values, memberId: member.id } as never, cardId(member.id)))}
      onDelete={card ? async () => (await remove(card.id)) !== undefined : undefined}
    />}
  </>;
}

// --- Plan de la familia ------------------------------------------------------------------

const PLAN_FIELDS = ["meetingNear", "meetingFar", "pickups", "outOfTown", "pets", "okMessage", "note"] as const;

export function PlanPane({ data, editable }: { data: EmergencyData; editable: boolean }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const { save } = useEmergencyActions();
  const [open, setOpen] = useState(false);
  const plan: FamilyPlan | undefined = data.plan;
  const fields: Field[] = PLAN_FIELDS.map((name) => ({
    name,
    label: t(`emergency.plan.${name}`),
    hint: name === "note" ? undefined : t(`emergency.plan.${name}Hint`),
    type: name === "pickups" || name === "note" ? "textarea" : "text",
    placeholder: name === "okMessage" ? t("emergency.ok.default") : undefined,
  }));
  const filled = PLAN_FIELDS.filter((name) => plan?.[name]);
  return <Flex vertical gap={token.marginSM} style={{ paddingBlock: token.paddingSM }}>
    {filled.length === 0 && <EmptyState icon={MapPin} title={t("emergency.plan.empty")} />}
    {filled.map((name) => (
      <Flex key={name} vertical gap={token.marginXXS}>
        <Typography.Text type="secondary">{t(`emergency.plan.${name}`)}</Typography.Text>
        <Typography.Text strong style={{ fontSize: token.fontSizeLG, whiteSpace: "pre-line" }}>{plan?.[name]}</Typography.Text>
      </Flex>
    ))}
    {editable && <Button type={filled.length ? "default" : "primary"} size="large" onClick={() => setOpen(true)}>{filled.length ? t("emergency.edit") : t("emergency.plan.fill")}</Button>}
    {open && <RecordModal open title={t("emergency.sections.plan")} fields={fields} initial={plan} onClose={() => setOpen(false)} onSave={async (values: Values) => Boolean(await save("plan", values as never, PLAN_ID))} />}
  </Flex>;
}

// --- Radio -------------------------------------------------------------------------------

export function RadioPane({ data, editable }: { data: EmergencyData; editable: boolean }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const { save, remove } = useEmergencyActions();
  const [editing, setEditing] = useState<RadioChannel | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : undefined;
  const fields: Field[] = [
    { name: "name", label: t("emergency.radio.name"), required: true },
    { name: "use", label: t("emergency.radio.use"), type: "select", required: true, options: RADIO_USES.map((use) => ({ value: use, label: t(`emergency.radio.uses.${use}`) })) },
    { name: "frequency", label: t("emergency.radio.frequency"), hint: t("emergency.radio.frequencyHint"), required: true, inputMode: "decimal" },
    { name: "tone", label: t("emergency.radio.tone"), inputMode: "decimal" },
    { name: "offset", label: t("emergency.radio.offset") },
    { name: "note", label: t("emergency.radio.note"), type: "textarea" },
  ];
  return <>
    <Typography.Paragraph type="secondary" style={{ marginBlock: token.marginSM }}>{t("emergency.radio.legal")}</Typography.Paragraph>
    {data.radio.length === 0 && <EmptyState icon={Radio} title={t("emergency.radio.empty")} description={t("emergency.radio.tips")} />}
    <Rows
      items={data.radio}
      leading={() => <IconTile icon={Radio} color="geekblue" size={40} />}
      title={(channel) => `${channel.frequency} MHz · ${channel.name}`}
      meta={(channel) => <>
        <Tag bordered={false}>{t(`emergency.radio.uses.${channel.use}`)}</Tag>
        {channel.tone && <span>{`${t("emergency.radio.tone")}: ${channel.tone}`}</span>}
        {channel.offset && <span>{`${t("emergency.radio.offset")}: ${channel.offset}`}</span>}
        {channel.note && <span>{channel.note}</span>}
      </>}
      onOpen={editable ? setEditing : undefined}
    />
    {data.radio.length > 0 && <Typography.Paragraph type="secondary" style={{ marginBlock: token.marginSM }}>{t("emergency.radio.tips")}</Typography.Paragraph>}
    {editable && <AddButton label={t("emergency.radio.add")} onClick={() => setEditing("new")} />}
    <Divider style={{ marginBlock: token.marginSM }} />
    <Flex vertical gap={token.marginXXS} style={{ marginBottom: token.marginXS }}>
      <Typography.Text strong>{t("emergency.radio.referenceTitle")}</Typography.Text>
      <Typography.Text type="secondary">{t("emergency.radio.referenceDescription")}</Typography.Text>
    </Flex>
    {REFERENCE_RADIO_STATIONS.map((station, index) => (
      <ListRow
        key={station.id}
        index={index}
        leading={<IconTile icon={Radio} color={station.listenOnly ? "blue" : "green"} size={40} />}
        title={`${station.frequency} · ${station.name}`}
        wrapTitle
        meta={<>
          <Tag bordered={false} color="blue">{station.band}</Tag>
          <Tag bordered={false} color={station.listenOnly ? "default" : "green"}>
            {station.listenOnly ? t("emergency.radio.listenOnly") : t("emergency.radio.freeUse")}
          </Tag>
          <span>{station.region}</span>
        </>}
        divider={index < REFERENCE_RADIO_STATIONS.length - 1}
      />
    ))}
    {editing && <RecordModal
      open
      title={current ? current.name : t("emergency.radio.add")}
      fields={fields}
      initial={current ?? { use: "broadcast" }}
      onClose={() => setEditing(null)}
      onSave={async (values: Values) => Boolean(await save("radio", values as never, current?.id))}
      onDelete={current ? async () => (await remove(current.id)) !== undefined : undefined}
    />}
  </>;
}

// --- Llaves de paso ----------------------------------------------------------------------

const UTILITY_ICON = { water: Droplet, gas: Flame, power: Zap } as const;
const UTILITY_COLOR = { water: "cyan", gas: "orange", power: "gold" } as const;

export function ShutoffsPane({ data, editable }: { data: EmergencyData; editable: boolean }) {
  const { t } = useI18n();
  const { save, remove } = useEmergencyActions();
  const spaces = useLiveQuery(() => db.spaces.toArray(), []);
  const [editing, setEditing] = useState<Shutoff | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : undefined;
  const fields: Field[] = [
    { name: "utility", label: t("emergency.shutoff.utility"), type: "select", required: true, options: UTILITIES.map((utility) => ({ value: utility, label: t(`emergency.shutoff.utilities.${utility}`) })) },
    { name: "where", label: t("emergency.shutoff.where"), required: true },
    { name: "how", label: t("emergency.shutoff.how"), type: "textarea" },
    ...(spaces?.length ? [{ name: "spaceId", label: t("emergency.shutoff.space"), hint: t("emergency.shutoff.spaceHint"), type: "select" as const, options: spaces.map((space) => ({ value: space.id, label: space.name })) }] : []),
  ];
  const spaceName = new Map((spaces ?? []).map((space) => [space.id, space.name]));
  return <>
    {data.shutoffs.length === 0 && <EmptyState icon={Wrench} title={t("emergency.shutoff.empty")} />}
    <Rows
      items={data.shutoffs}
      leading={(shutoff) => <IconTile icon={UTILITY_ICON[shutoff.utility]} color={UTILITY_COLOR[shutoff.utility]} size={40} />}
      title={(shutoff) => `${t(`emergency.shutoff.utilities.${shutoff.utility}`)}: ${shutoff.where}`}
      meta={(shutoff) => <>
        {shutoff.how && <span style={{ whiteSpace: "pre-line" }}>{shutoff.how}</span>}
        {shutoff.spaceId && spaceName.has(shutoff.spaceId) && <Link href={spaceHref(shutoff.spaceId)}>{`${t("emergency.shutoff.openSpace")}: ${spaceName.get(shutoff.spaceId)}`}</Link>}
      </>}
      onOpen={editable ? setEditing : undefined}
    />
    {editable && <AddButton label={t("emergency.shutoff.add")} onClick={() => setEditing("new")} />}
    {editing && <RecordModal
      open
      title={current ? t(`emergency.shutoff.utilities.${current.utility}`) : t("emergency.shutoff.add")}
      fields={fields}
      initial={current ?? { utility: "water" }}
      onClose={() => setEditing(null)}
      onSave={async (values: Values) => Boolean(await save("shutoff", values as never, current?.id))}
      onDelete={current ? async () => (await remove(current.id)) !== undefined : undefined}
    />}
  </>;
}

// --- Documentos --------------------------------------------------------------------------

export function DocsPane({ data, editable }: { data: EmergencyData; editable: boolean }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const members = useMembers();
  const { save, remove } = useEmergencyActions();
  const [editing, setEditing] = useState<EmergencyDocument | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : undefined;
  const memberName = new Map((members ?? []).map((member) => [member.id, member.name]));
  const fields: Field[] = [
    { name: "name", label: t("emergency.doc.name"), required: true },
    { name: "memberId", label: t("emergency.doc.member"), type: "select", placeholder: t("emergency.doc.everyone"), options: (members ?? []).map((member) => ({ value: member.id, label: member.name })) },
    { name: "note", label: t("emergency.doc.note"), type: "textarea" },
  ];
  return <>
    <Typography.Paragraph type="secondary" style={{ marginBlock: token.marginSM }}>{t("emergency.doc.privacy")}</Typography.Paragraph>
    {data.docs.length === 0 && <EmptyState icon={FileText} title={t("emergency.doc.empty")} />}
    <Flex vertical gap={token.marginLG}>
      {data.docs.map((doc) => (
        <Flex key={doc.id} vertical gap={token.marginXS}>
          <Flex justify="space-between" align="center" gap="small" wrap>
            <Flex vertical>
              <Typography.Text strong>{doc.name}</Typography.Text>
              <Typography.Text type="secondary">{[doc.memberId ? memberName.get(doc.memberId) : t("emergency.doc.everyone"), doc.note].filter(Boolean).join(" · ")}</Typography.Text>
            </Flex>
            {editable && <Button onClick={() => setEditing(doc)}>{t("emergency.edit")}</Button>}
          </Flex>
          <PhotoGallery ownerType="emergency" ownerId={doc.id} editable={editable} />
        </Flex>
      ))}
    </Flex>
    {editable && <AddButton label={t("emergency.doc.add")} onClick={() => setEditing("new")} />}
    {editing && <RecordModal
      open
      title={current ? current.name : t("emergency.doc.add")}
      fields={fields}
      initial={current}
      onClose={() => setEditing(null)}
      onSave={async (values: Values) => Boolean(await save("doc", values as never, current?.id))}
      onDelete={current ? async () => (await remove(current.id)) !== undefined : undefined}
    />}
  </>;
}

// --- Guías -------------------------------------------------------------------------------

export const GUIDES = ["cpr", "choking", "bleeding", "burns", "water", "gas", "outage"] as const;
const GUIDE_CALL: Partial<Record<(typeof GUIDES)[number], string>> = { cpr: "107", choking: "107", bleeding: "107", burns: "107", gas: "100" };

export function GuidesPane() {
  const { t } = useI18n();
  const { token } = theme.useToken();
  return <Collapse
    ghost
    size="large"
    items={GUIDES.map((guide) => ({
      key: guide,
      label: <Flex align="center" gap={token.marginSM}><IconTile icon={guide === "gas" || guide === "outage" ? Flame : HeartPulse} color={guide === "water" ? "cyan" : guide === "gas" || guide === "outage" ? "orange" : "red"} size={36} /><Typography.Text strong style={{ fontSize: token.fontSizeLG }}>{t(`emergency.guides.${guide}.title`)}</Typography.Text></Flex>,
      children: <Flex vertical gap={token.marginSM}>
        <EmergencyIllustration kind={guide} label={t(`emergency.guides.${guide}.title`)} />
        <ol style={{ margin: 0, paddingInlineStart: token.paddingLG }}>
          {([1, 2, 3, 4, 5] as const).map((step) => <li key={step} style={{ marginBottom: token.marginXS, fontSize: token.fontSizeLG }}>{t(`emergency.guides.${guide}.${step}`)}</li>)}
        </ol>
        {GUIDE_CALL[guide] && <Button type="primary" danger size="large" href={telHref(GUIDE_CALL[guide]!)} icon={<Phone />}>{`${t("emergency.call")} ${GUIDE_CALL[guide]}`}</Button>}
      </Flex>,
    }))}
  />;
}

