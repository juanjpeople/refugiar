"use client";

import { Button, Card, Flex, Modal, Segmented, Tag, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { Check, Clock, Download, Plus, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { RecipeCover } from "./RecipeBits";
import { RECIPE_PACKS, type RecipePack, type StarterRecipe } from "../packs";
import { useRecipeActions, type RecipeSummary } from "../hooks";
import { normalizeIngredient } from "../domain";
import { useI18n } from "@/i18n";
import { SPRING } from "@/lib/motion";

interface RecipePacksModalProps {
  open: boolean;
  onClose: () => void;
  recipes?: RecipeSummary[];
}

export function RecipePacksModal({ open, onClose, recipes = [] }: RecipePacksModalProps) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const { importPack, importStarter } = useRecipeActions();
  const [activePackId, setActivePackId] = useState<string>(RECIPE_PACKS[0].id);
  const [importing, setImporting] = useState(false);

  const currentPack = RECIPE_PACKS.find((p) => p.id === activePackId) ?? RECIPE_PACKS[0];

  const existingNames = new Set(recipes.map((r) => normalizeIngredient(r.name)));
  const existingIds = new Set(recipes.map((r) => r.id));

  const isImported = (recipe: StarterRecipe) =>
    existingIds.has(recipe.id) || existingNames.has(normalizeIngredient(recipe.name));

  const pendingCount = currentPack.recipes.filter((r) => !isImported(r)).length;

  const handleImportPack = async (pack: RecipePack) => {
    setImporting(true);
    try {
      const count = await importPack(pack.id);
      if (count !== null && count > 0) {
        onClose();
      }
    } finally {
      setImporting(false);
    }
  };

  const handleImportSingle = async (recipe: StarterRecipe) => {
    await importStarter(recipe.id);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={680}
      title={
        <Flex align="center" gap={token.marginXS}>
          <Sparkles />
          <span>{t("recipes.packs.title")}</span>
        </Flex>
      }
    >
      <Flex vertical gap={token.marginMD} style={{ marginTop: token.marginSM }}>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          {t("recipes.packs.subtitle")}
        </Typography.Paragraph>

        <Segmented
          block
          value={activePackId}
          onChange={(val) => setActivePackId(val as string)}
          options={RECIPE_PACKS.map((pack) => ({
            value: pack.id,
            label: (
              <span style={{ fontSize: token.fontSizeSM, fontWeight: activePackId === pack.id ? 600 : 400 }}>
                {t(`recipes.packs.${pack.key}.title`)}
              </span>
            ),
          }))}
        />

        <Card
          bordered
          styles={{ body: { padding: token.paddingMD } }}
          style={{ background: token.colorFillAlter }}
        >
          <Flex vertical gap={token.marginSM}>
            <Flex justify="space-between" align="center" wrap gap={token.marginSM}>
              <Flex vertical gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text strong style={{ fontSize: token.fontSizeLG }}>
                  {t(`recipes.packs.${currentPack.key}.title`)}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {t(`recipes.packs.${currentPack.key}.text`)}
                </Typography.Text>
              </Flex>
              <Button
                type="primary"
                icon={<Download />}
                loading={importing}
                style={{ minHeight: 44 }}
                disabled={pendingCount === 0}
                onClick={() => handleImportPack(currentPack)}
              >
                {pendingCount > 0
                  ? t("recipes.packs.importPack", { count: pendingCount })
                  : t("recipes.packs.allImported")}
              </Button>
            </Flex>
          </Flex>
        </Card>

        <Flex vertical gap={token.marginSM}>
          {currentPack.recipes.map((item) => {
            const alreadyIn = isImported(item);
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING.soft}
              >
                <Card
                  size="small"
                  hoverable={!alreadyIn}
                  styles={{ body: { padding: token.paddingSM } }}
                >
                  <Flex align="center" justify="space-between" gap={token.marginSM} wrap>
                    <Flex align="center" gap={token.marginSM} style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ width: 64, height: 48, flexShrink: 0, borderRadius: token.borderRadius, overflow: "hidden" }}>
                        <RecipeCover recipeId={item.id} name={item.name} aspectRatio="4 / 3" />
                      </div>

                      <Flex vertical gap={2} style={{ flex: 1, minWidth: 0 }}>
                        <Typography.Text strong ellipsis>
                          {item.name}
                        </Typography.Text>
                        <Flex gap={token.marginSM} align="center" wrap style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Clock /> {t("recipes.minutes", { count: item.minutes })}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Users /> {t("recipes.servings", { count: item.servings })}
                          </span>
                          {item.tags.slice(0, 2).map((tag) => (
                            <Tag key={tag} style={{ margin: 0, paddingInline: 4, fontSize: token.fontSizeSM }}>
                              {t(`recipes.tags.${tag}`)}
                            </Tag>
                          ))}
                        </Flex>
                      </Flex>
                    </Flex>

                    {alreadyIn ? (
                      <Tag color="success" icon={<Check />} style={{ margin: 0 }}>
                        {t("recipes.packs.alreadyIn")}
                      </Tag>
                    ) : (
                      <Button
                        size="small"
                        icon={<Plus />}
                        style={{ minHeight: 36 }}
                        onClick={() => handleImportSingle(item)}
                      >
                        {t("recipes.packs.importSingle")}
                      </Button>
                    )}
                  </Flex>
                </Card>
              </motion.div>
            );
          })}
        </Flex>
      </Flex>
    </Modal>
  );
}
