import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("PrismaService");

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("Connected to CBT autonomous PostgreSQL database.");
    } catch (err) {
      this.logger.warn(`Could not connect to PostgreSQL immediately: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
