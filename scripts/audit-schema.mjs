import fs from "node:fs";
import ts from "typescript";
import path from "node:path";
const snapshot = JSON.parse(
  fs.readFileSync(
    process.argv.includes("--candidate")
      ? "scripts/candidate-schema.json"
      : "scripts/live-schema-audit.json",
    "utf8",
  ),
);
const tables = new Map();
for (const c of snapshot.columns) {
  if (!tables.has(c.table)) tables.set(c.table, new Set());
  tables.get(c.table).add(c.column);
}
function root(n) {
  if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
    if (
      n.expression.name.text === "from" &&
      n.expression.expression.getText().includes(".storage")
    )
      return null;
    if (n.expression.name.text === "from" && ts.isStringLiteral(n.arguments[0]))
      return n.arguments[0].text;
    return root(n.expression.expression);
  }
  return null;
}
const errors = [];
function scan(file) {
  const source = fs.readFileSync(file, "utf8"),
    ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function visit(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const table = root(n);
      if (table) {
        const method = n.expression.name.text,
          cols = tables.get(table),
          arg = n.arguments[0];
        if (!cols) {
          if (method === "from")
            errors.push({ file, table, issue: "missing table" });
        } else {
          let names = [];
          if (
            ["eq", "in", "is", "order", "gte", "gt", "lt", "lte"].includes(
              method,
            ) &&
            arg &&
            ts.isStringLiteral(arg)
          )
            names = [arg.text];
          if (
            method === "select" &&
            arg &&
            ts.isStringLiteral(arg) &&
            !arg.text.includes("(") &&
            arg.text !== "*"
          )
            names = arg.text.split(",").map((s) => s.trim());
          if (
            ["insert", "upsert", "update"].includes(method) &&
            arg &&
            ts.isObjectLiteralExpression(arg)
          )
            names = arg.properties
              .filter(ts.isPropertyAssignment)
              .map((p) => p.name.getText(ast).replace(/^['"]|['"]$/g, ""));
          for (const column of names)
            if (column && !cols.has(column))
              errors.push({ file, table, column, issue: "missing column" });
        }
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(ast);
}
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.tsx?$/.test(f) && !f.includes("__tests__")) scan(f);
  }
}
walk("src");
walk("supabase/functions");
console.log(JSON.stringify(errors, null, 2));
if (process.argv.includes("--check") && errors.length) process.exitCode = 1;
