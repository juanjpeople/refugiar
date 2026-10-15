"use client";

import { haloBackground } from "@/skins/surface";
import { useSkin } from "@/skins/useSkin";
import { Card, Col, Flex, Grid, Row, Typography, theme } from "antd";
import { Boxes, CalendarDays, ChefHat, GraduationCap, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useState, type ComponentProps } from "react";
import { Can } from "@/components/auth/Can";
import { House } from "@/components/illustrations/House";
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { NavCard, PulseDot } from "@/components/ui";
import { ActivityList } from "@/features/activity/components/ActivityList";
import { useOccurrences } from "@/features/calendar/hooks";
import { SchoolToday } from "@/features/calendar/components/SchoolToday";
import { BackupReminder } from "@/features/settings/components/BackupReminder";
import { APPEARANCE_ICONS, tint } from "@/lib/appearance";
import { useActivity } from "@/features/activity/hooks";
import { useInventoryTotals } from "@/features/inventory/hooks";
import { useShoppingCounts } from "@/features/shopping/hooks";
import { spaceAppearance } from "@/features/storage/domain";
import { useStorageOverview, type SpaceOverview } from "@/features/storage/hooks";
import { spaceHref } from "@/lib/navigation/routes";
import { useNow } from "@/hooks/useNow";
import { useI18n, useT, type MessageKey } from "@/i18n";
import dayjs from "dayjs";
import { useCurrentUser } from "@/lib/auth/session";

function greetingKey(hour: number): MessageKey {
  if (hour >= 6 && hour < 13) return "home.greeting.morning";
  if (hour >= 13 && hour < 20) return "home.greeting.afternoon";
  return "home.greeting.evening";
}

/** Inicio: el de la casa para los grandes; el de su día para los chicos. */
export function HomeDashboard() {
  const user = useCurrentUser();
  return user?.role === "kid" ? <KidHome /> : <HouseHome />;
}

