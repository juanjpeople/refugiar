"use client";

import { Button, Card, Flex, Segmented, Tag, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { ChefHat, Clock, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useInventoryOptions } from "@/features/shopping/hooks";
import { usePermission } from "@/lib/auth/hooks";
import { formatQuantity } from "@/features/inventory/format";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { IngredientPicker, ListPage, PrivacyBadge } from "@/components/ui";
import { useI18n } from "@/i18n";
import { normalizeIngredient, rankRecipes, recipeMatches, RECIPE_TAGS, type RecipeTag } from "../domain";
import { useRecipes, type RecipeSummary } from "../hooks";
import { AvailabilityTag, RatingBadge, RecipeCover } from "./RecipeBits";
import { recipeHref } from "@/lib/navigation/routes";

type Show = "all" | "ready";

/** Minúsculas y sin tildes, para buscar "pure" y encontrar "Puré". */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function RecipesPage() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const recipes = useRecipes();
  const params = useSearchParams();
  const show: Show = params.get("show") === "ready" ? "ready" : "all";
  const tags = params.getAll("tag").filter((tag): tag is RecipeTag => RECIPE_TAGS.includes(tag as RecipeTag));
  const query = params.get("q") ?? "";
  const wanted = params.getAll("use");
  function setFilter(key: string, values: string[]) {
    const next = new URL(window.location.href);
    next.searchParams.delete(key);
    for (const value of values.filter(Boolean)) next.searchParams.append(key, value);
    window.history.replaceState(null, "", `${next.pathname}${next.search}${next.hash}`);
  }
  const setShow = (value: Show) => setFilter("show", value === "all" ? [] : [value]);
  const setQuery = (value: string) => setFilter("q", [value]);
  const setWanted = (values: string[]) => setFilter("use", [...new Map(values.map((value) => [normalizeIngredient(value), value.trim()])).values()]);
  const canViewInventory = usePermission("inventory.view");
  const inventory = useInventoryOptions(canViewInventory);
  const pantry = canViewInventory ? (inventory ?? []).filter(({ item }) => !item.reusable && item.quantity > 0) : [];
  const names = new Map((recipes ?? []).flatMap((recipe) => recipe.ingredients.map((ingredient) => [normalizeIngredient(ingredient.name), ingredient.name] as const)));
  for (const { item } of pantry) names.set(normalizeIngredient(item.name), item.name);
  const options = [...names.values()].map((name) => {
    const matches = pantry.filter(({ item }) => normalizeIngredient(item.name) === normalizeIngredient(name));
    const stock = matches.map(({ item, place }) => `${formatQuantity(t, item.quantity, item.unit, format.number)} · ${place}`).join("; ");
    return { value: name, label: stock ? `${name} — ${stock}` : name, available: matches.length > 0 };
  }).sort((a, b) => Number(b.available) - Number(a.available) || a.value.localeCompare(b.value));

  const words = normalize(query).split(/\s+/).filter(Boolean);
  const visible = rankRecipes(recipes ?? [], wanted).filter((recipe) => {
    if (show === "ready" && recipe.report.availability !== "ready") return false;
    if (!tags.every((tag) => recipe.tags.includes(tag))) return false;
    const haystack = normalize(`${recipe.name} ${recipe.ingredients.map((ingredient) => ingredient.name).join(" ")}`);
    return words.every((word) => haystack.includes(word));
  });
  const readyCount = recipes?.filter((recipe) => recipe.report.availability === "ready").length ?? 0;
  const usedTags = RECIPE_TAGS.filter((tag) => recipes?.some((recipe) => recipe.tags.includes(tag)));

  const newButton = (
    <Can perform="recipes.manage">
      <Link href="/recetas/editar">
        <Button type="primary" icon={<Plus />}>
          {t("recipes.new")}
        </Button>
      </Link>
    </Can>
  );

  return (
    <RequirePermission perform="recipes.view">
      <ListPage
        header={{ eyebrow: t("recipes.eyebrow"), title: t("recipes.title"), description: t("recipes.description"), extra: <><Link href="/recetas/semana"><Button>{t("meals.title")}</Button></Link>{newButton}</> }}
        items={recipes}
        visible={visible}
        getKey={(recipe) => recipe.id}
        renderItem={(recipe) => <RecipeCard recipe={recipe} wanted={wanted} />}
        empty={{ icon: ChefHat, title: t("recipes.emptyTitle"), description: t("recipes.emptyText"), action: newButton }}
        noMatch={{ title: t("recipes.noMatchTitle"), description: t("recipes.noMatchText") }}
        search={{ value: query, onChange: setQuery, placeholder: t("recipes.search") }}
        filters={
          <Segmented<Show>
            value={show}
            onChange={setShow}
            options={[
              { value: "all", label: t("recipes.filter.all", { count: recipes?.length ?? 0 }) },
              { value: "ready", label: t("recipes.filter.ready", { count: readyCount }) },
            ]}
          />
        }
        below={
          <Flex vertical gap={token.margin}>
            <IngredientPicker options={options} value={wanted} onChange={setWanted} />
            {usedTags.length > 0 && (
            <Flex gap={6} wrap>
              {usedTags.map((tag) => (
                <Tag.CheckableTag
                  key={tag}
                  checked={tags.includes(tag)}
                  onChange={(checked) => setFilter("tag", checked ? [...tags, tag] : tags.filter((value) => value !== tag))}
                  style={{ margin: 0, paddingBlock: 2, border: `1px solid ${tags.includes(tag) ? "transparent" : token.colorBorderSecondary}` }}
                >
                  {t(`recipes.tags.${tag}`)}
                </Tag.CheckableTag>
              ))}
            </Flex>
            )}
          </Flex>
        }
        minItemWidth={260}
      />
    </RequirePermission>
  );
}

