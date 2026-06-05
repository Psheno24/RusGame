import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Подключается через --import в npm test; не трогает data/game.db */
if (!process.env.DB_PATH) {
  const dir = mkdtempSync(join(tmpdir(), "rg-test-"));
  process.env.DB_PATH = join(dir, "test.db");
}
