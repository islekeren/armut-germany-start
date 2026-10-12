import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { isUUID } from "class-validator";

type CorrelatedRequest = Request & { requestId?: string };

/** Only registered route metadata is eligible for logging, never request URLs. */
export function httpObservability(
  req: CorrelatedRequest,
  res: Response,
  next: NextFunction,
) {
  const supplied = req.headers["x-request-id"];
  const requestId =
    typeof supplied === "string" && isUUID(supplied) ? supplied : randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  const started = performance.now();
  res.once("finish", () => {
    console.log(
      JSON.stringify({
        event: "http_request",
        requestId,
        method: [
          "GET",
          "POST",
          "PUT",
          "PATCH",
          "DELETE",
          "OPTIONS",
          "HEAD",
        ].includes(req.method)
          ? req.method
          : "OTHER",
        route:
          typeof req.route?.path === "string" ? req.route.path : "unmatched",
        status: res.statusCode,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
      }),
    );
  });
  next();
}

/** Deliberate HTTP responses retain their contract; unexpected errors stay private. */
@Catch()
export class SafeHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: 500, message: "Internal server error" };
    response
      .status(status)
      .json(
        typeof body === "string" ? { statusCode: status, message: body } : body,
      );
  }
}
