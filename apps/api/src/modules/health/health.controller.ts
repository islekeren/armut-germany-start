import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PrismaService } from "../../common/prisma/prisma.service";
import { ClientErrorDto } from "./client-error.dto";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  async ready() {
    const candidate =
      process.env.RAILWAY_GIT_COMMIT_SHA || process.env.APP_COMMIT_SHA;
    const commit =
      candidate && /^[a-f0-9]{40}$/i.test(candidate)
        ? candidate.toLowerCase()
        : "unknown";
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error("readiness_timeout")),
            1000,
          );
        }),
      ]);
      return { status: "ready", checks: { database: "up" }, commit };
    } catch {
      throw new ServiceUnavailableException({
        status: "unavailable",
        checks: { database: "down" },
        commit,
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  @Post("client-error")
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  reportClientError(@Body() report: ClientErrorDto) {
    // Construct the allowlist explicitly rather than spreading client input.
    console.log(
      JSON.stringify({
        event: "client_error",
        operation: report.operation,
        code: report.code,
        ...(report.status === undefined ? {} : { status: report.status }),
        ...(report.requestId === undefined
          ? {}
          : { requestId: report.requestId }),
      }),
    );
  }
}
