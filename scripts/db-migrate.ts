import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { pool } from "@/lib/db/client";

async function main() {
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await pool.query(sql);
    console.log(`applied ${file}`);
  }
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
