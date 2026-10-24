"use client";
import { ShareButton } from "@/features/sharing/ShareButton";

import { App, Button, Card, DatePicker, Flex, Form, InputNumber, Modal, Select, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ShoppingCart, Sparkles } from "lucide-react";
import { PageHeader, ReviewChecklist, WeeklyMenu } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { useCurrentUser } from "@/lib/auth/session";
import { usePermission } from "@/lib/auth/hooks";
import { getErrorMessage } from "@/lib/errors";
import { recipeHref } from "@/lib/navigation/routes";
import { useI18n } from "@/i18n";
import { formatQuantity } from "@/features/inventory/format";
import { useEventActions } from "@/features/calendar/hooks";
import { useMembers } from "@/features/members/hooks";
import { useRecipes } from "../hooks";
import { ingredientCheckKey, RECIPE_LIMITS } from "../domain";
import { addPlannedMissing, planMeal, plannedNeeds, plannedMeals, suggestWeeklyMenu, type MealSuggestion } from "../meal-plan";

export function MealPlanner() {
  const { t, format } = useI18n();
  const { modal, message } = App.useApp();
  const user = useCurrentUser();
  const canPlan = usePermission("calendar.manage");
  const canShop = usePermission("shopping.manage");
  const recipes = useRecipes();
  const members = useMembers() ?? [];
  const [cookId, setCookId] = useState<string>();
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<MealSuggestion[] | null>(null);
  const { remove } = useEventActions();
  const currentWeekStart = dayjs().startOf("day").subtract((dayjs().day() + 6) % 7, "day");
  const [week, setWeek] = useState(currentWeekStart);
  const isCurrentWeek = week.isSame(currentWeekStart, "day");
  const from = week.valueOf(), to = week.add(7, "day").valueOf();
  const entries = useLiveQuery(async () => plannedMeals(user, from, to), [from, to, user?.id, user?.role]);
  const report = useLiveQuery(() => canShop ? plannedNeeds(user, from, to) : undefined, [from, to, canShop, user?.id]);
  const [day, setDay] = useState<Dayjs | null>(null);
  const [recipeId, setRecipeId] = useState<string>();
  const [servings, setServings] = useState(4);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [review, setReview] = useState(false);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = week.add(index, "day");
    return { id: date.format("YYYY-MM-DD"), label: format.date(date.valueOf(), { weekday: "long", day: "numeric", month: "short" }), meals: (entries ?? []).filter(event => dayjs(event.start).isSame(date, "day")).map(event => {
      const recipe = recipes?.find(recipe => recipe.id === event.meal!.recipeId);
        const cook = event.meal?.cookId ? members.find((m) => m.id === event.meal!.cookId) : (event.participantIds?.[0] ? members.find((m) => m.id === event.participantIds[0]) : undefined);
        return {
          id: event.id,
          label: recipe?.name ?? t("meals.unavailable"),
          href: recipe ? recipeHref(recipe.id) : undefined,
          servings: event.meal!.servings,
          cook: cook ? { id: cook.id, name: cook.name, emoji: cook.emoji } : undefined,
        };
    }) };
  });

  async function save() {
    if (!day || !recipeId || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await planMeal(user, recipeId, day.startOf("day").valueOf(), servings, cookId);
      message.success(t("meals.planned"));
      setDay(null);
      setCookId(undefined);
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function handleSuggest() {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const result = await suggestWeeklyMenu(user, from, to);
      if (result.length === 0) {
        if ((recipes ?? []).length === 0) {
          message.info(t("meals.suggest.empty"));
        } else {
          message.info(t("meals.suggest.allPlanned"));
        }
      } else {
        setSuggestions(result);
      }
    } catch (err) {
      message.error(getErrorMessage(err, t));
    } finally {
      setSuggesting(false);
    }
  }

  async function applySuggestions() {
    if (!suggestions || suggestions.length === 0) return;
    setBusy(true);
    try {
      for (const s of suggestions) {
        await planMeal(user, s.recipeId, s.dayStart, s.servings);
      }
      message.success(t("meals.planned"));
      setSuggestions(null);
    } catch (err) {
      message.error(getErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequirePermission perform="recipes.view">
      <PageHeader title={t("meals.title")} description={t("meals.description")} />
      <Reveal>
        <ShareButton source={{ kind: "meal-plan", id: week.format("YYYY-MM-DD"), name: t("meals.title") }} />
      </Reveal>
      <Reveal>
        <Flex vertical gap="middle">
          <Flex justify="space-between" align="center" wrap gap="small">
            <Button
              aria-label={t("meals.previous")}
              icon={<ChevronLeft />}
              style={{ minWidth: 44, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => setWeek(week.subtract(7, "day"))}
            />
            <Flex align="center" gap="small" wrap justify="center">
              <Typography.Text strong style={{ textAlign: "center" }}>
                {format.date(from)} – {format.date(week.add(6, "day").valueOf())}
              </Typography.Text>
              {!isCurrentWeek && (
                <Button size="small" onClick={() => setWeek(currentWeekStart)}>
                  {t("meals.today")}
                </Button>
              )}
            </Flex>
            <Button
              aria-label={t("meals.next")}
              icon={<ChevronRight />}
              style={{ minWidth: 44, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => setWeek(week.add(7, "day"))}
            />
          </Flex>
          <Flex gap="small" wrap>
            {canPlan && (
              <Button
                icon={<Sparkles />}
                style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}
                loading={suggesting}
                onClick={handleSuggest}
              >
                {t("meals.suggest.action")}
              </Button>
            )}
            {canShop && (
            <Button
              type="primary"
              size="large"
              icon={<ShoppingCart />}
              style={{ minHeight: 44 }}
              disabled={!report?.checks.some(check => check.state !== "ok")}
              onClick={() => setReview(true)}
            >
              {t("meals.missing")}
            </Button>
          )}
          </Flex>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {t("meals.hint")}
          </Typography.Paragraph>
        </Flex>
      </Reveal>
      <WeeklyMenu
        days={days}
        onAdd={canPlan ? (id) => { setRecipeId(undefined); setDay(dayjs(id)); } : undefined}
        onRemove={canPlan ? (id) => modal.confirm({ title: t("meals.removeConfirm"), onOk: () => remove(id) }) : undefined}
      />
      <Modal open={!!day} title={t("meals.add")} onCancel={() => !busy && setDay(null)} closable={!busy} footer={null}>
        <Form layout="vertical" onFinish={save} disabled={busy}>
          <Form.Item label={t("meals.day")}>
            <DatePicker value={day} onChange={(value) => value && setDay(value)} allowClear={false} />
          </Form.Item>
          <Form.Item label={t("meals.recipe")}>
            <Select
              showSearch
              optionFilterProp="label"
              value={recipeId}
              options={(recipes ?? []).map((recipe) => ({ value: recipe.id, label: recipe.name }))}
              onChange={(id) => {
                setRecipeId(id);
                setServings(recipes?.find((recipe) => recipe.id === id)?.servings ?? 4);
              }}
            />
          </Form.Item>
          {recipes?.length === 0 && <Typography.Paragraph>{t("meals.noRecipes")}</Typography.Paragraph>}
          <Form.Item label={t("meals.servings")}>
            <InputNumber
              aria-label={t("meals.servings")}
              value={servings}
              min={1}
              max={RECIPE_LIMITS.maxServings}
              precision={0}
              onChange={(value) => value && setServings(value)}
            />
          </Form.Item>
          {members.length > 0 && (
            <Form.Item label={t("meals.cook.label")}>
              <Select
                allowClear
                placeholder={t("meals.cook.placeholder")}
                value={cookId}
                onChange={setCookId}
                options={members.map((member) => ({
                  value: member.id,
                  label: member.emoji ? `${member.emoji} ${member.name}` : member.name,
                }))}
              />
            </Form.Item>
          )}
          <Button type="primary" htmlType="submit" size="large" style={{ minHeight: 44 }} loading={busy} disabled={!recipeId}>
            {t("meals.save")}
          </Button>
        </Form>
      </Modal>
      {review && report && (
        <ReviewChecklist
          title={t("meals.missing")}
          description={t("meals.hint")}
          onClose={() => setReview(false)}
          options={report.checks.filter((check) => check.state !== "ok").map((check) => ({
            value: ingredientCheckKey(check),
            label: `${check.ingredient.name} · ${formatQuantity(t, Math.max(0, check.needed - (check.have ?? 0)), check.ingredient.unit, format.number)}`,
            checked: check.state !== "unlinked",
          }))}
          onConfirm={async (selected) => {
            try {
              const count = await addPlannedMissing(user, from, to, selected);
              message.success(t("recipes.missingAdded", { count }));
              return true;
            } catch (error) {
              message.error(getErrorMessage(error, t));
              return false;
            }
          }}
        />
      )}
      <Modal
        open={!!suggestions}
        title={t("meals.suggest.title")}
        onCancel={() => setSuggestions(null)}
        onOk={applySuggestions}
        okText={t("meals.suggest.confirm")}
        cancelText={t("common.cancel")}
        confirmLoading={busy}
      >
        <Typography.Paragraph type="secondary">
          {t("meals.suggest.description")}
        </Typography.Paragraph>
        <Flex vertical gap={8} style={{ marginBlock: 12 }}>
          {suggestions?.map((s) => (
            <Card key={s.dayStart} size="small" styles={{ body: { padding: "10px 14px" } }}>
              <Flex justify="space-between" align="center" wrap gap={8}>
                <Typography.Text strong>
                  {format.date(s.dayStart, { weekday: "long", day: "numeric" })}
                </Typography.Text>
                <Flex align="center" gap={8}>
                  <span>{s.recipeName}</span>
                  {s.availableIngredients === s.totalIngredients && (
                    <Tag color="success" style={{ margin: 0 }}>
                      {t("inventory.stock.ok")}
                    </Tag>
                  )}
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      </Modal>
    </RequirePermission>
  );
}
