import fastify from "fastify";
import HealthRoutes from "./routes/api/v1/health.js";
import TelemetryRoutes from "./routes/api/v1/telemetry.js";
import { logger } from "./logger.js";

const server = fastify();

server.register(HealthRoutes, { prefix: "api/v1" });
server.register(TelemetryRoutes, { prefix: "api/v1/telemetry" });

server.listen(
  { port: Number(process.env.PORT) || 8080, host: "0.0.0.0" },
  (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    logger.info(`Server is Listening at Port : ${address}`);
  }
);
