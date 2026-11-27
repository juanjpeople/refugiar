"use client";

import { theme } from "antd";
import { tint, type AppearanceColor } from "@/lib/appearance";

export type EmergencyIllustrationKind =
  | "cpr"
  | "choking"
  | "bleeding"
  | "burns"
  | "water"
  | "gas"
  | "outage";

interface EmergencyIllustrationProps {
  kind: EmergencyIllustrationKind;
  /** Etiqueta accesible para lectores de pantalla. Si se omite, el dibujo es decorativo. */
  label?: string;
}

const KIND_ACCENT: Record<EmergencyIllustrationKind, AppearanceColor> = {
  cpr: "red",
  choking: "volcano",
  bleeding: "red",
  burns: "cyan",
  water: "blue",
  gas: "orange",
  outage: "gold",
};

/**
 * Dibujo explicativo estilo manual de seguridad para las guías rápidas de Emergencias.
 * Vectorial 100 % offline: toma todos sus colores de `theme.useToken()` y `tint()`.
 */
export function EmergencyIllustration({ kind, label }: EmergencyIllustrationProps) {
  const { token } = theme.useToken();
  const accent = tint(token, KIND_ACCENT[kind]);
  const danger = tint(token, "red");
  const ok = tint(token, "green");
  const ink = token.colorText;
  const muted = token.colorTextSecondary;
  const surface = token.colorBgContainer;
  const subtle = token.colorFillAlter;
  const border = token.colorBorderSecondary;

  return (
    <svg
      viewBox="0 0 240 132"
      width="100%"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        display: "block",
        maxWidth: 420,
        borderRadius: token.borderRadiusLG,
        background: accent.bg,
        border: `1px solid ${border}`,
      }}
    >
      <rect x="8" y="8" width="224" height="116" rx="10" fill={surface} opacity="0.76" />

      {kind === "cpr" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="102" x2="164" y2="102" stroke={ink} strokeWidth="3" />
          <circle cx="42" cy="86" r="11" fill={surface} stroke={ink} strokeWidth="2.5" />
          <path d="M54 90 Q88 76 122 86 L154 94" fill="none" stroke={ink} strokeWidth="10" />
          <circle cx="88" cy="82" r="12" fill={accent.bg} stroke={accent.solid} strokeWidth="2.5" />
          <line x1="88" y1="24" x2="88" y2="66" stroke={ink} strokeWidth="5" />
          <path d="M76 58 L88 70 L100 58" fill="none" stroke={accent.solid} strokeWidth="3.5" />
          <path d="M76 42 L88 54 L100 42" fill="none" stroke={accent.solid} strokeWidth="2.5" opacity="0.65" />
          <rect x="172" y="34" width="48" height="62" rx="8" fill={surface} stroke={accent.solid} strokeWidth="2.2" />
          <path d="M180 62 L188 62 L192 48 L198 76 L203 62 L212 62" fill="none" stroke={accent.solid} strokeWidth="2.6" />
          <line x1="184" y1="84" x2="208" y2="84" stroke={muted} strokeWidth="2.5" />
        </g>
      )}

      {kind === "choking" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <circle cx="146" cy="34" r="10" fill={surface} stroke={ink} strokeWidth="2.5" />
          <path d="M142 46 L132 76 L140 108" fill="none" stroke={ink} strokeWidth="8" />
          <path d="M132 76 L122 108" fill="none" stroke={ink} strokeWidth="7" />
          <circle cx="94" cy="30" r="10" fill={subtle} stroke={ink} strokeWidth="2.5" />
          <path d="M94 42 L94 78 L86 108" fill="none" stroke={ink} strokeWidth="8" />
          <path d="M94 78 L106 108" fill="none" stroke={ink} strokeWidth="7" />
          <path d="M98 54 L132 66" fill="none" stroke={accent.solid} strokeWidth="6" />
          <circle cx="136" cy="67" r="6" fill={accent.solid} />
          <path d="M168 78 Q186 74 186 52" fill="none" stroke={accent.solid} strokeWidth="3.2" />
          <path d="M180 58 L186 48 L192 58" fill="none" stroke={accent.solid} strokeWidth="3.2" />
          <path d="M46 66 L70 66 M63 60 L70 66 L63 72" fill="none" stroke={muted} strokeWidth="2.5" />
        </g>
      )}

      {kind === "bleeding" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          {/* Brazo/extremidad apoyada con compresa limpia y presión firme */}
          <path d="M26 86 Q88 78 152 86" fill="none" stroke={ink} strokeWidth="14" />
          {/* Gasa / paño limpio sobre la herida */}
          <rect x="74" y="68" width="36" height="20" rx="4" fill={surface} stroke={accent.solid} strokeWidth="2.5" />
          <line x1="82" y1="78" x2="102" y2="78" stroke={accent.solid} strokeWidth="2.5" />
          {/* Flechas de presión firme y continua hacia abajo */}
          <path d="M92 26 L92 58 M82 48 L92 60 L102 48" fill="none" stroke={accent.solid} strokeWidth="3.5" />
          <path d="M74 34 L74 52 M110 34 L110 52" fill="none" stroke={muted} strokeWidth="2.2" />
          {/* Señal de mantener firme (tilde verde) */}
          <circle cx="190" cy="66" r="22" fill={ok.bg} stroke={ok.solid} strokeWidth="2.5" />
          <path d="M180 66 L187 73 L201 58" fill="none" stroke={ok.solid} strokeWidth="3.2" />
        </g>
      )}

      {kind === "burns" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M36 28 L72 28 Q84 28 84 40 L84 48" fill="none" stroke={ink} strokeWidth="6" />
          <rect x="28" y="22" width="14" height="12" rx="2" fill={ink} />
          <line x1="80" y1="54" x2="78" y2="82" stroke={accent.solid} strokeWidth="3" />
          <line x1="84" y1="54" x2="84" y2="86" stroke={accent.solid} strokeWidth="3" />
          <line x1="88" y1="54" x2="90" y2="82" stroke={accent.solid} strokeWidth="3" />
          <path d="M58 94 Q78 86 104 90 Q114 92 110 98 L62 104 Z" fill={surface} stroke={ink} strokeWidth="2.5" />
          <circle cx="84" cy="108" r="8" fill={ok.bg} stroke={ok.solid} strokeWidth="2" />
          <path d="M80 108 L83 111 L89 104" fill="none" stroke={ok.solid} strokeWidth="2.2" />
          <rect x="156" y="42" width="38" height="38" rx="6" fill={subtle} stroke={ink} strokeWidth="2.2" />
          <line x1="166" y1="52" x2="184" y2="70" stroke={muted} strokeWidth="2" />
          <line x1="184" y1="52" x2="166" y2="70" stroke={muted} strokeWidth="2" />
          <circle cx="175" cy="61" r="28" fill="none" stroke={danger.solid} strokeWidth="3.5" />
          <line x1="155" y1="41" x2="195" y2="81" stroke={danger.solid} strokeWidth="3.5" />
        </g>
      )}

      {kind === "water" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          {/* Olla hirviendo (1 minuto) */}
          <rect x="26" y="56" width="66" height="44" rx="6" fill={subtle} stroke={ink} strokeWidth="2.5" />
          <line x1="20" y1="64" x2="26" y2="64" stroke={ink} strokeWidth="3" />
          <line x1="92" y1="64" x2="98" y2="64" stroke={ink} strokeWidth="3" />
          <path d="M44 46 Q48 36 44 28 M59 46 Q63 36 59 28 M74 46 Q78 36 74 28" fill="none" stroke={accent.solid} strokeWidth="2.5" />
          <path d="M40 106 Q46 98 52 106 Q59 98 66 106 Q72 98 78 106" fill="none" stroke={danger.solid} strokeWidth="2.5" />
          {/* O bien 2 gotas de lavandina por litro */}
          <path d="M148 32 C141 43 139 49 139 53 A9 9 0 0 0 157 53 C157 49 155 43 148 32 Z" fill={accent.solid} />
          <path d="M172 44 C167 52 165 56 165 59 A7 7 0 0 0 179 59 C179 56 177 52 172 44 Z" fill={accent.solid} opacity="0.8" />
          {/* Jarra / botella limpia con tilde */}
          <rect x="142" y="72" width="44" height="34" rx="6" fill={surface} stroke={ink} strokeWidth="2.5" />
          <circle cx="204" cy="88" r="11" fill={ok.bg} stroke={ok.solid} strokeWidth="2.2" />
          <path d="M199 88 L203 92 L210 84" fill="none" stroke={ok.solid} strokeWidth="2.4" />
        </g>
      )}

      {kind === "gas" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <rect x="22" y="24" width="54" height="58" rx="4" fill={subtle} stroke={ink} strokeWidth="2.5" />
          <line x1="49" y1="24" x2="49" y2="82" stroke={ink} strokeWidth="2" />
          <path d="M22 24 L36 30 L36 76 L22 82 Z" fill={surface} stroke={ink} strokeWidth="2" />
          <path d="M56 42 Q70 36 80 42" fill="none" stroke={ok.solid} strokeWidth="2.5" />
          <path d="M56 54 Q72 48 84 54" fill="none" stroke={ok.solid} strokeWidth="2.5" />
          <path d="M56 66 Q68 60 78 66" fill="none" stroke={ok.solid} strokeWidth="2.5" />
          <line x1="94" y1="66" x2="154" y2="66" stroke={ink} strokeWidth="7" />
          <circle cx="124" cy="66" r="10" fill={surface} stroke={ink} strokeWidth="2.5" />
          <line x1="124" y1="38" x2="124" y2="94" stroke={accent.solid} strokeWidth="6" />
          <circle cx="124" cy="66" r="3" fill={ink} />
          <circle cx="124" cy="106" r="9" fill={ok.bg} stroke={ok.solid} strokeWidth="2" />
          <path d="M120 106 L123 109 L129 102" fill="none" stroke={ok.solid} strokeWidth="2.2" />
          <rect x="172" y="34" width="38" height="52" rx="6" fill={surface} stroke={ink} strokeWidth="2.2" />
          <rect x="184" y="47" width="14" height="26" rx="2" fill={subtle} stroke={ink} strokeWidth="2" />
          <circle cx="191" cy="60" r="28" fill="none" stroke={danger.solid} strokeWidth="3.5" />
          <line x1="171" y1="40" x2="211" y2="80" stroke={danger.solid} strokeWidth="3.5" />
        </g>
      )}

      {kind === "outage" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <rect x="24" y="24" width="58" height="78" rx="6" fill={subtle} stroke={ink} strokeWidth="2.5" />
          <rect x="34" y="38" width="14" height="30" rx="2" fill={surface} stroke={ink} strokeWidth="2" />
          <rect x="58" y="38" width="14" height="30" rx="2" fill={surface} stroke={ink} strokeWidth="2" />
          <rect x="36" y="54" width="10" height="10" rx="1" fill={accent.solid} />
          <rect x="60" y="54" width="10" height="10" rx="1" fill={accent.solid} />
          <path d="M53 84 L53 94 M48 89 L53 94 L58 89" fill="none" stroke={ok.solid} strokeWidth="2.5" />
          <rect x="102" y="56" width="38" height="18" rx="4" fill={ink} />
          <path d="M140 53 L152 46 L152 84 L140 77 Z" fill={accent.solid} stroke={ink} strokeWidth="2" />
          <path d="M156 54 L172 48 M156 65 L176 65 M156 76 L172 82" stroke={accent.solid} strokeWidth="2.5" />
          <circle cx="122" cy="96" r="9" fill={ok.bg} stroke={ok.solid} strokeWidth="2" />
          <path d="M118 96 L121 99 L127 92" fill="none" stroke={ok.solid} strokeWidth="2.2" />
          <rect x="184" y="26" width="34" height="76" rx="5" fill={surface} stroke={ink} strokeWidth="2.5" />
          <line x1="184" y1="54" x2="218" y2="54" stroke={ink} strokeWidth="2" />
          <line x1="191" y1="36" x2="191" y2="46" stroke={muted} strokeWidth="2.5" />
          <line x1="191" y1="62" x2="191" y2="78" stroke={muted} strokeWidth="2.5" />
        </g>
      )}
    </svg>
  );
}
