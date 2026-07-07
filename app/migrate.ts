import { SQL } from "bun";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { drizzle } from "drizzle-orm/bun-sql";

const sqlConnect = new SQL(process.env.DATABASE_URL!)
const db = drizzle(sqlConnect);

export async function migrateDB() {
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }

}
