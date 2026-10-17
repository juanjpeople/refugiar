/** Illustrative generated images bundled offline. A personal photo always takes precedence. */
const covers: Record<string, { name: string; file: string }> = {
  "2c52e157-a016-4a53-8a30-7b922edd666c": {
    "name": "Manzanas al horno",
    "file": "baked-apples"
  },
  "53b9f67b-7b44-45bd-89a1-bd32154e8aa1": {
    "name": "Galletitas de avena",
    "file": "oat-cookies"
  },
  "55b0d7cd-8fde-4488-9c73-274f9af57a2d": {
    "name": "Ensalada de lentejas",
    "file": "lentil-salad"
  },
  "614a5b54-6107-4519-b242-b55541892786": {
    "name": "Budín de limón",
    "file": "lemon-cake"
  },
  "71fdd246-d49d-4df8-9c8f-431efd516cf3": {
    "name": "Fideos con salsa rápida",
    "file": "pasta"
  },
  "800fbbfe-1384-401b-b409-392dcdbb018e": {
    "name": "Omelette de queso",
    "file": "omelette"
  },
  "834dd758-d5bc-4f20-84e9-70865a5a8fc3": {
    "name": "Arroz con tomate — 10 porciones",
    "file": "rice"
  },
  "85eb75c1-3075-41ea-8e9f-104c122a795d": {
    "name": "Sopa de calabaza",
    "file": "pumpkin-soup"
  },
  "8e500411-41aa-4b67-b54f-2885677ef153": {
    "name": "Hummus casero",
    "file": "hummus"
  },
  "9097b101-a965-4bf5-a5bc-2f121056491a": {
    "name": "Guiso de lentejas y verduras",
    "file": "lentil-stew"
  },
  "973e9bc2-2fdd-453d-8f41-692dc9fa6ec0": {
    "name": "Ensalada de garbanzos",
    "file": "chickpea-salad"
  },
  "be96cab3-e5f7-4292-b4e3-583d614d03df": {
    "name": "Pizza de la familia",
    "file": "pizza"
  },
  "cd11b372-b489-400e-8165-4d152ace769c": {
    "name": "Polenta cremosa",
    "file": "polenta"
  },
  "d42d88a0-998f-462a-8b7f-6f88b972b0c0": {
    "name": "Tortilla de papas",
    "file": "potato-tortilla"
  },
  "f64a28c1-f5df-43f1-8eb2-0e7872de7ef9": {
    "name": "Panqueques caseros",
    "file": "pancakes"
  }
};
export function exampleCover(id: string, name: string | undefined, thumb: boolean) {
  const cover = covers[id];
  return cover && name === cover.name ? `/recipes/${cover.file}${thumb ? "-thumb" : ""}.webp` : undefined;
}

export const EXAMPLE_COVER_ASSETS = Object.values(covers).flatMap(({ file }) => [`/recipes/${file}.webp`, `/recipes/${file}-thumb.webp`]);
