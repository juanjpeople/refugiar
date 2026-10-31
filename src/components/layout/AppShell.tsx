"use client";

import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { CloudConsent } from "@/features/settings/components/CloudConsent";
import { useCalendarReminders } from "@/features/calendar/useCalendarReminders";
import { haloBackground } from "@/skins/surface";
import { useSkin } from "@/skins/useSkin";
import { DEMO_ENABLED } from "@/lib/demo";
import { sendPulse } from "@/lib/cloud/pulse";
import { Alert, Button, ConfigProvider, Drawer, Flex, Grid, Layout, Tooltip, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { House, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { LockScreen } from "@/components/auth/LockScreen";
import { MembersBridge } from "@/components/auth/MembersBridge";
import { HouseMark } from "@/components/illustrations/HouseMark";
import { BOTTOM_BAR_HEIGHT, MobileHeader, Callout } from "@/components/ui";
import { guardians } from "@/features/members/domain";
import { useHistoryNavigation } from "@/hooks/useHistoryNavigation";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";
import { useNativeBack } from "@/hooks/useNativeBack";
import { useHydrated } from "@/hooks/useHydrated";
import { usePreferences } from "@/hooks/usePreferences";
import { useT } from "@/i18n";
import { deviceProfiles, kidEntryAllowed, useCurrentUser, useIsLocked, useLockStore, useMembersStore, useSessionStore } from "@/lib/auth/session";
import { FONT_SIZES } from "@/lib/theme";
import { APP_ROUTES, CONTENT_WIDTH, findRoute, getRouteTrail } from "@/lib/navigation/routes";
import { useDeviceStore } from "@/store/useDeviceStore";
import { useUiStore } from "@/store/useNavigationStore";
import type { SidebarMode } from "@/store/usePreferencesStore";
import { CommandPalette } from "./CommandPalette";
import { DataModeBadge } from "./DataModeBadge";
import { HEADER_HEIGHT_VAR, SIDEBAR_WIDTH } from "./constants";
import { HeaderActions, UserMenu } from "./HeaderActions";
import { HeaderNavigation } from "./HeaderNavigation";
import { MobileBar, useMobileBarVisible } from "./MobileBar";
import { Navigation } from "./Navigation";
import { ProfilePicker } from "./ProfilePicker";
import { useAutoLock, useGlobalShortcuts, useKeepLocalData, useNavigationTracking, useToggleSidebar } from "./useShell";

const { Header, Content } = Layout;

/** Rutas públicas: se ven sin sesión y sin el layout de la app (la landing, la bienvenida). */
const PUBLIC_ROUTES = APP_ROUTES.filter((route) => route.external).map((route) => route.href);
const STATIC_PUBLIC_ROUTES = ["/bienvenida", "/politica-de-privacidad", "/borrar-cuenta"];

/**
 * Estructura de la app. Decide qué mostrar según el estado del dispositivo y la sesión:
 * primera vez → landing · cargando → selector de perfil → layout (estándar o infantil).
 */
export function AppShell({ children }: { children: ReactNode }) {
  useNativeBack();
  useCalendarReminders();
  const t = useT();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const membersLoaded = useMembersStore((s) => s.members !== null);
  const membersLoadFailed = useMembersStore((s) => s.loadFailed);
  const members = useMembersStore((s) => s.members);
  const locked = useIsLocked();
  const unlock = useLockStore((s) => s.unlock);
  const signOut = useSessionStore((s) => s.signOut);
  const router = useRouter();
  const mode = useDeviceStore((s) => s.mode);
  const isPublic = PUBLIC_ROUTES.includes(pathname);
  // Primera vez en este dispositivo: arranca por la landing, no por "¿Quién está en casa?".
  const firstVisit = hydrated && mode === "unset" && !isPublic;

  useEffect(() => {
    if (firstVisit) router.replace(DEMO_ENABLED ? "/empezar" : "/bienvenida");
  }, [firstVisit, router]);

  useEffect(() => {
    if (pathname === "/bienvenida" || pathname === "/empezar") sendPulse("landing");
  }, [pathname]);

  // Páginas fijas que se leen antes de hidratar (buscadores, revisión de Play Store): no dependen del dispositivo.
  if (isPublic && STATIC_PUBLIC_ROUTES.includes(pathname)) return children;
  if (!hydrated) return null;
  if (isPublic) return CLOUD_ENABLED && ["/cuenta", "/unirme", "/feedback"].includes(pathname) ? <CloudConsent>{children}</CloudConsent> : children;
  if (firstVisit) return null;

  if (hydrated && membersLoadFailed) {
    return (
      <Flex vertical align="center" justify="center" gap={16} style={{ minHeight: "100vh", padding: 24 }}>
        <Alert type="error" showIcon title={t("errors.databaseLoad")} />
        <Button onClick={() => window.location.reload()}>{t("common.reload")}</Button>
      </Flex>
    );
  }

  if (!hydrated || !membersLoaded) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }} role="status" aria-label={t("common.loading")}>
        <MembersBridge />
        <HouseMark size={56} loading />
      </Flex>
    );
  }

  if (!user) {
    return (
      <>
        <MembersBridge />
        <ProfilePicker />
      </>
    );
  }

  // Perfil protegido: hasta desbloquear no se ve nada de la app (fail-closed).
  if (locked) {
    return (
      <>
        <MembersBridge />
        <LockScreen key={user.id} member={user} guardians={guardians(deviceProfiles(members ?? []))} onUnlock={() => unlock(user.id)} onSwitchProfile={signOut} />
      </>
    );
  }

  // Un chico sin ningún grande protegido en el dispositivo espera a que uno ponga su PIN (ver `canEnterKid`).
  if (user.role === "kid" && !kidEntryAllowed(members ?? [])) {
    return (
      <>
        <MembersBridge />
        <Flex vertical align="center" justify="center" gap={16} style={{ minHeight: "100vh", padding: 24 }}>
          <div style={{ maxWidth: 440 }}>
            <Callout tone="warning" title={t("kidGate.waitTitle")}>{t("kidGate.waitText")}</Callout>
          </div>
          <Button type="primary" onClick={signOut}>{t("lock.switchProfile")}</Button>
        </Flex>
      </>
    );
  }

  return (
    <>
      <MembersBridge />
      {user.role === "kid" ? <KidsLayout>{children}</KidsLayout> : <DefaultLayout>{children}</DefaultLayout>}
    </>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  const { token } = theme.useToken();
  const t = useT();

  return (
    <Flex align="center" gap={10} style={{ minWidth: 0 }}>
      <HouseMark size={26} />
      <Typography.Text
        strong
        style={{
          fontSize: token.fontSizeXL,
          color: token.colorText,
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
          opacity: compact ? 0 : 1,
          transition: "opacity 0.15s",
        }}
      >
        {t("common.appName")}
      </Typography.Text>
    </Flex>
  );
}