function HouseHome() {
  const { t, format } = useI18n();
  const user = useCurrentUser();
  const totals = useInventoryTotals();
  const spaces = useStorageOverview();
  const now = useNow();

  const loaded = totals !== undefined;
  const needsAttention = totals?.needsAttention ?? 0;

  return (
    <>
      <HomeHero
        eyebrow={format.date(now, { weekday: "long", day: "numeric", month: "long" })}
        title={t("home.hello", { greeting: t(greetingKey(new Date(now).getHours())), name: user?.name ?? "" })}
        status={
          !loaded
            ? null
            : needsAttention > 0
              ? { tone: "warning", text: t("home.attention", { count: needsAttention }) }
              : { tone: "success", text: t("home.allGood") }
        }
      />

      <BackupReminder />
      <Can perform="calendar.view"><SchoolToday /></Can>
      <Stagger delay={0.15}>
        <Row gutter={[16, 16]}>
          <Can perform="inventory.view">
            {spaces?.map((space) => (
              <Col key={space.id} xs={24} sm={12} lg={8}>
                <SpaceCard space={space} />
              </Col>
            ))}
          </Can>
          <Can perform="shopping.view">
            <Col xs={24} sm={12} lg={8}>
              <ShoppingCard />
            </Col>
          </Can>
          <Can perform="inventory.view">
          <Col xs={24} sm={12} lg={8}>
            <DashboardCard href="/inventario" icon={Boxes} title={t("nav.routes.inventory")}>
              <Typography.Text style={{ fontSize: "1.45rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                {t("home.allPlaces")}
              </Typography.Text>
              <Typography.Text type="secondary">{t("storage.containerCount", { count: spaces?.reduce((sum, space) => sum + space.containers.length, 0) ?? 0 })}</Typography.Text>
            </DashboardCard>
          </Col>
          </Can>
        </Row>
        {/* Fila aparte: la cantidad de recintos varía y no tiene que dejar huecos en la de abajo. */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Can perform="calendar.view">
            <Col xs={24} lg={12}>
              <UpcomingCard />
            </Col>
          </Can>
          <Can perform="activity.view">
            <Col xs={24} lg={12}>
              <RecentActivityCard />
            </Col>
          </Can>
        </Row>
      </Stagger>
    </>
  );
}

/**
 * Inicio de un chico: su día. Escuela de hoy, lo que viene (solo lo suyo y lo de toda la casa) y
 * las recetas para opinar. Nada del inventario ni de las compras (ver docs/CHICOS.md).
 */
function KidHome() {
  const { t, format } = useI18n();
  const user = useCurrentUser();
  const now = useNow();
  const shortcuts = [
    { href: "/escuela", icon: GraduationCap, color: "geekblue", title: t("nav.routes.school"), text: t("home.kid.school") },
    { href: "/calendario", icon: CalendarDays, color: "purple", title: t("nav.routes.calendar"), text: t("home.kid.calendar") },
    { href: "/recetas", icon: ChefHat, color: "orange", title: t("nav.routes.recipes"), text: t("home.kid.recipes") },
  ] as const;

  return (
    <>
      <HomeHero
        eyebrow={format.date(now, { weekday: "long", day: "numeric", month: "long" })}
        title={t("home.hello", { greeting: t(greetingKey(new Date(now).getHours())), name: user?.name ?? "" })}
        status={{ tone: "success", text: t("home.kid.status") }}
      />
      <SchoolToday />
      <Stagger delay={0.15}>
        <Row gutter={[16, 16]}>
          {shortcuts.map((shortcut) => (
            <Col key={shortcut.href} xs={24} sm={12} lg={8}>
              <DashboardCard href={shortcut.href} icon={shortcut.icon} color={shortcut.color} title={shortcut.title}>
                <Typography.Text style={{ fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3 }}>{shortcut.text}</Typography.Text>
              </DashboardCard>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <UpcomingCard />
          </Col>
        </Row>
      </Stagger>
    </>
  );
}

interface HeroStatus {
  tone: "success" | "warning";
  text: string;
}

function HomeHero({ eyebrow, title, status }: { eyebrow: string; title: string; status: HeroStatus | null }) {
  const { token } = theme.useToken();
  const skin = useSkin();
  const screens = Grid.useBreakpoint();

  return (
    <Reveal>
      <Flex
        align="center"
        justify="space-between"
        gap={24}
        style={{
          marginBottom: 24,
          padding: screens.md ? "32px 40px" : 24,
          borderRadius: token.borderRadiusLG * 2,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: haloBackground(skin, `radial-gradient(ellipse at 85% 50%, ${token.colorPrimaryBg}, transparent 65%)`, token.colorBgContainer),
          overflow: "hidden",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Typography.Text
            strong
            style={{ color: token.colorTextSecondary, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: token.fontSizeSM }}
          >
            {eyebrow}
          </Typography.Text>
          <Typography.Title style={{ margin: "6px 0 12px", letterSpacing: "-0.035em", fontSize: "clamp(1.9rem, 4vw, 2.75rem)", lineHeight: 1.1 }}>
            {title}
          </Typography.Title>
          <Flex align="center" gap={10} style={{ minHeight: 24 }}>
            {status && (
              <>
                <PulseDot tone={status.tone} />
                <Reveal y={4} key={status.text}>
                  <Typography.Text style={{ fontSize: token.fontSizeLG }}>{status.text}</Typography.Text>
                </Reveal>
              </>
            )}
          </Flex>
        </div>
        {screens.sm && (
          <div style={{ width: screens.md ? 220 : 160, flexShrink: 0, marginBlock: -8 }}>
            <House particles />
          </div>
        )}
      </Flex>
    </Reveal>
  );
}

function SpaceCard({ space }: { space: SpaceOverview }) {
  const { token } = theme.useToken();
  const t = useT();
  const itemCount = space.containers.reduce((sum, container) => sum + container.itemCount, 0);
  const attention = space.containers.reduce((sum, container) => sum + container.needsAttention, 0);

  return (
    <DashboardCard href={spaceHref(space.id)} icon={spaceAppearance(space).Icon} color={spaceAppearance(space).color} title={space.name}>
      <Flex align="baseline" gap={6}>
        <Typography.Text style={{ fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          <AnimatedNumber value={itemCount} />
        </Typography.Text>
        <Typography.Text type="secondary">{t("storage.itemNoun", { count: itemCount })}</Typography.Text>
      </Flex>
      {attention > 0 ? (
        <Typography.Text style={{ color: token.colorWarningText }}>{t("storage.attention", { count: attention })}</Typography.Text>
      ) : (
        <Typography.Text type="secondary">{t("storage.containerCount", { count: space.containers.length })}</Typography.Text>
      )}
    </DashboardCard>
  );
}

/** Lista de compras: cuánto falta comprar y si hay sugerencias esperando una decisión. */
function ShoppingCard() {
  const { token } = theme.useToken();
  const t = useT();
  const counts = useShoppingCounts();
  const pending = counts?.pending ?? 0;
  const review = counts?.review ?? 0;

  return (
    <DashboardCard href="/compras" icon={ShoppingCart} title={t("home.shoppingTitle")}>
      <Flex align="baseline" gap={6}>
        <Typography.Text style={{ fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          <AnimatedNumber value={pending} />
        </Typography.Text>
        <Typography.Text type="secondary">{t("home.shoppingPending", { count: pending })}</Typography.Text>
      </Flex>
      {review > 0 ? (
        <Typography.Text style={{ color: token.colorWarningText }}>{t("home.shoppingReview", { count: review })}</Typography.Text>
      ) : (
        <Typography.Text type="secondary">{pending === 0 ? t("home.shoppingEmpty") : t("home.shoppingOpen")}</Typography.Text>
      )}
    </DashboardCard>
  );
}

function DashboardCard(props: ComponentProps<typeof NavCard>) {
  return (
    <StaggerItem style={{ height: "100%" }}>
      <NavCard {...props} />
    </StaggerItem>
  );
}

function RecentActivityCard() {
  const t = useT();
  const entries = useActivity({ limit: 6 });

  return (
    <StaggerItem style={{ height: "100%" }}>
      <Card title={t("home.recentActivity")} style={{ height: "100%" }} styles={{ body: { paddingBlock: 8 } }}>
        <ActivityList entries={entries} showPlace />
      </Card>
    </StaggerItem>
  );
}

/** Agenda de los próximos 7 días (incluye cumpleaños). */
function UpcomingCard() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const [from] = useState(() => dayjs().startOf("day").valueOf());
  const occurrences = useOccurrences(from, from + 7 * 86_400_000);

  return (
    <StaggerItem style={{ height: "100%" }}>
      <Card
        title={t("calendar.upcoming")}
        extra={<Link href="/calendario">{t("nav.routes.calendar")}</Link>}
        style={{ height: "100%" }}
        styles={{ body: { paddingBlock: 8 } }}
      >
        {occurrences?.length === 0 && (
          <Typography.Paragraph type="secondary" style={{ margin: "8px 0" }}>
            {t("calendar.nothingUpcoming")}
          </Typography.Paragraph>
        )}
        {occurrences?.slice(0, 6).map((occurrence) => {
          const palette = tint(token, occurrence.color);
          const Icon = APPEARANCE_ICONS[occurrence.icon ?? "star"];
          return (
            <Flex key={occurrence.key} align="center" gap={12} style={{ paddingBlock: 8 }}>
              <span style={{ display: "inline-flex", padding: 6, borderRadius: token.borderRadius, background: palette.bg, color: palette.solid }}>
                <Icon />
              </span>
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong ellipsis style={{ display: "block" }}>
                  {occurrence.birthdayOf ? t("calendar.birthday", { name: occurrence.title }) : occurrence.title}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: "capitalize" }}>
                  {format.date(occurrence.start, { weekday: "long", day: "numeric" })}
                  {!occurrence.allDay && ` · ${format.time(occurrence.start)}`}
                </Typography.Text>
              </div>
            </Flex>
          );
        })}
      </Card>
    </StaggerItem>
  );
}
