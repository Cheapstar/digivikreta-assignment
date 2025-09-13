import { FastifyInstance } from "fastify";
import z from "zod";
import { isDeviceActive, updateDeviceSnapShot } from "../../../lib/utils.js";
import { prisma } from "../../../db/client.js";
import { logger } from "../../../lib/logger.js";

const pingSchema = z.object({
  deviceId: z.string().min(1),
  metric: z.string().min(1),
  value: z.string(),
  status: z.enum(["OK", "ERROR", "DOWN", "WARN"]),
  ts: z.string(),
  eventId: z.string(),
});

export default async function TelemetryRoutes(server: FastifyInstance) {
  server.post(
    "/ping",
    {
      config: {
        rateLimit: {
          max: parseInt(process.env.RATE_LIMIT_TELEMETRY || "50", 10),
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
        const data = pingSchema.parse(req.body);
        logger.info("Processing telemetry ping", {
          deviceId: data.deviceId,
          eventId: data.eventId,
        });

        // check if the device is active
        const deviceActive = isDeviceActive(data.deviceId);
        if (!deviceActive) {
          logger.error("Rejected ping from inactive device", {
            deviceId: data.deviceId,
          });

          res.code(403);
          return {
            error: "Device is not active",
            code: "DEVICE_INACTIVE",
            requestId: req.headers["x-request-id"],
          };
        }

        const existingTelemetry = await prisma.telemetryRecord.findFirst({
          where: {
            eventId: data.eventId,
          },
        });

        if (existingTelemetry) {
          logger.info("Telemetry record already exist", {
            telemetryId: existingTelemetry.id,
          });

          return {
            message: "Telemetry already processed",
            telemetryId: existingTelemetry.id,
            requestId: req.headers["x-request-id"],
          };
        }

        const newTelemetry = await prisma.telemetryRecord.create({
          data: {
            deviceId: data.deviceId,
            metric: data.metric,
            value: data.value,
            status: data.status,
            ts: new Date(data.ts),
            eventId: data.eventId,
          },
        });

        logger.debug("Telemetry record created", {
          telemetryId: newTelemetry.id,
        });

        await updateDeviceSnapShot(data.deviceId);
        logger.debug("Device snapshot updated", {
          deviceId: data.deviceId,
          newStatus: data.status,
        });

        logger.info("Telemetry processed successfully");
        return {
          message: "Telemetry processed Successfully",
          telemetryId: newTelemetry.id,
          requestId: req.headers["x-request-id"],
        };
      } catch (error: any) {
        logger.error({
          requestId: req.headers["x-request-id"],
          error: error.message,
          action: "telemetry_error",
        });

        if (error instanceof z.ZodError) {
          logger.error("Invalid Request Data", { details: error.issues });
          res.code(400);
          return {
            error: "Invalid request data",
            details: error.issues,
            requestId: req.headers["x-request-id"],
          };
        }
        logger.error("Unexpected error processing telemetry", {
          error: error.message,
          stack: error.stack,
        });
        res.code(500);
        return {
          error: "Internal server error",
          requestId: req.headers["x-request-id"],
        };
      }
    }
  );
}
