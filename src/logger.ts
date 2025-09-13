"use strict";
import winston from "winston";

const logLevel = "info";

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const message =
        typeof info.message === "object"
          ? JSON.stringify(info.message, null, 2)
          : info.message;
      return `${info.timestamp} - ${info.level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});
