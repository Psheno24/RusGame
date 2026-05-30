import "dotenv/config";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { LOCAL_DEV, PORT, ROOT } from "./config.js";
import { getDb } from "./db.js";
import { registerRoutes } from "./routes.js";

const webDist = join(ROOT, "apps/web/dist");

async function main() {
  getDb();

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(cookie);

  await registerRoutes(app);

  if (existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: "/",
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api")) return reply.code(404).send({ error: "Not found" });
      return reply.sendFile("index.html");
    });
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`API http://localhost:${PORT}`);
  if (LOCAL_DEV) console.log("Режим: локальная разработка (cookie + долгий токен)");
  if (existsSync(webDist)) console.log("Собранный фронт: apps/web/dist (для прода позже)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
