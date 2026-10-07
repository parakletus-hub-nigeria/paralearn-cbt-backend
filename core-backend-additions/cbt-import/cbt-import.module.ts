import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CbtImportController } from "./cbt-import.controller";
import { CbtImportService } from "./cbt-import.service";

@Module({
  imports: [PrismaModule],
  controllers: [CbtImportController],
  providers: [CbtImportService],
})
export class CbtImportModule {}
