import { FastifyInstance } from "fastify";
import z from "zod";
import { updateDeviceSnapShot } from "../../../lib/utils.js";
import axios from "axios";
import { prisma } from "../../../db/client.js";
import { logger } from "../../../lib/logger.js";
const subscriptionSchema = z.object({
  deviceId: z.string().min(1),
  planId: z.string().min(1),
});

export default function BillingRoutes(server: FastifyInstance) {
  server.post("/subscribe", async (req, res) => {
    try {
      const data = subscriptionSchema.parse(req.body);
      logger.info("Processing subscribe rewuest", {
        deviceId: data.deviceId,
        planId: data.planId,
      });

      let providerRef = null;

      try {
        const response = await axios.post(
          `${process.env.BASE_URL || "http://localhost:3000"}/mock-pay/charge`,
          {
            deviceId: data.deviceId,
            planId: data.planId,
            amount: 99.99,
          }
        );

        logger.info("Payment Processed Successfully", {
          ...response.data,
        });

        providerRef = response.data.transactionId;
      } catch (error: any) {
        logger.error("Payment Failed", {
          deviceId: data.deviceId,
          planId: data.planId,
          error: error.message,
        });

        res.code(402);
        return {
          error: "Payment processing failed",
          code: "PAYMENT_FAILED",
          requestId: req.headers["x-req-id"],
        };
      }

      // create subscription
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

      const subscription = await prisma.subscription.create({
        data: {
          deviceId: data.deviceId,
          planId: data.planId,
          startDate,
          endDate,
          status: "ACTIVE",
          providerRef: providerRef,
        },
      });

      // update device status to active
      updateDeviceSnapShot(data.deviceId);

      logger.info({
        requestId: req.headers["x-req-id"],
        deviceId: data.deviceId,
        subscriptionId: subscription.id,
        action: "subscription_created",
      });

      logger.info("Subscription Process Successfully Done!!", {
        deviceId: data.deviceId,
        planId: data.planId,
      });
      return {
        message: "Subscription created successfully",
        subscriptionId: subscription.id,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        requestId: req.headers["x-req-id"],
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logger.error("Invalid Request Data", {
          requestId: req.headers["x-req-id"],
          error: error.issues,
          action: "subscription_error",
        });
        res.code(400);
        return {
          error: "Invalid req data",
          details: error.issues,
          requestId: req.headers["x-req-id"],
        };
      }

      logger.error("Subscription Process Failed", {
        requestId: req.headers["x-req-id"],
        error: error.message,
        action: "subscription_error",
      });
      res.code(500);
      return {
        error: "Internal server error",
        requestId: req.headers["x-req-id"],
      };
    }
  });
}
