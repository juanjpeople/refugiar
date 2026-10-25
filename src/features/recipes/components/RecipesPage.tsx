"use client";

import { Button, Card, Flex, Segmented, Tag, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { BookOpen, ChefHat, Clock, Plus, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { DisplayMenu, IngredientPicker, ListPage, PrivacyBadge } from "@/components/ui";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { useI18n } from "@/i18n";
import { normalizeIngredient, recipeMatches } from "../domain";
import { useRecipeCatalogFilters, useRecipes, type RecipeShowFilter as Show, type RecipeSummary } from "../hooks";
import { AvailabilityTag, RatingBadge, RecipeCover } from "./RecipeBits";
import { RecipePacksModal } from "./RecipePacksModal";
import { recipeHref } from "@/lib/navigation/routes";

export function RecipesPage() {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const recipes = useRecipes();
  const { recipeStockLink } = usePreferences();
  const setPreference = useSetPreference();
  const [packsOpen, setPacksOpen] = useState(false);
  const {
    show,
    setShow,
    tags,
    query,
    setQuery,
    wanted,
    setWanted,
    timeParam,
    setFilter,
    pantry,
    options,
    visible,
    readyCount,
    usedTags,
  } = useRecipeCatalogFilters(recipes, recipeStockLink);

  const newButton = (
    <Can perform="recipes.manage">
      <Link href="/recetas/editar">
        <Button type="primary" icon={<Plus />}>
          {t("recipes.new")}
        </Button>
      </Link>
    </Can>
  );

  const extra = (
    <Flex gap={token.marginXS} wrap align="center">
      <Link href="/recetas/semana">
        <Button>{t("meals.title")}</Button>
      </Link>
      <Can perform="recipes.manage">
        <Button icon={<BookOpen />} onClick={() => setPacksOpen(true)}>
          {t("recipes.packs.button")}
        </Button>
      </Can>
      <DisplayMenu
        label={t("recipes.display.label")}
        groups={[
          {
            key: "inventory",
            title: t("recipes.display.stock"),
            toggles: [
              {
                key: "stockLink",
                label: t("recipes.display.stockLink"),
                description: t("recipes.display.stockLinkHint"),
                checked: recipeStockLink,
                onChange: (checked) => setPreference("recipeStockLink", checked),
              },
            ],
          },
        ]}
      />
      {newButton}
    </Flex>
  );

  const emptyAction = (
    <Flex gap={token.marginSM} wrap justify="center">
      {newButton}
      <Can perform="recipes.manage">
        <Button icon={<Sparkles />} onClick={() => setPacksOpen(true)}>
          {t("recipes.packs.explore")}
        </Button>
      </Can>
    </Flex>
  );

  const filters = recipeStockLink ? (
    <Segmented<Show>
      value={show}
      onChange={setShow}
      options={[
        { value: "all", label: t("recipes.filter.all", { count: recipes?.length ?? 0 }) },
        { value: "ready", label: t("recipes.filter.ready", { count: readyCount }) },
      ]}
    />
  ) : undefined;

  return (
    <RequirePermission perform="recipes.view">
      <ListPage
        header={{ eyebrow: t("recipes.eyebrow"), title: t("recipes.title"), description: t("recipes.description"), extra }}
        items={recipes}
        visible={visible}
        getKey={(recipe) => recipe.id}
        renderItem={(recipe) => <RecipeCard recipe={recipe} wanted={wanted} stockLink={recipeStockLink} />}
        empty={{ icon: ChefHat, title: t("recipes.emptyTitle"), description: t("recipes.emptyText"), action: emptyAction }}
        noMatch={{ title: t("recipes.noMatchTitle"), description: t("recipes.noMatchText") }}
        search={{ value: query, onChange: setQuery, placeholder: t("recipes.search") }}
        filters={filters}
        below={
          <Flex vertical gap={token.margin}>
            {recipeStockLink && pantry.length > 0 && (
              <Flex vertical gap={token.marginXXS}>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {t("recipes.pantryQuickPick")}:
                </Typography.Text>
                <Flex gap={6} wrap>
                  {pantry.slice(0, 8).map(({ item }) => {
                    const isSelected = wanted.some(
                      (w) => normalizeIngredient(w) === normalizeIngredient(item.name)
                    );
                    return (
                      <Tag.CheckableTag
                        key={item.id}
                        checked={isSelected}
                        onChange={(checked) => {
                          if (checked) {
                            setWanted([...wanted, item.name]);
                          } else {
                            setWanted(wanted.filter((w) => normalizeIngredient(w) !== normalizeIngredient(item.name)));
                          }
                        }}
                        style={{
                          margin: 0,
                          paddingBlock: 2,
                          border: `1px solid ${isSelected ? "transparent" : token.colorBorderSecondary}`,
                        }}
                      >
                        {item.name}
                      </Tag.CheckableTag>
                    );
                  })}
                </Flex>
              </Flex>
            )}
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
            <Flex gap={6} wrap align="center">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
                <Clock />
              </span>
              {[
                { value: "15", label: t("recipes.timeFilter.under15") },
                { value: "30", label: t("recipes.timeFilter.under30") },
                { value: "45", label: t("recipes.timeFilter.under45") },
              ].map((opt) => {
                const isSelected = timeParam === opt.value;
                return (
                  <Tag.CheckableTag
                    key={opt.value}
                    checked={isSelected}
                    onChange={(checked) => setFilter("time", checked ? [opt.value] : [])}
                    style={{
                      margin: 0,
                      paddingBlock: 2,
                      border: `1px solid ${isSelected ? "transparent" : token.colorBorderSecondary}`,
                    }}
                  >
                    {opt.label}
                  </Tag.CheckableTag>
                );
              })}
            </Flex>
          </Flex>
        }
        minItemWidth={260}
      />
      <RecipePacksModal
        open={packsOpen}
        onClose={() => setPacksOpen(false)}
        recipes={recipes}
      />
    </RequirePermission>
  );
}

/** Tarjeta del recetario: portada que se acerca, disponibilidad, tiempo, porciones y lo que falta. */
export function RecipeCard({
  recipe,
  wanted = [],
  stockLink = true,
}: {
  recipe: RecipeSummary;
  wanted?: string[];
  stockLink?: boolean;
}) {
  const { t } = useI18n();
  const { token } = theme.useToken();

  return (
    <Link href={recipeHref(recipe.id)} style={{ display: "block", height: "100%" }}>
      <Card
        hoverable
        style={{ height: "100%", overflow: "hidden" }}
        styles={{ body: { padding: 16 } }}
        cover={
          <div style={{ position: "relative", overflow: "hidden" }}>
            <motion.div variants={{ hover: { scale: 1.04 } }} transition={{ duration: 0.4 }}>
              <RecipeCover name={recipe.name} recipeId={recipe.id} photoId={recipe.coverPhotoId} />
            </motion.div>
            {stockLink && (
              <span style={{ position: "absolute", top: 10, left: 10 }}>
                <AvailabilityTag availability={recipe.report.availability} solid />
              </span>
            )}
          </div>
        }
      >
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
          {wanted.length > 0 && (
            <Typography.Text type="secondary">
              {t("recipes.want.matches", { count: recipeMatches(recipe, wanted), total: wanted.length })}
            </Typography.Text>
          )}
          {stockLink && recipe.report.lacking.length > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} ellipsis>
              {t("recipes.lacking", { list: recipe.report.lacking.map((check) => check.ingredient.name).join(", ") })}
            </Typography.Text>
          )}
        </Flex>
      </Card>
    </Link>
  );
}
