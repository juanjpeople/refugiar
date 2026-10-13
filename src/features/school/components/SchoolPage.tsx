"use client";

import { App, Button, Card, Col, Flex, Row, Typography, theme } from "antd";
import dayjs from "dayjs";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { Backpack, Bike, BookOpen, Bus, CalendarCheck, CalendarOff, Car, Clock, Footprints, GraduationCap, House, MapPin, NotebookPen, Pencil, Phone, Plus, Route, School, TrainFront, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Can } from "@/components/auth/Can";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Callout, DetailPage, EmptyState, InfoTile, LoadingSkeleton, PageHeader, SectionHeader, WeekdayChips, WeekSchedule, type WeekScheduleDay } from "@/components/ui";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { EventModal } from "@/features/calendar/components/EventModal";
import type { CalendarEvent } from "@/features/calendar/domain";
import { useOccurrences } from "@/features/calendar/hooks";
import { saveCalendarPreferences } from "@/features/calendar/service";
import { DEFAULT_CALENDAR, readCalendarSettings } from "@/features/calendar/settings";
import type { Member } from "@/features/members/domain";
import { useMembers } from "@/features/members/hooks";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { tint } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import { useCurrentUser } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/errors";
import { HOVER_LIFT, SPRING, TAP } from "@/lib/motion";
import { WEEKDAYS, weekdayDate, type Commute, type SchoolProfile } from "../domain";
import { useSchoolProfiles, useSubjects } from "../hooks";
import { SchoolProfileModal } from "./SchoolProfileModal";
import { SubjectModal } from "./SubjectModal";

/** Cómo va y cómo vuelve: el ícono acompaña al medio. */
const COMMUTE_ICONS: Record<Commute, LucideIcon> = { walk: Footprints, car: Car, schoolBus: Bus, publicTransport: TrainFront, bike: Bike, other: Route };

/**
 * La escuela de un chico, de lo más usado a lo de consulta: quién es y a qué escuela va (encabezado),
 * qué pasa hoy, horario y viaje de un vistazo, el horario semanal de materias y, al costado, los
 * datos de la escuela y lo que hay que tener en cuenta. Con varios chicos, se elige uno arriba.
 */
export function SchoolPage() {
  const { t } = useI18n();
  const members = useMembers();
  const actor = useCurrentUser();
  const canManage = usePermission("calendar.manage");
  const profiles = useSchoolProfiles();
  const subjects = useSubjects();
  const [editing, setEditing] = useState<Member | null>(null);
  const [addingTo, setAddingTo] = useState<Member | null>(null);
  const [subject, setSubject] = useState<CalendarEvent | null>(null);
  // Desde Familia se llega con `#<miembro>`: abre la ficha de ese chico.
  const [selectedId, setSelectedId] = useState<string | null>(() => (typeof window === "undefined" ? null : decodeURIComponent(window.location.hash.slice(1)) || null));

  // Quien maneja el calendario ve a todos los chicos; un chico, solo su ficha.
  const kids = members && profiles ? members.filter((member) => member.role === "kid" && (canManage || member.id === actor?.id)) : undefined;
  const kid = kids?.find((member) => member.id === selectedId) ?? kids?.[0];

  function select(id: string) {
    setSelectedId(id);
    window.history.replaceState(null, "", `#${encodeURIComponent(id)}`);
  }

  const modals = (
    <>
      {editing && <SchoolProfileModal member={editing} profile={profiles?.get(editing.id)} onClose={() => setEditing(null)} />}
      {addingTo && <SubjectModal member={addingTo} profile={profiles?.get(addingTo.id)} onClose={() => setAddingTo(null)} />}
      <EventModal open={!!subject} event={subject ?? undefined} onClose={() => setSubject(null)} />
    </>
  );

  if (!kids || !kid) {
    return (
      <RequirePermission perform="calendar.view">
        <PageHeader eyebrow={t("schoolPage.eyebrow")} title={t("schoolPage.title")} description={t("schoolPage.description")} />
        {!kids ? (
          <LoadingSkeleton />
        ) : (
          <Reveal>
            <Card>
              <EmptyState
                icon={GraduationCap}
                title={t("schoolPage.emptyTitle")}
                description={t("schoolPage.emptyText")}
                action={<Can perform="members.manage"><Link href="/familia"><Button icon={<UserPlus />}>{t("schoolPage.goFamily")}</Button></Link></Can>}
              />
            </Card>
          </Reveal>
        )}
      </RequirePermission>
    );
  }

  return (
    <RequirePermission perform="calendar.view">
      <KidSheet
        key={kid.id}
        member={kid}
        kids={kids}
        onSelect={select}
        profile={profiles?.get(kid.id)}
        subjects={(subjects ?? []).filter((event) => event.participantIds.includes(kid.id))}
        canManage={canManage}
        onEdit={() => setEditing(kid)}
        onAddSubject={() => setAddingTo(kid)}
        onOpenSubject={setSubject}
      >
        {modals}
      </KidSheet>
    </RequirePermission>
  );
}

