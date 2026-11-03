import { Injectable } from "@nestjs/common";
import { AttemptStatus, WorkspaceType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Read-only, platform-wide numbers for the Parakletus admin console.
 * Never returns workspace API keys, webhook secrets, candidate PINs or answers.
 */
@Injectable()
export class ConsoleService {
  constructor(private readonly prisma: PrismaService) {}

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async summary() {
    const now = new Date();
    const since24h = new Date(now.getTime() - DAY_MS);
    const since30d = new Date(now.getTime() - 30 * DAY_MS);
    const liveExam = {
      isPublished: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    };

    const [
      institutions,
      standalone,
      exams,
      publishedExams,
      liveExams,
      questions,
      candidates,
      inProgress,
      submitted24h,
      disqualified30d,
    ] = await Promise.all([
      this.prisma.cbtWorkspace.count({ where: { type: WorkspaceType.INSTITUTION } }),
      this.prisma.cbtWorkspace.count({ where: { type: WorkspaceType.STANDALONE_HALL } }),
      this.prisma.exam.count(),
      this.prisma.exam.count({ where: { isPublished: true } }),
      this.prisma.exam.count({ where: liveExam }),
      this.prisma.question.count(),
      this.prisma.candidate.count(),
      this.prisma.examAttempt.count({ where: { status: AttemptStatus.IN_PROGRESS } }),
      this.prisma.examAttempt.count({ where: { status: AttemptStatus.SUBMITTED, submittedAt: { gte: since24h } } }),
      this.prisma.examAttempt.count({ where: { status: AttemptStatus.DISQUALIFIED, createdAt: { gte: since30d } } }),
    ]);

    return {
      workspaces: { total: institutions + standalone, institutions, standalone },
      exams: { total: exams, published: publishedExams, liveNow: liveExams },
      questions,
      candidates,
      attempts: { inProgress, submitted24h, disqualified30d },
      generatedAt: now.toISOString(),
    };
  }

  async workspaces(page: number, limit: number) {
    const [rows, total] = await Promise.all([
      this.prisma.cbtWorkspace.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          ownerName: true,
          credits: true,
          createdAt: true,
          _count: { select: { exams: true, questions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cbtWorkspace.count(),
    ]);
    const workspaces = rows.map(({ _count, ...w }) => ({ ...w, exams: _count.exams, questions: _count.questions }));
    return { workspaces, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
