import { Module } from "@nestjs/common";
import { ConsoleController, HealthController } from "./console.controller";
import { ConsoleService } from "./console.service";
import { ConsoleTokenGuard } from "./console-token.guard";
import { ConsoleWorkspaceActionsService } from "./console-workspace-actions.service";

/** Health check plus the read-only API for the Parakletus admin console. */
@Module({
  controllers: [HealthController, ConsoleController],
  providers: [ConsoleService, ConsoleWorkspaceActionsService, ConsoleTokenGuard],
})
export class ConsoleModule {}