interface KidSheetProps {
  member: Member;
  kids: Member[];
  onSelect: (id: string) => void;
  profile?: SchoolProfile;
  subjects: CalendarEvent[];
  canManage: boolean;
  onEdit: () => void;
  onAddSubject: () => void;
  onOpenSubject: (event: CalendarEvent) => void;
  children: ReactNode;
}

function KidSheet({ member, kids, onSelect, profile, subjects, canManage, onEdit, onAddSubject, onOpenSubject, children }: KidSheetProps) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const now = useNow();
  const current = subjects.filter((event) => event.repeatUntil === undefined || event.repeatUntil >= now);
  const status = !profile ? t("schoolPage.status.missing") : !profile.attends ? t("schoolPage.status.notAttending") : [profile.schoolName, profile.grade].filter(Boolean).join(" · ") || t("schoolPage.status.attending");
  const attends = !!profile?.attends;

  const summary = (
    <Flex vertical gap={token.marginLG} style={{ marginBottom: token.marginXL }}>
      {kids.length > 1 && <KidPicker kids={kids} selectedId={member.id} onSelect={onSelect} />}
      {canManage && <AgendaSwitch />}
      {!profile && (
        <Card>
          <EmptyState
            icon={GraduationCap}
            title={t("schoolPage.status.missing")}
            description={t(canManage ? "schoolPage.missingHelp" : "schoolPage.missingKid")}
            action={canManage && <Button type="primary" icon={<Plus />} onClick={onEdit}>{t("schoolPage.setUp")}</Button>}
          />
        </Card>
      )}
      {profile && !profile.attends && (
        <Callout icon={House} title={t("schoolPage.status.notAttending")}>{profile.notes ?? t("schoolPage.notAttendingHelp")}</Callout>
      )}
      {profile?.attends && <TodayBand member={member} profile={profile} subjects={current} />}
      {profile?.attends && <KeyFacts member={member} profile={profile} />}
    </Flex>
  );

  const days = profile?.attends ? scheduleDays(profile, current) : [];
  return (
    <DetailPage
      header={{
        eyebrow: t("schoolPage.title"),
        leading: <MemberAvatar member={member} size={56} />,
        title: member.name,
        description: status,
        extra: canManage && profile && <Button icon={<Pencil />} onClick={onEdit}>{t("schoolPage.edit")}</Button>,
      }}
      summary={summary}
      sections={[
        attends && {
          id: "materias",
          header: {
            icon: BookOpen,
            color: member.color,
            title: t("schoolPage.subjects"),
            description: current.length ? t("schoolPage.subjectsCount", { count: current.length }) : undefined,
            extra: canManage && <Button icon={<Plus />} onClick={onAddSubject}>{t("schoolPage.addSubject")}</Button>,
          },
          content: current.length ? (
            <Flex vertical gap={token.marginSM}>
              <WeekSchedule
                color={member.color}
                emptyDay={t("schoolPage.noClassesDay")}
                days={days.map((day) => ({
                  key: day,
                  label: format.date(weekdayDate(day), { weekday: "long" }),
                  today: day === dayjs(now).day(),
                  entries: current
                    .filter((event) => new Date(event.start).getDay() === day)
                    .sort((a, b) => minutes(a.start) - minutes(b.start))
                    .map((event) => ({
                      key: event.id,
                      time: `${format.time(event.start)}–${format.time(event.end)}`,
                      title: event.title,
                      meta: event.teacher,
                      note: event.notes,
                      noteIcon: Backpack,
                      onOpen: () => onOpenSubject(event),
                      openLabel: t("schoolPage.openSubject", { title: event.title }),
                    })),
                }) satisfies WeekScheduleDay)}
              />
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("schoolPage.subjectsSync")}</Typography.Text>
            </Flex>
          ) : (
            <Card>
              <EmptyState
                icon={BookOpen}
                title={t(subjects.length ? "schoolPage.subjectsEnded" : "schoolPage.noSubjects")}
                action={canManage && <Button type="primary" icon={<Plus />} onClick={onAddSubject}>{t("schoolPage.addSubject")}</Button>}
              />
            </Card>
          ),
        },
      ]}
      aside={attends && profile ? <Reference member={member} profile={profile} /> : undefined}
    >
      {children}
    </DetailPage>
  );
}

