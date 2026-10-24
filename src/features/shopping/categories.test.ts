import { test } from "node:test";
import assert from "node:assert/strict";
import { guessShoppingCategory, SHOPPING_CATEGORIES } from "./categories";

test("clasifica correctamente alimentos y productos cotidianos", () => {
  assert.equal(guessShoppingCategory("Leche entera La Serenísima"), "lacteos");
  assert.equal(guessShoppingCategory("Queso cremoso 500g"), "lacteos");
  assert.equal(guessShoppingCategory("Yogur de frutilla"), "lacteos");

  assert.equal(guessShoppingCategory("Manzanas rojas"), "frescos");
  assert.equal(guessShoppingCategory("1 kg de tomates"), "frescos");
  assert.equal(guessShoppingCategory("Papas y cebollas"), "frescos");

  assert.equal(guessShoppingCategory("Asado de tira"), "carniceria");
  assert.equal(guessShoppingCategory("Pechuga de pollo"), "carniceria");
  assert.equal(guessShoppingCategory("Filet de merluza"), "carniceria");

  assert.equal(guessShoppingCategory("Pan lactal blanco"), "panaderia");
  assert.equal(guessShoppingCategory("Galletitas de agua"), "panaderia");
  assert.equal(guessShoppingCategory("Tapas de empanadas"), "panaderia");

  assert.equal(guessShoppingCategory("Yerba mate"), "bebidas");
  assert.equal(guessShoppingCategory("Agua mineral con gas"), "bebidas");
  assert.equal(guessShoppingCategory("Cerveza rubia"), "bebidas");

  assert.equal(guessShoppingCategory("Detergente magistral"), "limpieza");
  assert.equal(guessShoppingCategory("Lavandina en gel"), "limpieza");
  assert.equal(guessShoppingCategory("Papel higiénico 4 rollos"), "limpieza");

  assert.equal(guessShoppingCategory("Shampoo anticaída"), "perfumeria");
  assert.equal(guessShoppingCategory("Pasta dental"), "perfumeria");
  assert.equal(guessShoppingCategory("Desodorante antitranspirante"), "perfumeria");

  assert.equal(guessShoppingCategory("Arroz blanco"), "almacen");
  assert.equal(guessShoppingCategory("Fideos moñito"), "almacen");
  assert.equal(guessShoppingCategory("Aceite de girasol"), "almacen");

  assert.equal(guessShoppingCategory("Pilas AAA"), "otros");
  assert.equal(guessShoppingCategory("Velas de cumpleaños"), "otros");
});

test("las categorías son las 9 definidas", () => {
  assert.equal(SHOPPING_CATEGORIES.length, 9);
});
