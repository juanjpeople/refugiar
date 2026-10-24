"use client";

import { Button, Card, Flex, Typography, theme } from "antd";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { useT } from "@/i18n";

export function WeeklyMenu({ days, onAdd, onRemove }: {
  days: { id: string; label: string; meals: { id: string; label: string; href?: string; servings: number }[] }[];
  onAdd?: (id: string) => void; onRemove?: (id: string) => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  return (
    <Stagger>
      <Flex vertical gap={token.margin}>
        {days.map((day) => (
          <StaggerItem key={day.id}>
            <Card
              title={day.label}
              extra={
                onAdd && (
                  <Button
                    type="text"
                    icon={<Plus />}
                    aria-label={`${t("meals.add")}: ${day.label}`}
                    style={{ minWidth: 44, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    onClick={() => onAdd(day.id)}
                  />
                )
              }
            >
              <Flex vertical gap={token.marginSM}>
                {day.meals.length === 0 && (
                  <Typography.Text type="secondary">{t("meals.empty")}</Typography.Text>
                )}
                {day.meals.map((meal) => (
                  <Flex key={meal.id} justify="space-between" gap={token.marginXS} align="center">
                    <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                      {meal.href ? (
                        <Link href={meal.href} style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {meal.label}
                        </Link>
                      ) : (
                        <Typography.Text strong ellipsis>
                          {meal.label}
                        </Typography.Text>
                      )}
                      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                        {t("recipes.servings", { count: meal.servings })}
                      </Typography.Text>
                    </Flex>
                    {onRemove && (
                      <Button
                        type="text"
                        danger
                        icon={<Trash2 />}
                        aria-label={`${t("meals.remove")}: ${meal.label}`}
                        style={{ minWidth: 44, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        onClick={() => onRemove(meal.id)}
                      />
                    )}
                  </Flex>
                ))}
              </Flex>
            </Card>
          </StaggerItem>
        ))}
      </Flex>
    </Stagger>
  );
}
