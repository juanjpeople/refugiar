import {
  Apple,
  Milk,
  Beef,
  Wheat,
  Package,
  CupSoda,
  Sparkles,
  Heart,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

export const SHOPPING_CATEGORIES = [
  "frescos",
  "lacteos",
  "carniceria",
  "panaderia",
  "almacen",
  "bebidas",
  "limpieza",
  "perfumeria",
  "otros",
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export const CATEGORY_ICONS: Record<ShoppingCategory, LucideIcon> = {
  frescos: Apple,
  lacteos: Milk,
  carniceria: Beef,
  panaderia: Wheat,
  almacen: Package,
  bebidas: CupSoda,
  limpieza: Sparkles,
  perfumeria: Heart,
  otros: ShoppingBag,
};

export const CATEGORY_TAG_COLORS: Record<ShoppingCategory, string> = {
  frescos: "green",
  lacteos: "gold",
  carniceria: "red",
  panaderia: "orange",
  almacen: "blue",
  bebidas: "cyan",
  limpieza: "purple",
  perfumeria: "magenta",
  otros: "default",
};

/**
 * Clasifica automáticamente un producto según su nombre en el rubro del supermercado.
 * Normaliza tildes y mayúsculas para emparejar con palabras clave cotidianas.
 */
export function guessShoppingCategory(name: string): ShoppingCategory {
  const norm = " " + name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + " ";
  const matches = (pattern: RegExp) => pattern.test(norm);

  if (matches(/(\bleches?|\bquesos?|\byogur\w*|\bcremas?|\bmantecas?|\bricotas?|\bdulce de leche|\bddl|\bmuzzarella|\bmozzarella|\bparmesan\w*|\bsardo|\broquefort|\bcheddar|\bpostres?)\b/i)) {
    return "lacteos";
  }
  if (matches(/(\bmanzanas?|\bbananas?|\bnaranjas?|\blimon(es)?|\bperas?|\bfrutillas?|\buvas?|\bpaltas?|\btomates?|\blechugas?|\bcebollas?|\bpapas?|\bzanahorias?|\bespinacas?|\bacelgas?|\bmorron(es)?|\bpimientos?|\bajos?|\bperejil|\bcalabazas?|\bzapallos?|\bchoclos?|\bpepinos?|\bberenjenas?|\bbrocoli|\bcoliflor|\bverduras?|\bfrutas?|\bensaladas?|\bpomelos?|\bmandarinas?|\bsandias?|\bmelones?|\bduraznos?|\bciruelas?)\b/i)) {
    return "frescos";
  }
  if (matches(/(\bcarnes?|\bpollos?|\basados?|\bpicadas?|\bbifes?|\bmilanesas?|\bcerdos?|\bbondiolas?|\bpechugas?|\bpatas?|\bmuslos?|\bpescados?|\batun(es)?|\bmerluzas?|\bsalmon(es)?|\bjamon(es)?|\bsalchichas?|\bchorizos?|\bmorcillas?|\bpancetas?|\bhamburguesas?)\b/i)) {
    return "carniceria";
  }
  if (matches(/(\bpan(es)?|\btostadas?|\bgallet\w*|\bmedialunas?|\bfacturas?|\bprepizzas?|\bpizzas?|\btapas?|\bempanadas?|\btartas?|\bmasas?|\bbizcoch\w*|\bbaguettes?|\bcrioll\w*)\b/i)) {
    return "panaderia";
  }
  if (matches(/(\baguas?|\bsodas?|\bgaseosas?|\bjugos?|\bvinos?|\bcervezas?|\bcafes?|\bte\b|\byerbas?|\bmates?|\bfernet|\baperitivos?|\bvermut|\blicor(es)?|\bamargos?|\bcoca|\bsprite|\bpepsi)\b/i)) {
    return "bebidas";
  }
  if (matches(/(\bdetergentes?|\blavandinas?|\bjabones?|\bsuavizantes?|\brollos?|\bpapel higienico|\bservilletas?|\besponjas?|\bdesinfectantes?|\btrapos?|\bfranelas?|\blavavajillas?|\blimpiador(es)?|\baerosol(es)?|\bceras?|\bbolsas? de residuos?)\b/i)) {
    return "limpieza";
  }
  if (matches(/(\bshampoo|\bacondicionador(es)?|\bdesodorantes?|\bpastas? dental(es)?|\bcremas? dental(es)?|\bcepillos? de dientes|\btoallitas?|\bpanales?|\balgodon(es)?|\bafeitadoras?)\b/i)) {
    return "perfumeria";
  }
  if (matches(/(\barroz|\bfideos?|\bpastas?|\bharinas?|\baceites?|\bazucar|\bsal\b|\bpimientas?|\boreganos?|\bcondimentos?|\bcaldos?|\bsalsas?|\bpure de tomates?|\bmayonesas?|\bmostazas?|\bketchup|\bvinagres?|\bconservas?|\blentejas?|\bgarbanzos?|\bporotos?|\blatas?|\bcacao|\bcereales?|\bavenas?|\bpolentas?)\b/i)) {
    return "almacen";
  }
  return "otros";
}
