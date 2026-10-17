"use client";

import { Button, Card, Flex, Typography } from "antd";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { useT } from "@/i18n";

export function WeeklyMenu({ days, onAdd, onRemove }: {
  days: { id: string; label: string; meals: { id: string; label: string; href?: string; servings: number }[] }[];
  onAdd?: (id: string) => void; onRemove?: (id: string) => void;
}) {
  const t = useT();
  return <Stagger><Flex vertical gap="middle">{days.map(day => <StaggerItem key={day.id}>
    <Card title={day.label} extra={onAdd && <Button type="text" icon={<Plus />} aria-label={`${t("meals.add")}: ${day.label}`} onClick={() => onAdd(day.id)} />}>
      <Flex vertical gap="middle">
        {day.meals.length === 0 && <Typography.Text type="secondary">{t("meals.empty")}</Typography.Text>}
        {day.meals.map(meal => <Flex key={meal.id} justify="space-between" gap="small" align="center">
          <Flex vertical>{meal.href ? <Link href={meal.href}>{meal.label}</Link> : <Typography.Text>{meal.label}</Typography.Text>}<Typography.Text type="secondary">{t("recipes.servings", { count: meal.servings })}</Typography.Text></Flex>
          {onRemove && <Button type="text" icon={<Trash2 />} aria-label={`${t("meals.remove")}: ${meal.label}`} onClick={() => onRemove(meal.id)} />}
        </Flex>)}
      </Flex>
    </Card>
  </StaggerItem>)}</Flex></Stagger>;
}
