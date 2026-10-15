import {
  Accessibility,
  BellOff,
  BellRing,
  Boxes,
  Bug,
  Cake,
  ChefHat,
  Cloud,
  Code2,
  Crosshair,
  Cpu,
  DoorOpen,
  Download,
  GraduationCap,
  KeyRound,
  Leaf,
  Lock,
  LockKeyhole,
  NotebookPen,
  Puzzle,
  Scale,
  ScanBarcode,
  Server,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Users,
  Vote,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { HouseHighlight } from "@/components/illustrations/House";
import type { Messages } from "@/i18n/messages";
import type { AppearanceColor } from "@/lib/appearance";

/**
 * Estructura de la landing (orden, íconos y colores). Los textos viven en el diccionario,
 * bajo `landing.*` (en `src/i18n/messages/`). Mantener en sync con VALORES.md y ROADMAP.md.
 */

export type HeroVariant = keyof Messages["landing"]["hero"]["variants"];

/** Alternativas del título del hero; se comparan con /bienvenida?v=…. La primera es la que se ve por defecto. */
export const HERO_VARIANTS: readonly HeroVariant[] = ["a", "b", "c", "d", "e"];

export type SolutionKey = keyof Messages["landing"]["solutions"]["items"];

/**
 * Lo que ya se puede usar, cada uno con su color y su escena. `fresh`: llegó en esta versión.
 * Las escenas usan piezas reales de la app (ver `Scenes.tsx`).
 */
export const SOLUTIONS: { key: SolutionKey; icon: LucideIcon; color: AppearanceColor; fresh?: boolean }[] = [
  { key: "inventory", icon: Boxes, color: "gold" },
  { key: "shopping", icon: ShoppingCart, color: "green" },
  { key: "school", icon: GraduationCap, color: "geekblue" },
  { key: "recipes", icon: ChefHat, color: "volcano" },
  { key: "spot", icon: Crosshair, color: "orange", fresh: true },
  { key: "barcode", icon: ScanBarcode, color: "cyan", fresh: true },
  { key: "quick", icon: NotebookPen, color: "purple", fresh: true },
];

export type FamilyRoleKey = keyof Messages["landing"]["family"]["items"];

/** Perfiles pensados para convivir. */
export const FAMILY_ROLES: { key: FamilyRoleKey; icon: LucideIcon; color: AppearanceColor }[] = [
  { key: "admin", icon: ShieldCheck, color: "blue" },
  { key: "adult", icon: Users, color: "green" },
  { key: "kid", icon: Sparkles, color: "orange" },
];

/** Cada valor enciende una parte de la casa (ver House.tsx). */
export type ValueKey = HouseHighlight;

export const VALUES: { key: ValueKey; icon: LucideIcon }[] = [
  { key: "datos", icon: Lock },
  { key: "offline", icon: WifiOff },
  { key: "cuentas", icon: Scale },
  { key: "familia", icon: Users },
  { key: "abierto", icon: DoorOpen },
  { key: "calma", icon: Leaf },
];

export type TransparencyStageKey = keyof Messages["landing"]["transparency"]["stages"];

/** Recorrido conceptual: explica límites de confianza sin publicar detalles operativos. */
export const TRANSPARENCY_STAGES: { key: TransparencyStageKey; icon: LucideIcon }[] = [
  { key: "device", icon: Smartphone },
  { key: "encryption", icon: LockKeyhole },
  { key: "cloud", icon: Cloud },
  { key: "family", icon: KeyRound },
];

export type TrustProofKey = keyof Messages["landing"]["transparency"]["proofs"];

export const TRUST_PROOFS: { key: TrustProofKey; icon: LucideIcon; href?: string }[] = [
  { key: "source", icon: Code2, href: "https://github.com/juanjpeople/opendomus" },
  { key: "checks", icon: ShieldCheck, href: "https://github.com/juanjpeople/opendomus/actions" },
  { key: "exit", icon: Download },
  { key: "report", icon: Bug, href: "https://github.com/juanjpeople/opendomus/security" },
];

export type GuidelineKey = keyof Messages["landing"]["guidelines"]["items"];

/** Los valores bajados a reglas concretas para tomar decisiones de producto y de código. */
export const GUIDELINES: { key: GuidelineKey; icon: LucideIcon }[] = [
  { key: "export", icon: Download },
  { key: "consent", icon: ShieldCheck },
  { key: "local", icon: WifiOff },
  { key: "modules", icon: Puzzle },
  { key: "permissions", icon: KeyRound },
  { key: "ages", icon: Accessibility },
  { key: "calm", icon: BellOff },
  { key: "hardware", icon: Server },
];

export type UpcomingKey = keyof Messages["landing"]["upcoming"]["items"];

/**
 * Lo planificado que todavía no está: se muestra como tal, con su etiqueta. Sale de ROADMAP.md
 * (⏭️ Después y las ideas ya decididas): al mover algo ahí, revisar esta lista.
 */
export const UPCOMING: { key: UpcomingKey; icon: LucideIcon; color: AppearanceColor }[] = [
  { key: "reminders", icon: BellRing, color: "magenta" },
  { key: "teens", icon: Cake, color: "orange" },
  { key: "perPerson", icon: Smartphone, color: "blue" },
  { key: "vote", icon: Vote, color: "green" },
  { key: "localKeys", icon: LockKeyhole, color: "purple" },
  { key: "esp32", icon: Cpu, color: "cyan" },
];

export type PhaseKey = keyof Messages["landing"]["roadmap"]["phases"];

/** Fases para la landing, resumen de ROADMAP.md: al mover algo ahí, revisar estas. */
export const ROADMAP: { key: PhaseKey; current?: boolean }[] = [
  { key: "p1" },
  { key: "p2", current: true },
  { key: "p3" },
  { key: "p4" },
  { key: "p5" },
];
