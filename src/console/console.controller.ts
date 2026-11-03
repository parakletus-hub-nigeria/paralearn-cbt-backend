import { Controller, Get, Query, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "../access/public.decorator";
import { ConsoleTokenGuard } from "./console-token.guard";
import { ConsoleService } from "./console.service";

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

/** Unauthenticated liveness check (the service had none). Pings the database. */
@Controller("health")
export class HealthController {
  constructor(private readonly consoleService: ConsoleService) {}

  @Public()
  @Get()
  async health() {
    try {
      await this.consoleService.ping();
    } catch {
      throw new ServiceUnavailableException({ status: "error", database: "unreachable" });
    }
    return { status: "ok", database: "ok", timestamp: new Date().toISOString() };
  }
}

/**
 * Read-only API for the Parakletus admin console. @Public() skips the global
 * CbtAccessGuard (so neither the shared service key nor workspace keys work
 * here); ConsoleTokenGuard then requires the x-console-token header.
 */
@ApiExcludeController()
@Public()
@Controller("console")
@UseGuards(ConsoleTokenGuard)
export class ConsoleController {
  constructor(private readonly consoleService: ConsoleService) {}

  @Get("summary")
  summary() {
    return this.consoleService.summary();
  }

  @Get("workspaces")
  workspaces(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.consoleService.workspaces(clampInt(page, 1, 1, 10_000), clampInt(limit, 25, 1, 50));
  }
}
