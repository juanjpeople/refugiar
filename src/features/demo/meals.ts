import type { CalendarEvent } from "@/features/calendar/domain";

const DAY = 86_400_000;

export function demoMeals(now = Date.now()): CalendarEvent[] {
  const date = new Date(now);
  const currentDay = date.getDay(); // 0 is Sunday, 1 is Monday...
  const mondayOffset = (currentDay + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset).getTime();

  const wednesday = monday + 2 * DAY;
  const friday = monday + 4 * DAY;
  const sunday = monday + 6 * DAY;

  return [
    {
      id: "demo-meal-fideos",
      title: "Fideos con salsa rápida — DEMO",
      privacy: "family",
      start: wednesday,
      end: wednesday,
      allDay: true,
      repeat: "none",
      color: "orange",
      meal: {
        recipeId: "71fdd246-d49d-4df8-9c8f-431efd516cf3",
        servings: 4,
        cookId: "profile-admin",
      },
      participantIds: ["profile-admin"],
      createdBy: "profile-admin",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "demo-meal-pizza",
      title: "Pizza de la familia — DEMO",
      privacy: "family",
      start: friday,
      end: friday,
      allDay: true,
      repeat: "none",
      color: "orange",
      meal: {
        recipeId: "be96cab3-e5f7-4292-b4e3-583d614d03df",
        servings: 6,
        cookId: "profile-admin",
      },
      participantIds: ["profile-admin"],
      createdBy: "profile-admin",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "demo-meal-tortilla",
      title: "Tortilla de papas — DEMO",
      privacy: "family",
      start: sunday,
      end: sunday,
      allDay: true,
      repeat: "none",
      color: "orange",
      meal: {
        recipeId: "d42d88a0-998f-462a-8b7f-6f88b972b0c0",
        servings: 4,
        cookId: "profile-admin",
      },
      participantIds: ["profile-admin"],
      createdBy: "profile-admin",
      createdAt: now,
      updatedAt: now,
    },
  ];
}
