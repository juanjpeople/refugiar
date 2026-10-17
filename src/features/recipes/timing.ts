/** Only an explicit, unambiguous duration is offered; never infer cooking times. */
export function suggestedSeconds(text: string): number | null {
  if (/\d\s*(?:-|–|a|to)\s*\d/i.test(text)) return null;
  const matches = [...text.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(horas?|hours?|minutos?|minutes?|min|segundos?|seconds?|sec)\b/gi)];
  if (matches.length !== 1) return null;
  const [, number, unit] = matches[0];
  const seconds = Math.round(Number(number.replace(",", ".")) * (/^(hora|hour)/i.test(unit) ? 3600 : /^min/i.test(unit) ? 60 : 1));
  return seconds > 0 && seconds <= 86400 ? seconds : null;
}

export interface KitchenTimer { id: number; step: number; endAt: number; seconds: number }
export function remainingSeconds(timer: KitchenTimer, now: number) {
  return Math.max(0, Math.ceil((timer.endAt - now) / 1000));
}
