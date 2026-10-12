import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CbtAccessGuard } from "./cbt-access.guard";
import { CbtAccessService } from "./cbt-access.service";

@Global()
@Module({
  providers: [CbtAccessService, { provide: APP_GUARD, useClass: CbtAccessGuard }],
  exports: [CbtAccessService],
})
export class AccessModule {}