/** Tarjeta del recetario: portada que se acerca, disponibilidad, tiempo, porciones y lo que falta. */
export function RecipeCard({ recipe, wanted = [] }: { recipe: RecipeSummary; wanted?: string[] }) {
  const { t } = useI18n();
  const { token } = theme.useToken();

  return (
    <Link href={recipeHref(recipe.id)} style={{ display: "block", height: "100%" }}>
      <Card hoverable style={{ height: "100%", overflow: "hidden" }} styles={{ body: { padding: 16 } }} cover={
        <div style={{ position: "relative", overflow: "hidden" }}>
          <motion.div variants={{ hover: { scale: 1.04 } }} transition={{ duration: 0.4 }}>
            <RecipeCover recipeId={recipe.id} photoId={recipe.coverPhotoId} />
          </motion.div>
          <span style={{ position: "absolute", top: 10, left: 10 }}>
            <AvailabilityTag availability={recipe.report.availability} solid />
          </span>
        </div>
      }>
        <Flex vertical gap={6}>
          <Flex align="flex-start" gap={6}>
            <Typography.Title level={5} style={{ margin: 0, minWidth: 0, flex: 1 }} ellipsis={{ rows: 2 }}>
              {recipe.name}
            </Typography.Title>
            <span style={{ paddingTop: 3 }}>
              <PrivacyBadge privacy={recipe.privacy} />
            </span>
          </Flex>
          <Flex gap={12} align="center" wrap style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            {recipe.minutes > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Clock /> {t("recipes.minutes", { count: recipe.minutes })}
              </span>
            )}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Users /> {t("recipes.servings", { count: recipe.servings })}
            </span>
            <RatingBadge rating={recipe.rating} />
          </Flex>
          {wanted.length > 0 && <Typography.Text type="secondary">{t("recipes.want.matches", { count: recipeMatches(recipe, wanted), total: wanted.length })}</Typography.Text>}
          {recipe.report.lacking.length > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} ellipsis>
              {t("recipes.lacking", { list: recipe.report.lacking.map((check) => check.ingredient.name).join(", ") })}
            </Typography.Text>
          )}
        </Flex>
      </Card>
    </Link>
  );
}
