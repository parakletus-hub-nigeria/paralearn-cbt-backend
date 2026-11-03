import { Module } from "@nestjs/common";
import { ConsoleController, HealthController } from "./console.controller";
import { ConsoleService } from "./console.service";
import { ConsoleTokenGuard } from "./console-token.guard";

/** Health check plus the read-only API for the Parakletus admin console. */
@Module({
  controllers: [HealthController, ConsoleController],
  providers: [ConsoleService, ConsoleTokenGuard],
})
export class ConsoleModule {}
