import type { RecipeTag } from "./domain";

export interface StarterRecipe {
  id: string;
  name: string;
  servings: number;
  minutes: number;
  tags: RecipeTag[];
  stepSeconds?: number[];
  steps: string[];
  ingredients: { name: string; quantity: number; unit: string }[];
}

export interface RecipePack {
  id: string;
  key: "basics" | "healthy" | "family";
  recipes: StarterRecipe[];
}

export const RECIPE_PACKS: RecipePack[] = [
  {
    id: "pack-basics",
    key: "basics",
    recipes: [
      {
        id: "f64a28c1-f5df-43f1-8eb2-0e7872de7ef9",
        name: "Panqueques caseros",
        servings: 4,
        minutes: 30,
        tags: ["kids", "budget"],
        stepSeconds: [0, 600, 60, 30],
        steps: [
          "Batí los huevos con la leche.",
          "Agregá la harina de a poco y mezclá. Dejá reposar unos 10 minutos.",
          "Cociná una capa fina en sartén caliente unos 60 segundos, hasta que se despegue.",
          "Dala vuelta y cociná unos 30 segundos más. Repetí con el resto de la mezcla.",
        ],
        ingredients: [
          { name: "Huevos", quantity: 2, unit: "unidades" },
          { name: "Harina", quantity: 200, unit: "gr" },
          { name: "Leche", quantity: 500, unit: "ml" },
        ],
      },
      {
        id: "d42d88a0-998f-462a-8b7f-6f88b972b0c0",
        name: "Tortilla de papas",
        servings: 4,
        minutes: 40,
        tags: ["kids", "budget"],
        stepSeconds: [0, 900, 300, 300],
        steps: [
          "Cortá las papas y la cebolla en rodajas finas.",
          "Cocinalas en sartén a fuego moderado unos 15 minutos, hasta que estén tiernas. Mezclá con los huevos batidos.",
          "Cuajá en sartén a fuego moderado unos 5 minutos.",
          "Dala vuelta con un plato y cociná unos 5 minutos del otro lado.",
        ],
        ingredients: [
          { name: "Papa", quantity: 600, unit: "gr" },
          { name: "Huevos", quantity: 4, unit: "unidades" },
          { name: "Cebolla", quantity: 1, unit: "unidades" },
        ],
      },
      {
        id: "71fdd246-d49d-4df8-9c8f-431efd516cf3",
        name: "Fideos con salsa rápida",
        servings: 4,
        minutes: 25,
        tags: ["budget", "kids"],
        stepSeconds: [300, 900, 0],
        steps: [
          "Rehogá la cebolla unos 5 minutos y agregá el tomate.",
          "Cociná la salsa a fuego bajo unos 15 minutos, revolviendo de vez en cuando.",
          "Herví los fideos el tiempo indicado en su envase. Escurrí y mezclá con la salsa.",
        ],
        ingredients: [
          { name: "Fideos secos", quantity: 400, unit: "gr" },
          { name: "Tomate triturado", quantity: 500, unit: "gr" },
          { name: "Cebolla", quantity: 1, unit: "unidades" },
        ],
      },
      {
        id: "800fbbfe-1384-401b-b409-392dcdbb018e",
        name: "Omelette de queso",
        servings: 1,
        minutes: 10,
        tags: ["quick"],
        stepSeconds: [0, 120, 120],
        steps: [
          "Batí los huevos.",
          "Verté en una sartén caliente ligeramente aceitada. Cociná unos 2 minutos a fuego moderado.",
          "Agregá el queso, doblá y cociná unos 2 minutos más.",
        ],
        ingredients: [
          { name: "Huevos", quantity: 2, unit: "unidades" },
          { name: "Queso", quantity: 50, unit: "gr" },
        ],
      },
      {
        id: "be96cab3-e5f7-4292-b4e3-583d614d03df",
        name: "Pizza de la familia",
        servings: 4,
        minutes: 90,
        tags: ["party", "kids"],
        stepSeconds: [0, 2700, 0, 1200],
        steps: [
          "Mezclá harina, levadura, agua y sal. Amasá hasta lograr una masa suave.",
          "Tapá y dejá leudar unos 45 minutos hasta que duplique su volumen.",
          "Estirá en una pizzera aceitada. Cubrí con salsa y queso.",
          "Horneá en horno precalentado a 220 °C unos 20 minutos hasta dorar.",
        ],
        ingredients: [
          { name: "Harina", quantity: 500, unit: "gr" },
          { name: "Levadura seca", quantity: 7, unit: "gr" },
          { name: "Agua", quantity: 300, unit: "ml" },
          { name: "Queso", quantity: 250, unit: "gr" },
          { name: "Tomate triturado", quantity: 300, unit: "gr" },
        ],
      },
    ],
  },
  {
    id: "pack-healthy",
    key: "healthy",
    recipes: [
      {
        id: "8e500411-41aa-4b67-b54f-2885677ef153",
        name: "Hummus casero",
        servings: 4,
        minutes: 15,
        tags: ["vegan", "quick"],
        stepSeconds: [0, 0],
        steps: [
          "Procesá los garbanzos con aceite, jugo de limón, sal y un chorrito de agua.",
          "Ajustá la textura hasta que quede cremosa. Serví con un hilo de aceite.",
        ],
        ingredients: [
          { name: "Garbanzos cocidos", quantity: 400, unit: "gr" },
          { name: "Aceite de oliva", quantity: 30, unit: "ml" },
          { name: "Limón", quantity: 1, unit: "unidades" },
        ],
      },
      {
        id: "55b0d7cd-8fde-4488-9c73-274f9af57a2d",
        name: "Ensalada de lentejas",
        servings: 4,
        minutes: 35,
        tags: ["healthy", "vegetarian"],
        stepSeconds: [1500, 0, 0],
        steps: [
          "Cociná las lentejas en agua unos 25 minutos hasta que estén tiernas.",
          "Escurrí, dejá enfriar y mezclá con las verduras cortadas.",
          "Condimentá a gusto y serví.",
        ],
        ingredients: [
          { name: "Lentejas", quantity: 300, unit: "gr" },
          { name: "Tomate", quantity: 2, unit: "unidades" },
          { name: "Zanahoria", quantity: 1, unit: "unidades" },
        ],
      },
      {
        id: "973e9bc2-2fdd-453d-8f41-692dc9fa6ec0",
        name: "Ensalada de garbanzos",
        servings: 4,
        minutes: 15,
        tags: ["vegan", "healthy"],
        stepSeconds: [0, 0, 0],
        steps: [
          "Escurrí los garbanzos ya cocidos.",
          "Cortá las verduras en cubos y mezclá.",
          "Aliñá con aceite, limón y sal a gusto.",
        ],
        ingredients: [
          { name: "Garbanzos cocidos", quantity: 400, unit: "gr" },
          { name: "Pepino", quantity: 1, unit: "unidades" },
          { name: "Tomate", quantity: 2, unit: "unidades" },
        ],
      },
      {
        id: "85eb75c1-3075-41ea-8e9f-104c122a795d",
        name: "Sopa de calabaza",
        servings: 4,
        minutes: 35,
        tags: ["vegetarian", "healthy"],
        stepSeconds: [0, 1200, 0],
        steps: [
          "Pelá y cortá la calabaza y la cebolla en trozos.",
          "Herví con agua o caldo unos 20 minutos hasta que la calabaza esté blanda.",
          "Procesá hasta lograr una crema homogénea y condimentá a gusto.",
        ],
        ingredients: [
          { name: "Calabaza", quantity: 800, unit: "gr" },
          { name: "Cebolla", quantity: 1, unit: "unidades" },
          { name: "Agua", quantity: 500, unit: "ml" },
        ],
      },
      {
        id: "cd11b372-b489-400e-8165-4d152ace769c",
        name: "Polenta cremosa",
        servings: 4,
        minutes: 20,
        tags: ["quick", "budget"],
        stepSeconds: [0, 0, 0],
        steps: [
          "Herví el agua con sal.",
          "Agregá la polenta en lluvia revolviendo constantemente.",
          "Terminá con el queso rallado y serví caliente.",
        ],
        ingredients: [
          { name: "Polenta", quantity: 250, unit: "gr" },
          { name: "Agua", quantity: 1000, unit: "ml" },
          { name: "Queso rallado", quantity: 50, unit: "gr" },
        ],
      },
    ],
  },
  {
    id: "pack-family",
    key: "family",
    recipes: [
      {
        id: "53b9f67b-7b44-45bd-89a1-bd32154e8aa1",
        name: "Galletitas de avena",
        servings: 8,
        minutes: 25,
        tags: ["dessert", "budget"],
        stepSeconds: [0, 0, 900],
        steps: [
          "Pisá las bananas y mezclalas con la avena y las pasas.",
          "Formá galletitas con una cuchara sobre una placa aceitada.",
          "Horneá a 180 °C unos 15 minutos hasta que estén doradas.",
        ],
        ingredients: [
          { name: "Avena", quantity: 200, unit: "gr" },
          { name: "Banana", quantity: 2, unit: "unidades" },
          { name: "Pasas", quantity: 50, unit: "gr" },
        ],
      },
      {
        id: "614a5b54-6107-4519-b242-b55541892786",
        name: "Budín de limón",
        servings: 8,
        minutes: 55,
        tags: ["dessert", "party"],
        stepSeconds: [0, 0, 2400],
        steps: [
          "Batí los huevos con azúcar, aceite, leche, jugo y ralladura de limón.",
          "Incorporá la harina y el polvo de hornear. Volcá en un molde aceitado.",
          "Horneá a 170 °C unos 40 minutos hasta que un palillo salga limpio.",
        ],
        ingredients: [
          { name: "Harina", quantity: 250, unit: "gr" },
          { name: "Azúcar", quantity: 150, unit: "gr" },
          { name: "Huevos", quantity: 2, unit: "unidades" },
          { name: "Leche", quantity: 100, unit: "ml" },
          { name: "Aceite", quantity: 80, unit: "ml" },
          { name: "Limón", quantity: 1, unit: "unidades" },
        ],
      },
      {
        id: "2c52e157-a016-4a53-8a30-7b922edd666c",
        name: "Manzanas al horno",
        servings: 4,
        minutes: 40,
        tags: ["dessert", "healthy"],
        stepSeconds: [0, 0, 1800],
        steps: [
          "Retirá el centro de las manzanas y ponelas en una fuente.",
          "Espolvoreá con azúcar y canela. Agregá un fondo de agua.",
          "Horneá a 180 °C unos 30 minutos hasta que estén tiernas.",
        ],
        ingredients: [
          { name: "Manzana", quantity: 4, unit: "unidades" },
          { name: "Canela", quantity: 1, unit: "cucharadita" },
          { name: "Azúcar", quantity: 2, unit: "cucharadas" },
        ],
      },
      {
        id: "9097b101-a965-4bf5-a5bc-2f121056491a",
        name: "Guiso de lentejas y verduras",
        servings: 6,
        minutes: 50,
        tags: ["vegan", "batch"],
        stepSeconds: [300, 2100],
        steps: [
          "Rehogá las verduras unos 5 minutos. Agregá las lentejas y cubrí con agua.",
          "Cociná a fuego suave unos 35 minutos hasta que todo esté tierno.",
        ],
        ingredients: [
          { name: "Lentejas", quantity: 300, unit: "gr" },
          { name: "Zanahoria", quantity: 2, unit: "unidades" },
          { name: "Papa", quantity: 2, unit: "unidades" },
        ],
      },
      {
        id: "834dd758-d5bc-4f20-84e9-70865a5a8fc3",
        name: "Arroz con tomate",
        servings: 6,
        minutes: 30,
        tags: ["budget", "batch"],
        stepSeconds: [300, 1200],
        steps: [
          "Rehogá cebolla y ajo con aceite unos 5 minutos.",
          "Agregá el arroz y el tomate triturado con agua caliente. Cociná 20 minutos.",
        ],
        ingredients: [
          { name: "Arroz", quantity: 400, unit: "gr" },
          { name: "Tomate triturado", quantity: 400, unit: "gr" },
          { name: "Cebolla", quantity: 1, unit: "unidades" },
        ],
      },
    ],
  },
];
