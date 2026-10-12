"use client";

import { App, Button, Card, Flex, Typography, theme } from "antd";
import dayjs from "dayjs";
import { useLiveQuery } from "dexie-react-hooks";
import { Backpack, BookOpen, Clock, GraduationCap, MapPin, NotebookPen, Pencil, Phone, Plus, Route, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Can } from "@/components/auth/Can";
import { Reveal } from "@/components/motion";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Callout, EmptyState, ListGrid, LoadingSkeleton, PageHeader, SectionHeader } from "@/components/ui";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { EventModal } from "@/features/calendar/components/EventModal";
import type { CalendarEvent } from "@/features/calendar/domain";
import { saveCalendarPreferences } from "@/features/calendar/service";
import { DEFAULT_CALENDAR, readCalendarSettings } from "@/features/calendar/settings";
import type { Member } from "@/features/members/domain";
import { useMembers } from "@/features/members/hooks";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { useCurrentUser } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/errors";
import { WEEKDAYS, weekdayDate, type SchoolProfile } from "../domain";
import { useSchoolProfiles, useSubjects } from "../hooks";
import { SchoolProfileModal } from "./SchoolProfileModal";
import { SubjectModal } from "./SubjectModal";

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

  // Quien maneja el calendario ve a todos los chicos; un chico, solo su ficha.
  const kids = members && profiles ? members.filter((member) => member.role === "kid" && (canManage || member.id === actor?.id)) : undefined;

  // Desde Familia se llega con `#<miembro>`: la ficha aparece después de cargar.
  const loaded = !!kids;
  useEffect(() => {
    if (!loaded || !window.location.hash) return;
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView({ block: "start" });
  }, [loaded]);

  const familyButton = (
    <Can perform="members.manage">
      <Link href="/familia"><Button icon={<UserPlus />}>{t("schoolPage.goFamily")}</Button></Link>
    </Can>
  );

  return (
    <RequirePermission perform="calendar.view">
      <PageHeader eyebrow={t("schoolPage.eyebrow")} title={t("schoolPage.title")} description={t("schoolPage.description")} />
      {canManage && <AgendaSwitch />}
      {!kids ? (
        <LoadingSkeleton />
      ) : kids.length === 0 ? (
        <Card><EmptyState icon={GraduationCap} title={t("schoolPage.emptyTitle")} description={t("schoolPage.emptyText")} action={familyButton} /></Card>
      ) : (
        <ListGrid
          items={kids}
          getKey={(member) => member.id}
          layout="list"
          renderItem={(member) => (
            <KidCard
              member={member}
              profile={profiles?.get(member.id)}
              subjects={(subjects ?? []).filter((event) => event.participantIds.includes(member.id))}
              canManage={canManage}
              onEdit={() => setEditing(member)}
              onAddSubject={() => setAddingTo(member)}
              onOpenSubject={setSubject}
            />
          )}
        />
      )}
      {editing && <SchoolProfileModal member={editing} profile={profiles?.get(editing.id)} onClose={() => setEditing(null)} />}
      {addingTo && <SubjectModal member={addingTo} profile={profiles?.get(addingTo.id)} onClose={() => setAddingTo(null)} />}
      <EventModal open={!!subject} event={subject ?? undefined} onClose={() => setSubject(null)} />
    </RequirePermission>
  );
}

/** La agenda escolar de Inicio es opcional: si está apagada, se ofrece prenderla acá. */
function AgendaSwitch() {
  const { t } = useI18n();
  const { message } = App.useApp();
  const actor = useCurrentUser();
  const { token } = theme.useToken();
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
    <Reveal style={{ marginBottom: token.marginLG }}><Callout tone="primary" title={t("schoolPage.agendaOffTitle")} action={<Button type="primary" loading={busy} onClick={() => void enable()}>{t("schoolPage.agendaEnable")}</Button>}>
      {t("schoolPage.agendaOffText")}
    </Callout></Reveal>
  );
}

interface KidCardProps {
  member: Member;
  profile?: SchoolProfile;
  subjects: CalendarEvent[];
  canManage: boolean;
  onEdit: () => void;
  onAddSubject: () => void;
  onOpenSubject: (event: CalendarEvent) => void;
}

function KidCard({ member, profile, subjects, canManage, onEdit, onAddSubject, onOpenSubject }: KidCardProps) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const status = !profile ? t("schoolPage.status.missing") : !profile.attends ? t("schoolPage.status.notAttending") : [profile.schoolName, profile.grade].filter(Boolean).join(" · ") || t("schoolPage.status.attending");

  return (
    <Card id={member.id} style={{ scrollMarginTop: token.marginXXL * 2 }}>
      <Flex vertical gap={token.marginLG}>
        <Flex align="center" gap={token.margin} wrap>
          <MemberAvatar member={member} size={48} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <Typography.Title level={4} style={{ margin: 0 }} ellipsis>{member.name}</Typography.Title>
            <Typography.Text type="secondary">{status}</Typography.Text>
          </div>
          {canManage && (
            <Button icon={profile ? <Pencil /> : <Plus />} type={profile ? "default" : "primary"} onClick={onEdit}>
              {profile ? t("schoolPage.edit") : t("schoolPage.setUp")}
            </Button>
          )}
        </Flex>

        {!profile && <Typography.Text type="secondary">{t(canManage ? "schoolPage.missingHelp" : "schoolPage.missingKid")}</Typography.Text>}
        {profile && !profile.attends && profile.notes && <Fact icon={NotebookPen} label={t("schoolPage.fields.notes")}>{profile.notes}</Fact>}
        {profile?.attends && <ProfileFacts profile={profile} />}
        {profile?.attends && (
          <section>
            <SectionHeader
              icon={BookOpen}
              color={member.color}
              title={t("schoolPage.subjects")}
              description={subjects.length ? t("schoolPage.subjectsCount", { count: subjects.length }) : undefined}
              extra={canManage && <Button icon={<Plus />} onClick={onAddSubject}>{t("schoolPage.addSubject")}</Button>}
            />
            <Timetable subjects={subjects} onOpen={onOpenSubject} />
          </section>
        )}
      </Flex>
    </Card>
  );
}

