import { migrate } from "drizzle-orm/bun-sql/migrator";
import { drizzle } from "drizzle-orm/bun-sql";

const db = drizzle(process.env.DATABASE_URL!);

export async function migrateDB() {
  try {
    await migrate(db, { migrationsFolder: "./app/drizzle" });
    console.log("Migrations applied successfully");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }

}
