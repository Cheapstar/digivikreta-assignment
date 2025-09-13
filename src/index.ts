import fastify from "fastify";
import HealthRoutes from "./routes/api/v1/health.js";
import TelemetryRoutes from "./routes/api/v1/telemetry.js";
import BillingRoutes from "./routes/api/v1/billing.js";
import { logger } from "./lib/logger.js";
import RelayRoutes from "./routes/api/v1/relay.js";
import MockRoutes from "./routes/mock/mock.js";
import cors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import ReadyRoutes from "./routes/api/v1/ready.js";

const server = fastify();
server.register(cors);
server.register(fastifyRateLimit, {
  global: false,
  errorResponseBuilder: (request: any, context: any) => {
    return {
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Retry in ${context.after}`,
      retryAfter: context.after,
    };
  },
});
server.register(HealthRoutes, { prefix: "api/v1" });
server.register(ReadyRoutes, { prefix: "api/v1" });
server.register(TelemetryRoutes, { prefix: "api/v1/telemetry" });
server.register(RelayRoutes, { prefix: "api/v1/relay" });
server.register(BillingRoutes, { prefix: "api/v1/billing" });
server.register(MockRoutes);

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