function ProfileFacts({ profile }: { profile: SchoolProfile }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const hours = profile.entry && profile.exit ? `${profile.entry} – ${profile.exit}` : profile.entry ?? profile.exit;
  const days = profile.days.length ? WEEKDAYS.filter((day) => profile.days.includes(day)).map((day) => format.date(weekdayDate(day), { weekday: "short" })).join(", ") : undefined;
  const schedule = [profile.shift && t(`schoolPage.shift.${profile.shift}`), hours, days].filter(Boolean).join(" · ");
  const trip = (mode: SchoolProfile["toSchool"], who?: string) => [mode && t(`schoolPage.commute.${mode}`), who].filter(Boolean).join(" · ");
  const to = trip(profile.toSchool, profile.dropOff);
  const back = trip(profile.fromSchool, profile.pickUp);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: token.margin }}>
      {(profile.schoolName || profile.address) && (
        <Fact icon={MapPin} label={t("schoolPage.fields.school")}>
          {[profile.schoolName, profile.address].filter(Boolean).join(" · ")}
        </Fact>
      )}
      {profile.phone && (
        <Fact icon={Phone} label={t("schoolPage.fields.phone")}>
          <Typography.Link href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}>{profile.phone}</Typography.Link>
        </Fact>
      )}
      {schedule && <Fact icon={Clock} label={t("schoolPage.fields.schedule")}>{schedule}</Fact>}
      {profile.termEnd && <Fact icon={GraduationCap} label={t("schoolPage.fields.termEnd")}>{format.date(dayjs(profile.termEnd).valueOf(), { day: "numeric", month: "long", year: "numeric" })}</Fact>}
      {to && <Fact icon={Route} label={t("schoolPage.fields.toSchool")}>{to}</Fact>}
      {back && <Fact icon={Route} label={t("schoolPage.fields.fromSchool")}>{back}</Fact>}
      {profile.commuteNotes && <Fact icon={Route} label={t("schoolPage.fields.commuteNotes")}>{profile.commuteNotes}</Fact>}
      {profile.notes && <Fact icon={NotebookPen} label={t("schoolPage.fields.notes")}>{profile.notes}</Fact>}
    </div>
  );
}

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: ReactNode; children: ReactNode }) {
  const { token } = theme.useToken();
  return (
    <Flex gap={token.marginSM} align="flex-start" style={{ minWidth: 0 }}>
      <Icon aria-hidden style={{ flexShrink: 0, marginTop: token.marginXXS, color: token.colorTextTertiary }} />
      <div style={{ minWidth: 0 }}>
        <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM }}>{label}</Typography.Text>
        <Typography.Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{children}</Typography.Text>
      </div>
    </Flex>
  );
}

/** Materias del ciclo en curso, por día de la semana. Tocar una abre su evento para editarla. */
function Timetable({ subjects, onOpen }: { subjects: CalendarEvent[]; onOpen: (event: CalendarEvent) => void }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const now = useNow();
  const current = subjects.filter((event) => event.repeatUntil === undefined || event.repeatUntil >= now);
  if (!current.length) return <Typography.Text type="secondary">{t(subjects.length ? "schoolPage.subjectsEnded" : "schoolPage.noSubjects")}</Typography.Text>;
  const minutes = (time: number) => new Date(time).getHours() * 60 + new Date(time).getMinutes();
  return (
    <Flex vertical gap={token.marginSM}>
      {WEEKDAYS.map((day) => {
        const entries = current.filter((event) => new Date(event.start).getDay() === day).sort((a, b) => minutes(a.start) - minutes(b.start));
        if (!entries.length) return null;
        return (
          <div key={day}>
            <Typography.Text strong style={{ textTransform: "capitalize" }}>{format.date(weekdayDate(day), { weekday: "long" })}</Typography.Text>
            <Flex vertical gap={token.marginXXS} style={{ marginTop: token.marginXXS }}>
              {entries.map((event) => (
                <Button key={event.id} type="text" onClick={() => onOpen(event)} aria-label={t("schoolPage.openSubject", { title: event.title })} style={{ height: "auto", minHeight: 44, justifyContent: "flex-start", textAlign: "start", whiteSpace: "normal", paddingInline: token.paddingXS }}>
                  <Flex vertical style={{ minWidth: 0 }}>
                    <span>
                      <Typography.Text type="secondary">{format.time(event.start)}–{format.time(event.end)}</Typography.Text>{" "}
                      <Typography.Text strong>{event.title}</Typography.Text>
                      {event.teacher && <Typography.Text type="secondary"> · {event.teacher}</Typography.Text>}
                    </span>
                    {event.notes && (
                      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                        <Backpack aria-hidden /> {event.notes}
                      </Typography.Text>
                    )}
                  </Flex>
                </Button>
              ))}
            </Flex>
          </div>
        );
      })}
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("schoolPage.subjectsSync")}</Typography.Text>
    </Flex>
  );
}
