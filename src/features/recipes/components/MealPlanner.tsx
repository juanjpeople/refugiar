"use client";
import { ShareButton } from "@/features/sharing/ShareButton";

import { App, Button, DatePicker, Flex, Form, InputNumber, Modal, Select, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
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
import { useRecipes } from "../hooks";
import { ingredientCheckKey, RECIPE_LIMITS } from "../domain";
import { addPlannedMissing, planMeal, plannedNeeds, plannedMeals } from "../meal-plan";

export function MealPlanner() {
  const { t, format } = useI18n();
  const { modal, message } = App.useApp();
  const user = useCurrentUser();
  const canPlan = usePermission("calendar.manage");
  const canShop = usePermission("shopping.manage");
  const recipes = useRecipes();
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
      return { id: event.id, label: recipe?.name ?? t("meals.unavailable"), href: recipe ? recipeHref(recipe.id) : undefined, servings: event.meal!.servings };
    }) };
  });

  async function save() {
    if (!day || !recipeId || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await planMeal(user, recipeId, day.startOf("day").valueOf(), servings);
      message.success(t("meals.planned"));
      setDay(null);
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      pending.current = false;
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
    </RequirePermission>
  );
}