/**
 * Escritorio: menú lateral completo, solo íconos u oculto (preferencia del perfil).
 * Mobile (< md) o menú oculto: el botón del header abre un Drawer.
 */
function DefaultLayout({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  const skin = useSkin();
  const t = useT();
  const screens = Grid.useBreakpoint();
  const { sidebar } = usePreferences();
  const pathname = usePathname();
  // Cada página usa el ancho que le sirve: las grillas y tableros, toda la pantalla; el resto, uno cómodo de leer.
  const contentWidth = CONTENT_WIDTH[findRoute(pathname)?.width ?? "default"];
  const drawerOpen = useUiStore((s) => s.navDrawerOpen);
  const headerRef = useMeasuredHeader();
  const setDrawerOpen = useUiStore((s) => s.setNavDrawerOpen);
  const toggleSidebar = useToggleSidebar();
  useGlobalShortcuts();
  useNavigationTracking();
  useAutoLock();
  useKeepLocalData();

  const isMobile = !screens.md;
  const tail = useBreadcrumbStore((state) => state.tail);
  const currentRoute = findRoute(pathname);
  const history = useHistoryNavigation();
  const mobileTitle = tail.at(-1)?.label ?? (currentRoute ? t(currentRoute.labelKey) : "");
  const router = useRouter();
  const parentRoute = getRouteTrail(currentRoute).at(-2);
  const back = currentRoute?.parent ? () => {
    if (history.canGoBack) history.back();
    else router.replace(parentRoute?.needsId ? "/inventario" : parentRoute?.href ?? "/");
  } : undefined;
  const barVisible = useMobileBarVisible() && isMobile;
  const mode: SidebarMode = isMobile ? "hidden" : sidebar;
  const collapsed = mode === "collapsed";

  return (
    <Layout hasSider style={{ minHeight: "100vh" }}>
      <Drawer
        placement="left"
        size={SIDEBAR_WIDTH.expanded + 20}
        title={<Brand />}
        open={drawerOpen && mode === "hidden" && !isMobile}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: "8px 0" } }}
        footer={
          <Flex vertical gap={8}>
            <DataModeBadge />
            <UserMenu labeled onSelect={() => setDrawerOpen(false)} />
          </Flex>
        }
      >
        <Navigation layoutGroup="drawer" onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      {/* El ancho se anima con CSS (una sola propiedad, en un solo elemento). */}
      <aside
        aria-hidden={mode === "hidden"}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          flexShrink: 0,
          width: SIDEBAR_WIDTH[mode],
          overflow: "hidden",
          background: token.colorBgContainer,
          borderInlineEnd: mode === "hidden" ? "none" : `1px solid ${token.colorBorderSecondary}`,
          transition: "width 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {mode !== "hidden" && (
          <>
            <Flex align="center" style={{ height: 64, paddingInline: 23, flexShrink: 0 }}>
              <Brand compact={collapsed} />
            </Flex>
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
              <Navigation collapsed={collapsed} />
            </div>
            {/* Abajo, siempre a la vista: dónde vive la casa (y el botón del menú). */}
            <Flex
              vertical={collapsed}
              align="center"
              justify={collapsed ? "center" : "space-between"}
              gap={8}
              style={{ padding: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}
            >
              <DataModeBadge iconOnly={collapsed} />
              <Tooltip title={`${t(collapsed ? "nav.expand" : "nav.collapse")} (Ctrl+B)`} placement="right">
                <Button
                  type="text"
                  aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
                  icon={collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                  onClick={toggleSidebar}
                />
              </Tooltip>
            </Flex>
          </>
        )}
      </aside>

      <Layout style={{ minWidth: 0 }}>
        <Header
          ref={headerRef}
          style={{
            display: "flex",
            flexWrap: "wrap",
            height: "auto",
            minHeight: isMobile ? token.controlHeightLG : token.controlHeight * 2,
            paddingBlock: token.paddingXS,
            paddingTop: `max(${token.paddingXS}px, env(safe-area-inset-top, 0px))`,
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            paddingInline: isMobile ? 12 : 20,
            position: "sticky",
            top: 0,
            zIndex: 10,
            backdropFilter: "blur(12px)",
            background: `color-mix(in srgb, ${token.colorBgContainer} 75%, transparent)`,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {isMobile ? <MobileHeader title={mobileTitle} onBack={back} actions={<HeaderActions search />} /> : <>
          {/* Toma solo el espacio que sobra: unas migas largas se recortan en lugar de bajar las acciones a otro renglón. */}
          <Flex align="center" gap={4} style={isMobile ? { minWidth: 0 } : { flex: "1 1 0", minWidth: token.controlHeight * (mode === "hidden" ? 3 : 2) + 16 }}>
            {mode === "hidden" && (
              <Tooltip title={isMobile ? undefined : `${t("common.openMenu")} (Ctrl+B)`}>
                <Button type="text" aria-label={t("common.openMenu")} icon={<Menu />} style={isMobile ? { width: 44, height: 44 } : undefined} onClick={toggleSidebar} />
              </Tooltip>
            )}
            {isMobile && screens.sm && <HouseMark size={22} />}
            <HeaderNavigation />
          </Flex>
          <HeaderActions search />
          </>}
        </Header>
        {/* El mismo resplandor de marca que la landing: da profundidad sin costo (es un gradiente). */}
        <Content
          style={{
            // Abajo, en el celular, el lugar de la barra (más el margen seguro del teléfono).
            padding: barVisible
              ? `24px 16px calc(${BOTTOM_BAR_HEIGHT + 24}px + env(safe-area-inset-bottom, 0px))`
              : isMobile ? "24px 16px" : screens.xl ? "32px 40px" : "32px 24px",
            background: haloBackground(skin, `radial-gradient(ellipse 70% 40% at 60% -5%, ${token.colorPrimaryBg}, transparent 70%)`),
            // Del alto de la pantalla, no del contenido: si no, el halo se achica y crece al cambiar de página.
            backgroundSize: "100% 100vh",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div style={{ maxWidth: contentWidth, margin: "0 auto" }}>{children}</div>
        </Content>
        {barVisible && <MobileBar />}
      </Layout>

      <CommandPalette />
    </Layout>
  );
}

/**
 * Layout infantil: más grande y colorido. Se adapta con tokens (componentSize, fontSize),
 * así los componentes no necesitan saber nada del rol.
 */
function KidsLayout({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  const t = useT();
  useNavigationTracking();
  useAutoLock();

  return (
    <ConfigProvider componentSize="large" theme={{ token: { fontSize: FONT_SIZES.xl, borderRadius: 16 } }}>
      <Layout style={{ minHeight: "100vh", background: token.colorWarningBg }}>
        <Header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "transparent", paddingInline: 16 }}>
          {/* Sin menú lateral: Inicio es el mapa de un chico (su día, la escuela, el calendario y las recetas). */}
          <Link href="/"><Button icon={<House />}>{t("nav.routes.home")}</Button></Link>
          <HeaderActions />
        </Header>
        <Content style={{ padding: 16 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <Typography.Title style={{ color: token.colorWarning, margin: 0 }}>
              <motion.span
                animate={{ rotate: [0, -12, 12, -6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 3 }}
                style={{ display: "inline-block" }}
              >
                🏰
              </motion.span>{" "}
              {t("shell.kidsTitle")}
            </Typography.Title>
            <Typography.Text strong style={{ color: token.colorWarningText, fontSize: FONT_SIZES.xl }}>
              {t("shell.kidsSubtitle")}
            </Typography.Text>
          </div>
          <main
            style={{
              maxWidth: 800,
              margin: "0 auto",
              padding: 24,
              background: token.colorBgContainer,
              borderRadius: 24,
              border: `4px solid ${token.colorWarningBorder}`,
            }}
          >
            {children}
          </main>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}

/**
 * Mide la barra fija de arriba y publica su alto (en el store y como variable CSS), para que los
 * índices y paneles pegajosos frenen debajo de ella y nunca queden tapados por las migas.
 */
function useMeasuredHeader() {
  const setHeaderHeight = useUiStore((s) => s.setHeaderHeight);
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(() => () => observer.current?.disconnect(), []);
  return useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    const publish = () => {
      const height = Math.round(node.getBoundingClientRect().height);
      document.documentElement.style.setProperty(HEADER_HEIGHT_VAR, `${height}px`);
      setHeaderHeight(height);
    };
    publish();
    observer.current = new ResizeObserver(publish);
    observer.current.observe(node);
  }, [setHeaderHeight]);
}
