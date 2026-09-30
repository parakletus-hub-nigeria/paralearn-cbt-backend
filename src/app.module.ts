import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { ExamsModule } from "./exams/exams.module";
import { QuestionsModule } from "./questions/questions.module";
import { AttemptsModule } from "./attempts/attempts.module";
import { SyncModule } from "./sync/sync.module";
import { CandidatesModule } from "./candidates/candidates.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
    }),
    PrismaModule,
    RedisModule,
    WorkspacesModule,
    ExamsModule,
    QuestionsModule,
    CandidatesModule,
    AttemptsModule,
    SyncModule,
  ],
})
export class AppModule {}
