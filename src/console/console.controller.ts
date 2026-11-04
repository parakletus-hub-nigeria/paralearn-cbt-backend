import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "../access/public.decorator";
import { ConsoleTokenGuard } from "./console-token.guard";
import { ConsoleService } from "./console.service";
import { ConsoleWorkspaceActionsService } from "./console-workspace-actions.service";
import { DeleteWorkspaceDto } from "./dto/delete-workspace.dto";

const WORKSPACE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** The signed-in console admin, sent by the console; written to the log. */
function actorName(raw?: string): string {
  const name = (raw ?? "").replace(/[^\w.@ -]/g, "").trim().slice(0, 64);
  return name || "unknown";
}

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
 * API for the Parakletus admin console: reads plus audited workspace deletion. @Public() skips the global
 * CbtAccessGuard (so neither the shared service key nor workspace keys work
 * here); ConsoleTokenGuard then requires the x-console-token header.
 */
@ApiExcludeController()
@Public()
@Controller("console")
@UseGuards(ConsoleTokenGuard)
export class ConsoleController {
  constructor(
    private readonly consoleService: ConsoleService,
    private readonly workspaceActions: ConsoleWorkspaceActionsService,
  ) {}

  @Get("summary")
  summary() {
    return this.consoleService.summary();
  }

  @Get("workspaces")
  workspaces(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.consoleService.workspaces(clampInt(page, 1, 1, 10_000), clampInt(limit, 25, 1, 50));
  }

  /** Permanently delete a workspace and everything in it. { confirm } must equal its name. */
  @Post("workspaces/:id/delete")
  @HttpCode(200)
  deleteWorkspace(@Param("id") id: string, @Body() body: DeleteWorkspaceDto, @Headers("x-console-actor") actor?: string) {
    if (!WORKSPACE_ID.test(id)) throw new BadRequestException("Invalid workspace id");
    return this.workspaceActions.delete(id, body.confirm, actorName(actor));
  }
}
