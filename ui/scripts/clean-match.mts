import { readFileSync, writeFileSync } from "node:fs";
const f = process.argv[2] || "src/lib/conclave/match-live.json";
const clean = (s: any) => typeof s === "string"
  ? s.replace(/\s*[—–―]\s*/g, ", ").replace(/\s*\b(MOVE|READ|SAY)\s*:.*$/is, "").replace(/\s+,/g, ",").replace(/\s+/g, " ").trim()
  : s;
const walk = (o: any): any => Array.isArray(o) ? o.map(walk) : (o && typeof o === "object") ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v)])) : clean(o);
writeFileSync(f, JSON.stringify(walk(JSON.parse(readFileSync(f, "utf8"))), null, 2));
console.log("cleaned", f);
