import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CbtCaller } from "./caller.decorator";

/**
 * Scopes API-key callers to their own workspace. Service callers are trusted:
 * the web app has already checked the examiner's ownership.
 */
@Injectable()
export class CbtAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** The workspace to act on; API-key callers can only name their own */
  workspaceFor(caller: CbtCaller, requested?: string | null): string {
    if (caller.kind === "service") {
      if (!requested) throw new ForbiddenException("workspaceId is required.");
      return requested;
    }
    if (requested && requested !== caller.workspaceId) {
      throw new ForbiddenException("This API key cannot access that workspace.");
    }
    return caller.workspaceId;
  }

  async assertExam(caller: CbtCaller, examId: string): Promise<void> {
    if (caller.kind === "service") return;
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { workspaceId: true },
    });
    if (!exam || exam.workspaceId !== caller.workspaceId) {
      throw new NotFoundException(`Exam ${examId} not found.`);
    }
  }

  async assertQuestion(caller: CbtCaller, questionId: string): Promise<void> {
    if (caller.kind === "service") return;
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { workspaceId: true },
    });
    if (!question || question.workspaceId !== caller.workspaceId) {
      throw new NotFoundException(`Question ${questionId} not found.`);
    }
  }

  async assertAttempt(caller: CbtCaller, attemptId: string): Promise<void> {
    if (caller.kind === "service") return;
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { exam: { select: { workspaceId: true } } },
    });
    if (!attempt || attempt.exam.workspaceId !== caller.workspaceId) {
      throw new NotFoundException(`Attempt ${attemptId} not found.`);
    }
  }

  async assertCandidate(caller: CbtCaller, candidateId: string): Promise<void> {
    if (caller.kind === "service") return;
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { exam: { select: { workspaceId: true } } },
    });
    if (!candidate || candidate.exam.workspaceId !== caller.workspaceId) {
      throw new NotFoundException(`Candidate ${candidateId} not found.`);
    }
  }

  /** Internal-only routes (workspace provisioning) */
  assertService(caller: CbtCaller): void {
    if (caller.kind !== "service") {
      throw new ForbiddenException("This endpoint is internal to ParaLearn.");
    }
  }
}
