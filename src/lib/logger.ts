"use strict";
import winston from "winston";

const logLevel = "info";

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
      let log = `${timestamp} [${level}]: ${message}`;
      if (stack) log += `\n${stack}`;
      if (Object.keys(meta).length > 0)
        log += ` ${JSON.stringify(meta, null, 2)}`;
      return log;
    })
  ),
  transports: [new winston.transports.Console()],
});
