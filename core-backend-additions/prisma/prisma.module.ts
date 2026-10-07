import { Module, Global } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * PrismaModule reference placeholder for core-backend-additions.
 * In paralearn-backend, the actual src/prisma/prisma.module.ts is used.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