const minutes = (time: number) => new Date(time).getHours() * 60 + new Date(time).getMinutes();

/** Las columnas del horario: los días de clase de la escuela y cualquier otro día con materias. */
function scheduleDays(profile: SchoolProfile, subjects: CalendarEvent[]) {
  const withSubjects = new Set(subjects.map((event) => new Date(event.start).getDay()));
  return WEEKDAYS.filter((day) => profile.days.includes(day) || withSubjects.has(day));
}

/** Con varios chicos, se elige uno: la ficha de abajo es la suya. */
function KidPicker({ kids, selectedId, onSelect }: { kids: Member[]; selectedId: string; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  return (
    <Flex role="tablist" aria-label={t("schoolPage.pickKid")} gap={token.marginSM} wrap>
      {kids.map((kid) => {
        const selected = kid.id === selectedId;
        const palette = tint(token, kid.color);
        return (
          <motion.button
            key={kid.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className="od-focusable"
            onClick={() => onSelect(kid.id)}
            whileHover={{ y: HOVER_LIFT.chip }}
            whileTap={{ scale: TAP.control }}
            transition={SPRING.snappy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: token.marginXS,
              minHeight: 44,
              padding: `${token.paddingXXS}px ${token.padding}px ${token.paddingXXS}px ${token.paddingXXS}px`,
              borderRadius: 999,
              border: `1.5px solid ${selected ? palette.solid : token.colorBorderSecondary}`,
              background: selected ? palette.bg : token.colorBgContainer,
              color: token.colorText,
              font: "inherit",
              fontWeight: selected ? 600 : 400,
              cursor: "pointer",
            }}
          >
            <MemberAvatar member={kid} size={32} />
            {kid.name}
          </motion.button>
        );
      })}
    </Flex>
  );
}

/** Lo primero que se busca: qué pasa hoy (si tiene clases, a qué hora, quién lo lleva y qué lleva). */
function TodayBand({ member, profile, subjects }: { member: Member; profile: SchoolProfile; subjects: CalendarEvent[] }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const now = useNow();
  const today = dayjs(now).startOf("day");
  const occurrences = useOccurrences(today.valueOf(), today.add(1, "day").valueOf()) ?? [];
  const termOver = !!profile.termEnd && dayjs(profile.termEnd).endOf("day").isBefore(now);
  const off = occurrences.some((entry) => entry.event?.eventKind === "break" && (!entry.participantIds.length || entry.participantIds.includes(member.id)));
  const holiday = occurrences.find((entry) => entry.holiday || entry.event?.eventKind === "holiday");
  const classDay = profile.days.includes(today.day()) && !termOver && !off;
  const dayName = format.date(now, { weekday: "long" });

  if (termOver) {
    return (
      <Callout color={member.color} icon={CalendarOff} title={t("schoolPage.today.termOver")}>
        {t("schoolPage.today.termOverText", { date: format.date(dayjs(profile.termEnd).valueOf(), { day: "numeric", month: "long" }) })}
      </Callout>
    );
  }
  if (!classDay) {
    const next = [1, 2, 3, 4, 5, 6, 7].map((offset) => today.add(offset, "day")).find((day) => profile.days.includes(day.day()));
    return (
      <Callout color={member.color} icon={CalendarOff} title={t("schoolPage.today.offTitle")}>
        {next && (profile.entry ? t("schoolPage.today.next", { day: format.date(next.valueOf(), { weekday: "long" }), time: profile.entry }) : t("schoolPage.today.nextNoTime", { day: format.date(next.valueOf(), { weekday: "long" }) }))}
      </Callout>
    );
  }

  const todays = subjects.filter((event) => new Date(event.start).getDay() === today.day()).sort((a, b) => minutes(a.start) - minutes(b.start));
  const leg = (time: string | undefined, key: "schoolPage.today.entry" | "schoolPage.today.exit", mode?: Commute, who?: string) =>
    [time && t(key, { time }), mode && t(`schoolPage.commute.${mode}`), who].filter(Boolean).join(" · ");
  const lines = [
    leg(profile.entry, "schoolPage.today.entry", profile.toSchool, profile.dropOff),
    leg(profile.exit, "schoolPage.today.exit", profile.fromSchool, profile.pickUp),
  ].filter(Boolean);
  const bring = todays.map((event) => event.notes).filter(Boolean);

  return (
    <Callout color={member.color} icon={CalendarCheck} title={t("schoolPage.today.title", { day: dayName })}>
      <Flex vertical gap={token.marginXXS} style={{ marginTop: token.marginXXS }}>
        {lines.map((line) => <Typography.Text key={line} strong>{line}</Typography.Text>)}
        {todays.length > 0 && <span>{t("schoolPage.today.classes", { list: todays.map((event) => event.title).join(", ") })}</span>}
        {bring.length > 0 && (
          <Flex gap={token.marginXXS} align="flex-start">
            <Backpack aria-hidden style={{ flexShrink: 0, marginTop: 3 }} />
            <span>{t("schoolPage.today.bring", { list: bring.join(" · ") })}</span>
          </Flex>
        )}
        {holiday && <Typography.Text type="warning">{t("schoolPage.today.holiday", { name: holiday.title })}</Typography.Text>}
      </Flex>
    </Callout>
  );
}

/** Lo de todos los días, de un vistazo: horario con sus días, cómo va y cómo vuelve. */
function KeyFacts({ member, profile }: { member: Member; profile: SchoolProfile }) {
  const { t, format } = useI18n();
  const now = useNow();
  const hours = profile.entry && profile.exit ? `${profile.entry} – ${profile.exit}` : profile.entry ?? profile.exit;
  const dayNames = WEEKDAYS.filter((day) => profile.days.includes(day)).map((day) => format.date(weekdayDate(day), { weekday: "long" }));
  const trip = (field: "toSchool" | "fromSchool", mode: Commute | undefined, whoLabel: "schoolPage.fields.dropOff" | "schoolPage.fields.pickUp", who?: string) => (
    <InfoTile
      icon={mode ? COMMUTE_ICONS[mode] : Route}
      color={member.color}
      label={t(`schoolPage.fields.${field}`)}
      value={mode ? t(`schoolPage.commute.${mode}`) : <Typography.Text type="secondary">{t("schoolPage.notSet")}</Typography.Text>}
      detail={who ? `${t(whoLabel)}: ${who}` : undefined}
    />
  );

  return (
    <Stagger>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <StaggerItem style={{ height: "100%" }}>
            <InfoTile
              icon={Clock}
              color={member.color}
              label={t("schoolPage.fields.schedule")}
              value={hours ?? <Typography.Text type="secondary">{t("schoolPage.notSet")}</Typography.Text>}
              detail={profile.shift ? t(`schoolPage.shift.${profile.shift}`) : undefined}
              footer={
                <WeekdayChips
                  color={member.color}
                  label={t("schoolPage.daysLabel", { days: dayNames.join(", ") || t("schoolPage.notSet") })}
                  days={WEEKDAYS.map((day) => ({ key: day, short: format.date(weekdayDate(day), { weekday: "narrow" }), active: profile.days.includes(day), today: day === dayjs(now).day() }))}
                />
              }
            />
          </StaggerItem>
        </Col>
        <Col xs={24} md={8}>
          <StaggerItem style={{ height: "100%" }}>{trip("toSchool", profile.toSchool, "schoolPage.fields.dropOff", profile.dropOff)}</StaggerItem>
        </Col>
        <Col xs={24} md={8}>
          <StaggerItem style={{ height: "100%" }}>{trip("fromSchool", profile.fromSchool, "schoolPage.fields.pickUp", profile.pickUp)}</StaggerItem>
        </Col>
      </Row>
    </Stagger>
  );
}

/** De consulta, al costado: los datos de la escuela y lo que hay que tener en cuenta. */
function Reference({ member, profile }: { member: Member; profile: SchoolProfile }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const hasNotes = !!(profile.notes || profile.commuteNotes);
  const section = (icon: LucideIcon, title: string, body: ReactNode) => (
    <section>
      <SectionHeader icon={icon} color={member.color} title={title} />
      <Card size="small">
        <Flex vertical gap={token.margin}>{body}</Flex>
      </Card>
    </section>
  );

  return (
    <Flex vertical gap={token.marginLG}>
      {section(
        School,
        t("schoolPage.sections.school"),
        <>
          {profile.schoolName || profile.address ? (
            <Fact icon={MapPin} label={t("schoolPage.fields.school")}>
              {profile.schoolName && <Typography.Text strong style={{ display: "block" }}>{profile.schoolName}</Typography.Text>}
              {profile.address && <Typography.Text type="secondary">{profile.address}</Typography.Text>}
            </Fact>
          ) : (
            <Typography.Text type="secondary">{t("schoolPage.notSet")}</Typography.Text>
          )}
          {profile.phone && (
            <Fact icon={Phone} label={t("schoolPage.fields.phone")}>
              <Flex align="center" justify="space-between" gap={token.marginXS} wrap>
                <Typography.Text style={{ fontVariantNumeric: "tabular-nums" }}>{profile.phone}</Typography.Text>
                <Button size="small" icon={<Phone />} href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`} style={{ borderColor: tint(token, member.color).border }}>
                  {t("schoolPage.call")}
                </Button>
              </Flex>
            </Fact>
          )}
          {profile.termEnd && (
            <Fact icon={GraduationCap} label={t("schoolPage.fields.termEnd")}>
              {format.date(dayjs(profile.termEnd).valueOf(), { day: "numeric", month: "long", year: "numeric" })}
            </Fact>
          )}
        </>,
      )}
      {hasNotes &&
        section(
          NotebookPen,
          t("schoolPage.sections.notes"),
          <>
            {profile.notes && <Fact icon={NotebookPen} label={t("schoolPage.fields.notes")}>{profile.notes}</Fact>}
            {profile.commuteNotes && <Fact icon={Route} label={t("schoolPage.fields.commuteNotes")}>{profile.commuteNotes}</Fact>}
          </>,
        )}
    </Flex>
  );
}

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: ReactNode; children: ReactNode }) {
  const { token } = theme.useToken();
  return (
    <Flex gap={token.marginSM} align="flex-start" style={{ minWidth: 0 }}>
      <Icon aria-hidden style={{ flexShrink: 0, marginTop: token.marginXXS, color: token.colorTextTertiary }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM }}>{label}</Typography.Text>
        <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{children}</div>
      </div>
    </Flex>
  );
}

/** La agenda escolar de Inicio es opcional: si está apagada, se ofrece prenderla acá. */
function AgendaSwitch() {
  const { t } = useI18n();
  const { message } = App.useApp();
  const actor = useCurrentUser();
  const settings = useLiveQuery(readCalendarSettings, [], null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  if (settings === null || settings?.schoolEnabled) return null;
  async function enable() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const { country, state, region } = settings ?? DEFAULT_CALENDAR;
      await saveCalendarPreferences(actor, { country, state, region, schoolEnabled: true });
      message.success(t("schoolPage.agendaOn"));
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Callout tone="primary" title={t("schoolPage.agendaOffTitle")} action={<Button type="primary" loading={busy} onClick={() => void enable()}>{t("schoolPage.agendaEnable")}</Button>}>
      {t("schoolPage.agendaOffText")}
    </Callout>
  );
}
