"use client";

import { AutoComplete, Button, Card, Col, Flex, Grid, Input, InputNumber, Row, Select, Tag, Tooltip, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ImagePlus, Link2, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { StepTime, PageHeader, PrivacySelect, StockTag, LoadingSkeleton } from "@/components/ui";
import { convertQuantity, isMeasuredUnit } from "@/features/inventory/quantity";
import { getStockStatus, isUnit, UNITS } from "@/features/inventory/domain";
import { PhotoGallery } from "@/features/media/components/PhotoGallery";
import { PHOTO_LIMITS } from "@/features/media/domain";
import { usePhotoActions } from "@/features/media/hooks";
import { useInventoryOptions, type ItemPlace } from "@/features/shopping/hooks";
import { usePreferences } from "@/hooks/usePreferences";
import { useI18n } from "@/i18n";
import { SPRING } from "@/lib/motion";
import type { Privacy } from "@/lib/sync/scope";
import { usePageCrumbs } from "@/store/useBreadcrumbStore";
import { suggestedSeconds } from "../timing";
import { parseIngredientLine, parseStepLines, RECIPE_LIMITS, RECIPE_TAGS, type Recipe, type RecipeTag } from "../domain";
import { useRecipe, useRecipeActions } from "../hooks";
import { recipeHref } from "@/lib/navigation/routes";
import { belowHeader } from "@/components/layout/constants";

interface IngredientDraft {
  key: string;
  itemId?: string;
  name: string;
  quantity: number | null;
  unit: string;
}

interface StepDraft {
  seconds?: number;
  key: string;
  text: string;
}

let draftKey = 0;
const nextKey = () => `draft-${++draftKey}`;

/** Editor de recetas: `/recetas/editar` crea, `/recetas/editar?id=…` edita. */
export function RecipeEditor() {
  const id = useSearchParams().get("id");
  const data = useRecipe(id);
  if (id && data === undefined) return <LoadingSkeleton />;
  // `key`: al cambiar de receta, el formulario arranca de cero con sus datos.
  return <EditorForm key={id ?? "new"} recipe={data?.recipe ?? null} />;
}

function EditorForm({ recipe }: { recipe: Recipe | null }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const router = useRouter();
  const { create, update, setCover } = useRecipeActions();
  const { add: addPhotos } = usePhotoActions();
  const { recipeStockLink } = usePreferences();
  const rawOptions = useInventoryOptions();
  const options = recipeStockLink ? rawOptions : [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(recipe?.name ?? "");
  const [servings, setServings] = useState<number | null>(recipe?.servings ?? 4);
  const [minutes, setMinutes] = useState<number | null>(recipe?.minutes ?? 30);
  const [tags, setTags] = useState<RecipeTag[]>(recipe?.tags ?? []);
  const [privacy, setPrivacy] = useState<Privacy>(recipe?.privacy ?? "family");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    recipe?.ingredients.map((ingredient) => ({ ...ingredient, key: nextKey() })) ?? [{ key: nextKey(), name: "", quantity: 1, unit: "unidades" }],
  );
  const [steps, setSteps] = useState<StepDraft[]>(recipe?.steps.map((text, index) => ({ key: nextKey(), text, seconds: recipe.stepSeconds?.[index] ?? 0 })) ?? [{ key: nextKey(), text: "" }]);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  usePageCrumbs(recipe ? [{ label: recipe.name, href: recipeHref(recipe.id) }, { label: t("recipes.editTitle") }] : [{ label: t("recipes.newTitle") }]);

  const updateIngredient = (key: string, patch: Partial<IngredientDraft>) =>
    setIngredients((current) => current.map((ingredient) => (ingredient.key === key ? { ...ingredient, ...patch } : ingredient)));
  const moveStep = (index: number, delta: number) =>
    setSteps((current) => {
      const next = [...current];
      const [step] = next.splice(index, 1);
      next.splice(index + delta, 0, step);
      return next;
    });

  /**
   * Una lista pegada en un ingrediente se reparte: uno por renglón, desde ese lugar. Lo que se llama
   * igual que algo del inventario (con una medida compatible y sin coincidencias ambiguas) queda vinculado.
   */
  function pasteIngredients(key: string, text: string) {
    const available = recipeStockLink ? (options ?? []).filter(({ item }) => !item.reusable) : [];
    const parsed = text.split(/\r?\n/).map(parseIngredientLine).filter((line) => line !== null);
    const drafts: IngredientDraft[] = parsed.map((line) => {
      const matches = available.filter(({ item }) => item.name.toLowerCase() === line.name.toLowerCase());
      const item = matches.length === 1 ? matches[0].item : undefined;
      const sameUnit = item && convertQuantity(line.quantity, line.unit, item.unit) !== null;
      return sameUnit
        ? { key: nextKey(), itemId: item.id, name: item.name, quantity: line.quantity, unit: line.unit }
        : { key: nextKey(), name: line.name, quantity: line.quantity, unit: line.unit };
    });
    setIngredients((current) => {
      const index = current.findIndex((ingredient) => ingredient.key === key);
      const keep = current[index]?.name.trim() ? 1 : 0;
      const next = [...current.slice(0, index + keep), ...drafts, ...current.slice(index + 1)];
      return next.slice(0, RECIPE_LIMITS.maxIngredients);
    });
  }

  /** La preparación pegada en un paso se reparte: un paso por renglón. */
  function pasteSteps(key: string, text: string) {
    const lines = parseStepLines(text);
    setSteps((current) => {
      const index = current.findIndex((step) => step.key === key);
      const keep = current[index]?.text.trim() ? 1 : 0;
      return [...current.slice(0, index + keep), ...lines.map((line) => ({ key: nextKey(), text: line })), ...current.slice(index + 1)].slice(0, RECIPE_LIMITS.maxSteps);
    });
  }

  async function save() {
    setSaving(true);
    const input = {
      name,
      privacy,
      servings: servings ?? 0,
      minutes: minutes ?? 0,
      tags,
      // Filas vacías (el ingrediente o paso "en blanco" para seguir escribiendo) no se guardan.
      ingredients: ingredients
        .filter((ingredient) => ingredient.name.trim())
        .map(({ itemId, name: ingredientName, quantity, unit }) => ({ itemId, name: ingredientName, quantity: quantity ?? 0, unit })),
      steps: steps.map((step) => step.text),
      stepSeconds: steps.map(step => step.seconds ?? 0),
    };
    const savedId = recipe ? ((await update(recipe.id, input)) !== null ? recipe.id : null) : await create(input);
    if (savedId && pendingPhotos.length > 0) {
      const photoIds = await addPhotos("recipe", savedId, pendingPhotos);
      if (photoIds?.length) await setCover(savedId, photoIds[0]);
    }
    setSaving(false);
    if (savedId) router.push(recipeHref(savedId));
  }

  const saveButton = (
    <Button type="primary" size="large" icon={<Save />} loading={saving} disabled={!name.trim()} onClick={save}>
      {recipe ? t("recipes.editor.save") : t("recipes.editor.create")}
    </Button>
  );

  return (
    <RequirePermission perform="recipes.manage">
      <PageHeader
        eyebrow={t("recipes.eyebrow")}
        title={recipe ? t("recipes.editTitle") : t("recipes.newTitle")}
        extra={
          <>
            <Link href={recipe ? recipeHref(recipe.id) : "/recetas"}>
              <Button size="large">{t("common.cancel")}</Button>
            </Link>
            {saveButton}
          </>
        }
      />

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Flex vertical gap={24}>
            <Reveal delay={0.05}>
              <Card>
                <Flex vertical gap={16}>
                  <label>
                    <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
                      {t("recipes.editor.name")}
                    </Typography.Text>
                    <Input size="large" value={name} maxLength={RECIPE_LIMITS.nameMaxLength} placeholder={t("recipes.editor.namePlaceholder")} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <div>
                    <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
                      {t("privacy.label")}
                    </Typography.Text>
                    <PrivacySelect value={privacy} onChange={setPrivacy} />
                  </div>
                  <Flex gap={16} wrap>
                    <label>
                      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
                        {t("recipes.editor.servings")}
                      </Typography.Text>
                      <InputNumber min={1} max={RECIPE_LIMITS.maxServings} precision={0} value={servings} onChange={setServings} style={{ width: 120 }} />
                    </label>
                    <label>
                      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
                        {t("recipes.editor.minutes")}
                      </Typography.Text>
                      <InputNumber min={0} max={RECIPE_LIMITS.maxMinutes} precision={0} value={minutes} onChange={setMinutes} suffix="min" style={{ width: 140 }} />
                    </label>
                  </Flex>
                  <div>
                    <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
                      {t("recipes.editor.tags")}
                    </Typography.Text>
                    <Flex gap={6} wrap>
                      {RECIPE_TAGS.map((tag) => (
                        <Tag.CheckableTag
                          key={tag}
                          checked={tags.includes(tag)}
                          onChange={(checked) => setTags((current) => (checked ? [...current, tag] : current.filter((value) => value !== tag)))}
                          style={{ margin: 0, paddingBlock: 2, border: `1px solid ${tags.includes(tag) ? "transparent" : token.colorBorderSecondary}` }}
                        >
                          {t(`recipes.tags.${tag}`)}
                        </Tag.CheckableTag>
                      ))}
                    </Flex>
                  </div>
                </Flex>
              </Card>
            </Reveal>

            <Reveal delay={0.1}>
              <Card title={t("recipes.ingredients")}>
                <Flex vertical gap={10}>
                  {/* Debajo del título, no al lado: en el celular la ayuda no entra en la cabecera. */}
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("recipes.editor.ingredientsHint")}</Typography.Text>
                  <AnimatePresence initial={false}>
                    {ingredients.map((ingredient) => (
                      <motion.div key={ingredient.key} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={SPRING.snappy}>
                        <IngredientField
                          ingredient={ingredient}
                          options={options ?? []}
                          onChange={(patch) => updateIngredient(ingredient.key, patch)}
                          onPasteList={(text) => pasteIngredients(ingredient.key, text)}
                          onRemove={() => setIngredients((current) => current.filter((value) => value.key !== ingredient.key))}
                          stacked={!screens.sm}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <Button
                    type="dashed"
                    icon={<Plus />}
                    disabled={ingredients.length >= RECIPE_LIMITS.maxIngredients}
                    onClick={() => setIngredients((current) => [...current, { key: nextKey(), name: "", quantity: 1, unit: "unidades" }])}
                  >
                    {t("recipes.editor.addIngredient")}
                  </Button>
                </Flex>
              </Card>
            </Reveal>

            <Reveal delay={0.15}>
              <Card title={t("recipes.steps")}>
                <Flex vertical gap={10}>
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("recipes.editor.stepsHint")}</Typography.Text>
                  <AnimatePresence initial={false}>
                    {steps.map((step, index) => (
                      <motion.div key={step.key} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={SPRING.snappy}>
                        <Flex gap={10} align="flex-start">
                          <span style={{ flexShrink: 0, marginTop: 4, width: 26, height: 26, borderRadius: "50%", background: token.colorPrimaryBg, color: token.colorPrimary, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: token.fontSizeSM }}>
                            {index + 1}
                          </span>
                          <Input.TextArea
                            value={step.text}
                            aria-label={t("recipes.editor.stepAria", { number: index + 1 })}
                            placeholder={index === 0 ? t("recipes.editor.stepPlaceholder") : undefined}
                            autoSize={{ minRows: 1, maxRows: 8 }}
                            maxLength={RECIPE_LIMITS.stepMaxLength}
                            onChange={(event) => setSteps((current) => current.map((value) => (value.key === step.key ? { ...value, text: event.target.value } : value)))}
                            onPaste={(event) => {
                              const text = event.clipboardData.getData("text");
                              // Un párrafo se pega como siempre; varios renglones son varios pasos.
                              if (!/\r?\n/.test(text.trim())) return;
                              event.preventDefault();
                              pasteSteps(step.key, text);
                            }}
                          />
                          <Flex vertical={screens.sm ? false : true} gap={2}>
                            <Button type="text" size="small" aria-label={t("recipes.editor.moveUp")} icon={<ArrowUp />} disabled={index === 0} onClick={() => moveStep(index, -1)} />
                            <Button type="text" size="small" aria-label={t("recipes.editor.moveDown")} icon={<ArrowDown />} disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)} />
                            <Button type="text" size="small" danger aria-label={t("recipes.editor.removeStep")} icon={<Trash2 />} onClick={() => setSteps((current) => current.filter((value) => value.key !== step.key))} />
                          </Flex>
                        </Flex>
                        <StepTime seconds={step.seconds ?? 0} suggestion={suggestedSeconds(step.text)} onChange={seconds => setSteps(current => current.map(value => value.key === step.key ? { ...value, seconds } : value))} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <Button type="dashed" icon={<Plus />} disabled={steps.length >= RECIPE_LIMITS.maxSteps} onClick={() => setSteps((current) => [...current, { key: nextKey(), text: "" }])}>
                    {t("recipes.editor.addStep")}
                  </Button>
                </Flex>
              </Card>
            </Reveal>
          </Flex>
        </Col>

        <Col xs={24} lg={10}>
          <Reveal delay={0.2} style={{ position: screens.lg ? "sticky" : undefined, top: belowHeader(8) }}>
            <Card title={t("recipes.photos")}>
              {recipe ? (
                <PhotoGallery ownerType="recipe" ownerId={recipe.id} editable coverId={recipe.coverPhotoId} onSetCover={(photoId) => setCover(recipe.id, photoId)} onFirstPhoto={(photoId) => !recipe.coverPhotoId && setCover(recipe.id, photoId)} />
              ) : (
                // Receta nueva: todavía no tiene id; las fotos se guardan al crearla (la primera, de portada).
                <Flex vertical gap={8}>
                  {pendingPhotos.map((file, index) => (
                    <Flex key={`${file.name}-${index}`} align="center" justify="space-between" gap={8}>
                      <Typography.Text ellipsis style={{ minWidth: 0 }}>
                        {index === 0 && <Tag color="gold" style={{ marginInlineEnd: 6 }}>{t("media.isCover")}</Tag>}
                        {file.name}
                      </Typography.Text>
                      <Button type="text" size="small" aria-label={t("media.delete")} icon={<X />} onClick={() => setPendingPhotos((current) => current.filter((_, position) => position !== index))} />
                    </Flex>
                  ))}
                  <Button icon={<ImagePlus />} disabled={pendingPhotos.length >= PHOTO_LIMITS.maxPerOwner} onClick={() => fileRef.current?.click()}>
                    {t("media.add")}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(event) => {
                      const files = [...(event.target.files ?? [])];
                      event.target.value = "";
                      setPendingPhotos((current) => [...current, ...files].slice(0, PHOTO_LIMITS.maxPerOwner));
                    }}
                  />
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {t("media.hint", { max: PHOTO_LIMITS.maxPerOwner })}
                  </Typography.Text>
                </Flex>
              )}
            </Card>
            <Flex justify="flex-end" style={{ marginTop: 16 }}>
              {saveButton}
            </Flex>
          </Reveal>
        </Col>
      </Row>
    </RequirePermission>
  );
}

/** Un ingrediente: si el nombre coincide con algo del inventario, se vincula (y toma su unidad). */
function IngredientField({
  ingredient,
  options,
  onChange,
  onRemove,
  onPasteList,
  stacked,
}: {
  ingredient: IngredientDraft;
  options: ItemPlace[];
  onChange: (patch: Partial<IngredientDraft>) => void;
  onRemove: () => void;
  /** Se pegaron varios renglones en el nombre. */
  onPasteList: (text: string) => void;
  stacked: boolean;
}) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const { recipeStockLink } = usePreferences();
  const query = ingredient.name.trim().toLowerCase();
  const matches = recipeStockLink && query && !ingredient.itemId ? options.filter(({ item, place }) => !item.reusable && `${item.name} ${place}`.toLowerCase().includes(query)).slice(0, 6) : [];
  const linked = !!ingredient.itemId;
  function changeUnit(unit: string) {
    const item = options.find((option) => option.item.id === ingredient.itemId)?.item;
    onChange({ unit, ...(item && convertQuantity(1, unit, item.unit) === null ? { itemId: undefined } : {}) });
  }
  const linkedItem = options.find((option) => option.item.id === ingredient.itemId)?.item;
  const unitOptions = UNITS.map((unit) => ({ value: unit, label: t(`inventory.units.${unit}`, { count: 2 }) }));

  return (
    <Flex
      gap={8}
      align="center"
      wrap={stacked}
      onPasteCapture={(event) => {
        const text = event.clipboardData.getData("text");
        if (!/\r?\n/.test(text.trim())) return;
        event.preventDefault();
        onPasteList(text);
      }}
    >
      <AutoComplete
        value={ingredient.name}
        placeholder={t("recipes.editor.ingredientPlaceholder")}
        aria-label={t("recipes.editor.ingredientName")}
        prefix={recipeStockLink && linked ? <Tooltip title={t("recipes.editor.linked")}><Link2 style={{ color: token.colorPrimary }} /></Tooltip> : undefined}
        onChange={(value: string) => onChange(linked ? { name: value, itemId: undefined } : { name: value })}
        onSelect={(id: string) => {
          const match = options.find((option) => option.item.id === id);
          if (match) {
            const compatible = convertQuantity(ingredient.quantity ?? 1, ingredient.unit, match.item.unit) !== null;
            onChange({ itemId: match.item.id, name: match.item.name, unit: compatible ? ingredient.unit : match.item.unit, quantity: compatible ? ingredient.quantity : 1 });
          }
        }}
        options={matches.map(({ item, place }) => ({
          value: item.id,
          label: (
            <Flex align="center" justify="space-between" gap={8}>
              <span style={{ minWidth: 0 }}>
                <Typography.Text strong ellipsis style={{ display: "block" }}>
                  {item.name}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} ellipsis>
                  {place}
                </Typography.Text>
              </span>
              <StockTag status={getStockStatus(item)} />
            </Flex>
          ),
        }))}
        style={{ flex: stacked ? "1 1 100%" : "1 1 0", minWidth: 0 }}
      />
      <InputNumber
        aria-label={t("inventory.form.quantity")}
        // Suelto se pueden escribir decimales ("0,5 taza"); con las flechas va de a uno.
        min={0.001}
        precision={linked && !isMeasuredUnit(ingredient.unit) ? 0 : 3}
        value={ingredient.quantity}
        onChange={(value) => onChange({ quantity: value })}
        style={{ width: 90 }}
      />
      {linked && linkedItem ? <Select
        value={ingredient.unit}
        aria-label={t("inventory.form.unit")}
        options={[...UNITS, "ml"].filter((unit) => convertQuantity(1, unit, linkedItem.unit) !== null).map((unit) => ({ value: unit, label: isUnit(unit) ? t(`inventory.units.${unit}`, { count: 2 }) : unit }))}
        onChange={changeUnit}
        style={{ width: 120 }}
      /> : <AutoComplete
        value={isUnit(ingredient.unit) ? t(`inventory.units.${ingredient.unit}`, { count: 2 }) : ingredient.unit}
        options={unitOptions}
        aria-label={t("inventory.form.unit")}
        onChange={(value: string) => changeUnit(UNITS.find((unit) => t(`inventory.units.${unit}`, { count: 2 }) === value) ?? value)}
        onSelect={(value: string) => changeUnit(value)}
        style={{ width: 120 }}
      />}
      <Button type="text" danger aria-label={t("recipes.editor.removeIngredient")} icon={<Trash2 />} onClick={onRemove} />
    </Flex>
  );
}
