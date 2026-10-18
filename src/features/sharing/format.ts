import type { Translator } from "@/i18n/translate";
import { sharedName, type SharedContentV1, type SharedRecipe } from "./domain";

export function contentText(content: SharedContentV1, t: Translator): string {
  const recipe = (r: SharedRecipe) =>
    [
      r.name,
      `${t("sharing.servings", { count: r.servings })} · ${t("sharing.minutes", { count: r.minutes })}`,
      ...r.tags.map((tag) => t(`recipes.tags.${tag}`)),
      t("sharing.ingredients"),
      ...r.ingredients.map((i) => `• ${i.quantity} ${i.unit} · ${i.name}`),
      t("sharing.steps"),
      ...r.steps.map(
        (s, i) =>
          `${i + 1}. ${s}${r.stepSeconds[i] ? ` (${t("sharing.seconds", { count: r.stepSeconds[i] })})` : ""}`,
      ),
    ].join("\n");
  if (content.kind === "recipe") return recipe(content.recipe);
  if (content.kind === "shopping-list")
    return [
      content.name,
      ...content.items.map(
        (item) =>
          `${item.bought ? "☑" : "☐"} ${item.quantity} ${item.unit} · ${item.name}${item.estimateCents !== undefined ? ` · ${content.currency} ${(item.estimateCents / 100).toFixed(2)}` : ""}`,
      ),
    ].join("\n");
  if (content.kind === "event")
    return [
      content.name,
      content.allDay
        ? `${content.startDate} – ${content.endDate} · ${t("sharing.allDay")}`
        : `${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: content.timeZone }).format(content.start)} – ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: content.timeZone }).format(content.end)}`,
      t("sharing.timezone", { zone: content.timeZone }),
      content.notes,
    ]
      .filter(Boolean)
      .join("\n");
  if (content.kind === "project")
    return [
      content.name,
      content.notes,
      t("sharing.tasks"),
      ...content.tasks.map((text, i) => `${i + 1}. ${text}`),
      t("sharing.materials"),
      ...content.materials.map(
        (item) =>
          `• ${item.quantity} ${item.unit} · ${item.name}${item.costCents !== undefined ? ` · ${content.currency} ${(item.costCents / 100).toFixed(2)}` : ""}`,
      ),
      content.budgetCents !== undefined
        ? `${t("sharing.costs")}: ${content.currency} ${(content.budgetCents / 100).toFixed(2)}`
        : "",
      ...content.expenses.map(
        (e) =>
          `${e.label} · ${content.currency} ${(e.cents / 100).toFixed(2)} · ${e.date}`,
      ),
      ...content.journal.map((note) => note.text),
      content.outcome,
      content.lessons,
      ...content.contacts.map(
        (contact) => `${contact.name} · ${contact.role} · ${contact.details}`,
      ),
    ]
      .filter(Boolean)
      .join("\n");
  return [
    content.name,
    content.week,
    ...content.meals.map((meal) => {
      const date = new Date(`${content.week}T12:00:00`);
      date.setDate(date.getDate() + meal.day);
      return `${date.toLocaleDateString()} · ${content.recipes[meal.recipe].name} · ${t("sharing.servings", { count: meal.servings })}`;
    }),
    ...content.recipes.map(recipe),
  ].join("\n\n");
}
export function shareMessage(
  content: SharedContentV1,
  t: Translator,
  full: boolean,
  link = "",
) {
  return [
    full ? contentText(content, t) : sharedName(content),
    t(link ? "sharing.summary" : "sharing.summaryText", {
      kind: t(`sharing.kinds.${content.kind}`),
    }),
    link,
  ]
    .filter(Boolean)
    .join("\n\n");
}
const escapeIcs = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r/g, "");
const utc = (time: number) =>
  new Date(time)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function eventIcs(
  content: Extract<SharedContentV1, { kind: "event" }>,
  id: string,
): string {
  const end = new Date(`${content.endDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Refugiar//Shared event//EN",
    "BEGIN:VEVENT",
    `UID:${id}@refugi.ar`,
    `DTSTAMP:${utc(content.publishedAt)}`,
    `SUMMARY:${escapeIcs(content.name)}`,
    ...(content.allDay
      ? [
          `DTSTART;VALUE=DATE:${content.startDate.replace(/-/g, "")}`,
          `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`,
        ]
      : [
          `DTSTART:${utc(content.start)}`,
          ...(content.end > content.start ? [`DTEND:${utc(content.end)}`] : []),
        ]),
    ...(content.notes ? [`DESCRIPTION:${escapeIcs(content.notes)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // RFC 5545 folds at 75 octets, preserving Unicode code points and CRLF.
  return (
    lines
      .map((line) => {
        let out = "",
          size = 0;
        for (const char of line) {
          const n = new TextEncoder().encode(char).length;
          if (size + n > 75) {
            out += "\r\n ";
            size = 1;
          }
          out += char;
          size += n;
        }
        return out;
      })
      .join("\r\n") + "\r\n"
  );
}
