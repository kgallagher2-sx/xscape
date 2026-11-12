const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { compactItemList, expandItemList, isStackableItem, groupStackablesInList } = require("../items-stack.js");

describe("6.2 item stack compact/expand", () => {
  it("round-trips counts and first-seen unique-item order losslessly", () => {
    // Interleaved copies of the same id collapse into one stack at first seen.
    // Counts and the order of distinct ids are preserved; slot interleaving is not.
    const src = ["rune_crossbow", "ember_rune", "ember_rune", "ember_rune", "shark", "ember_rune"];
    const compact = compactItemList(src);
    assert.equal(compact.v, 2);
    assert.deepEqual(compact.items, { rune_crossbow: 1, ember_rune: 4, shark: 1 });
    assert.deepEqual(compact.order, ["rune_crossbow", "ember_rune", "shark"]);
    assert.deepEqual(expandItemList(compact), ["rune_crossbow", "ember_rune", "ember_rune", "ember_rune", "ember_rune", "shark"]);
    assert.deepEqual(expandItemList(src), src);
    const grouped = ["rune_crossbow", "ember_rune", "ember_rune", "ember_rune", "ember_rune", "shark"];
    assert.deepEqual(expandItemList(compactItemList(grouped)), grouped);
  });

  it("expands a plain {id:count} map to the same counts (order not guaranteed)", () => {
    const out = expandItemList({ ember_rune: 150, rune_crossbow: 1 });
    const counts = out.reduce((m, id) => (m[id] = (m[id] || 0) + 1, m), {});
    assert.deepEqual(counts, { ember_rune: 150, rune_crossbow: 1 });
    assert.equal(out.length, 151);
  });

  it("treats empty array and empty compact object as no items", () => {
    assert.deepEqual(expandItemList([]), []);
    assert.deepEqual(expandItemList({ v: 2, items: {}, order: [] }), []);
    assert.deepEqual(expandItemList({}), []);
    assert.deepEqual(expandItemList(null), []);
    assert.deepEqual(compactItemList([]), { v: 2, items: {}, order: [] });
  });

  it("does not treat v/items/order as item ids on a compact object", () => {
    const out = expandItemList({ v: 2, items: { shark: 2 }, order: ["shark"] });
    assert.deepEqual(out, ["shark", "shark"]);
  });

  it("round-trips CloudTestA-shaped inventory (150 ember_rune + 1 rune_crossbow)", () => {
    const src = Array(150).fill("ember_rune").concat(["rune_crossbow"]);
    assert.deepEqual(expandItemList(compactItemList(src)), src);
  });
});

describe("stackable inventory grouping", () => {
  it("treats runes, bolts, arrows, and coins as stackable, not food, potions, or gear", () => {
    assert.equal(isStackableItem("ember_rune"), true);
    assert.equal(isStackableItem("mithril_bolts"), true);
    assert.equal(isStackableItem("rune_bolts"), true);
    assert.equal(isStackableItem("bronze_arrows"), true);
    assert.equal(isStackableItem("coins"), true);
    assert.equal(isStackableItem("shark"), false);
    assert.equal(isStackableItem("dark_crab"), false);
    assert.equal(isStackableItem("prayer_potion_4"), false);
    assert.equal(isStackableItem("saradomin_brew_3"), false);
    assert.equal(isStackableItem("rune_crossbow"), false);
    assert.equal(isStackableItem("green_dhide_body"), false);
  });

  it("groups stackable copies together and leaves food and gear in place", () => {
    const src = ["shark", "ember_rune", "shark", "ember_rune", "mithril_bolts", "rune_crossbow", "mithril_bolts"];
    assert.deepEqual(
      groupStackablesInList(src),
      ["shark", "ember_rune", "ember_rune", "shark", "mithril_bolts", "mithril_bolts", "rune_crossbow"]
    );
  });
});
