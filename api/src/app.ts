import { FastifyInstance } from "fastify";
import { db } from "./db/client.js";
import { repoRoutes } from "./routes/repo.routes.js";
// import { authRoutes } from "./routes/auth.routes.js";

export async function registerRoute(server: FastifyInstance) {
  server.get("/health", async () => {
    return { status: "OK" };
  });

  server.get("/db-test", async () => {
    const result = await db.query("SELECT NOW()");
    return { time: result.rows[0].now };
  });

  server.get("/auth-success", async () => {
    return { time: Date.now(), status: "OK" };
  });

  // await server.register(authRoutes);
  await server.register(repoRoutes);
}
