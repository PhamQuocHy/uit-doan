/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node CommonJS script */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseValues, damagedUtf8 } = require("./repair-sql-encoding.cjs");

test("parses dump strings without executing SQL, preserving Vietnamese and escapes", () => {
  assert.deepEqual(parseValues("('id', 'Phú Lộc', 'O\\'Brien; note', NULL, 12), ('id2', 'a,b', 'line\\nnext', 'it''s', -1)"),
    [["id", "Phú Lộc", "O'Brien; note", null, "12"], ["id2", "a,b", "line\nnext", "it's", "-1"]]);
});
test("recognizes the exact byte replacement from the damaged import", () => {
  assert.equal(damagedUtf8("Thành phố Cần Thơ"), "Th??nh ph??? C???n Th??");
  assert.notEqual(damagedUtf8("Phú Lộc"), "A later manual edit");
  assert.throws(() => parseValues("('unfinished)"));
  assert.throws(() => parseValues("(NOW())"));
});
