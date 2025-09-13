import { FastifyInstance } from "fastify";
import { prisma } from "../../../db/client.js";
import axios from "axios";
import { retryWithBackOff } from "../../../lib/utils.js";
import { logger } from "../../../logger.js";
import z from "zod";

const relaySchema = z.object({
  clientId: z.string().min(1),
  message: z.string().min(1),
  meta: z.record(z.any(), z.any()).optional(),
});

export default async function RelayRoutes(server: FastifyInstance) {
  server.post(
    "/publish",
    {
      config: {
        rateLimit: {
          max: parseInt(process.env.RATE_LIMIT_RELAY || "50", 10),
          timeWindow: "1 minute",
          keyGenerator: (req: any) => {
            const id = req.body?.deviceId || "unknown-device";
            return `${id}-${req.ip}`;
          },
        },
      },
    },
    async (req, res) => {
      try {
        const apiKey = req.headers["x-api-key"] as string;
        if (!apiKey) {
          logger.error("Api Key Missing");
          res.code(401);
          return {
            error: "API key required",
            code: "MISSING_API_KEY",
            reqId: req.headers["x-req-id"],
          };
        }
        const data = relaySchema.parse(req.body);
        const client = await prisma.client.findUnique({
          where: { apiKey, id: data.clientId },
        });

        if (!client) {
          logger.error("Client Does not Exist ");

          res.code(401);
          return {
            error: "Client Does not Exist ",
            code: "INVALID_CLIENT",
            reqId: req.headers["x-req-id"],
          };
        }

        if (client.apiKey != apiKey || client.status !== "ACTIVE") {
          logger.error("Invalid API key");

          res.code(401);
          return {
            error: "Invalid or inactive API key",
            code: "INVALID_API_KEY",
            reqId: req.headers["x-req-id"],
          };
        }

        const idempotencyKey =
          (req.headers["x-idempotency-key"] as string) || crypto.randomUUID();

        // check for idempotency
        const existingLog = await prisma.relayLog.findUnique({
          where: { idempotencyKey },
        });

        if (existingLog) {
          return {
            message: "Message already processed",
            relayId: existingLog.id,
            status: existingLog.status,
            reqId: req.headers["x-req-id"],
          };
        }

        // create relay log
        const relayLog = await prisma.relayLog.create({
          data: {
            clientId: client.id,
            message: data.message,
            meta: data.meta || {},
            idempotencyKey,
            status: "PENDING",
          },
        });

        logger.info("Relay Log Created Successfully");

        try {
          await retryWithBackOff(async () => {
            const response = await axios.post(
              `${
                process.env.BASE_URL || "http://localhost:3000"
              }/mock-relay/receive`,
              {
                clientId: data.clientId,
                message: data.message,
                meta: data.meta,
                idempotencyKey,
              },
              {
                timeout: 5000,
              }
            );
            return response.data;
          });

          await prisma.relayLog.update({
            where: { id: relayLog.id },
            data: { status: "SENT", lastAttempt: new Date() },
          });

          logger.info("Relayed Successfully", {
            reqId: req.headers["x-req-id"],
            relayId: relayLog.id,
            clientId: data.clientId,
            action: "relay_sent",
          });

          return {
            message: "Message relayed successfully",
            relayId: relayLog.id,
            reqId: req.headers["x-req-id"],
          };
        } catch (error: any) {
          logger.error("Failed to Relay Message", {
            reqId: req.headers["x-req-id"],
            relayId: relayLog.id,
            error: error.message,
            action: "relay_failed",
          });

          await prisma.relayLog.update({
            where: { id: relayLog.id },
            data: { status: "FAILED", lastAttempt: new Date() },
          });

          res.code(502);
          return {
            error: "Failed to relay message",
            code: "RELAY_FAILED",
            relayId: relayLog.id,
            reqId: req.headers["x-req-id"],
          };
        }
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          logger.error("Invalid Req Data", {
            error: error.message,
          });
          res.code(400);
          return {
            error: "Invalid req data",
            details: error.issues,
            reqId: req.headers["x-req-id"],
          };
        }
        logger.error("Server ERror", {
          error: error,
        });
        res.code(500);
        return {
          error: "Internal server error",
          reqId: req.headers["x-req-id"],
        };
      }
    }
  );
}
