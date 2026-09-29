import { Module } from "@nestjs/common";
import { AttemptsService } from "./attempts.service";
import { AttemptsController } from "./attempts.controller";
import { PrismaModule } from "@/prisma/prisma.module";
import { RedisModule } from "@/redis/redis.module";
import { WorkspacesModule } from "@/workspaces/workspaces.module";

@Module({
  imports: [PrismaModule, RedisModule, WorkspacesModule],
  controllers: [AttemptsController],
  providers: [AttemptsService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
