const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const resetPassword = fs.readFileSync(path.join(__dirname, "..", "reset-password.html"), "utf8");

test("new and confirmation password fields advertise new-password autocomplete", () => {
  for (const id of ["new-password", "confirm-password"]) {
    const input = resetPassword.match(new RegExp(`<input\\b(?=[^>]*\\bid="${id}")[^>]*>`))?.[0];
    assert.ok(input, `expected #${id} input`);
    assert.match(input, /autocomplete="new-password"/);
  }
});
