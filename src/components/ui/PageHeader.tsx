"use client";

import { Flex, Grid, Typography, theme } from "antd";
import { createContext, useContext, type ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Modo del encabezado para toda la app. Lo provee ThemeProvider con la preferencia del perfil
 * (`headerDensity`); sin proveedor (panel de operador) queda el cómodo. Así PageHeader no depende
 * de los stores de la app.
 */
export const HeaderDensityContext = createContext<"comfortable" | "compact">("comfortable");

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Conserva datos esenciales (por ejemplo el código QR) también en modo compacto. */
  keepDescription?: boolean;
  /** Texto chico arriba del título (sección, fecha, contexto). */
  eyebrow?: ReactNode;
  /** Ruta tocable arriba del título (PathCrumbs), en páginas anidadas. Reemplaza al eyebrow. */
  crumbs?: ReactNode;
  /** Acciones a la derecha (botones, filtros). Como mucho dos visibles; el resto, en un Dropdown. */
  extra?: ReactNode;
  /** Identidad de la entidad a la izquierda del título (IconTile solid), en páginas de detalle. */
  leading?: ReactNode;
  /** Fuerza el modo. Por defecto sigue la preferencia "Encabezado" del perfil (`headerDensity`). */
  dense?: boolean;
}

/**
 * Encabezado estándar de toda página. Una sola por página. En modo compacto (siempre en el celular) queda solo el título,
 * más chico, y las acciones: la bajada y el eyebrow ceden su lugar a los datos.
 */
export function PageHeader({ title, description, keepDescription = false, eyebrow, crumbs, extra, leading, dense }: PageHeaderProps) {
  const { token } = theme.useToken();
  const density = useContext(HeaderDensityContext);
  const screens = Grid.useBreakpoint();
  // En el celular, siempre compacto: la pantalla es para los datos, no para la bajada.
  const compact = dense ?? (density === "compact" || screens.md === false);
  if (compact) {
    if (!keepDescription) description = undefined;
    eyebrow = undefined;
  }

  return (
    <Reveal>
      {crumbs && <div style={{ marginBottom: token.marginXS }}>{crumbs}</div>}
      <Flex justify="space-between" align={compact ? "center" : "flex-end"} gap={compact ? token.marginSM : 16} wrap style={{ marginBottom: compact ? token.margin : 32 }}>
        <Flex align="center" gap={compact ? token.marginSM : 16} style={{ minWidth: 0 }}>
          {leading}
          <div style={{ minWidth: 0 }}>
            {eyebrow && !crumbs && (
              <Typography.Text
                strong
                style={{ color: token.colorTextSecondary, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: token.fontSizeSM }}
              >
                {eyebrow}
              </Typography.Text>
            )}
            <Typography.Title level={2} style={{ fontSize: compact ? token.fontSizeHeading4 : token.fontSizeHeading2, margin: eyebrow && !crumbs ? "4px 0 0" : 0, letterSpacing: "-0.025em", overflowWrap: "anywhere" }}>
              {title}
            </Typography.Title>
            {description && (
              <Typography.Paragraph type="secondary" style={{ margin: "6px 0 0", fontSize: token.fontSizeLG }}>
                {description}
              </Typography.Paragraph>
            )}
          </div>
        </Flex>
        {extra && <Flex gap={8} wrap>{extra}</Flex>}
      </Flex>
    </Reveal>
  );
}
