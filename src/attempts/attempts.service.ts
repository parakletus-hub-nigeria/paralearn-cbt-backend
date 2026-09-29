import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { RedisService } from "@/redis/redis.service";
import { WorkspacesService } from "@/workspaces/workspaces.service";
import {
  StartAttemptDto,
  BufferAnswerDto,
  RecordTelemetryDto,
  SubmitAttemptDto,
} from "./dto/attempt.dto";
import * as crypto from "crypto";

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly workspacesService: WorkspacesService
  ) {}

  private calculateGrade(percentage: number): string {
    if (percentage >= 75) return "A1";
    if (percentage >= 70) return "B2";
    if (percentage >= 65) return "B3";
    if (percentage >= 60) return "C4";
    if (percentage >= 55) return "C5";
    if (percentage >= 50) return "C6";
    if (percentage >= 45) return "D7";
    if (percentage >= 40) return "E8";
    return "F9";
  }

  private shuffleArray<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Phase 4.1: Candidate Session Launch & Credit Validation
   */
  async startAttempt(dto: StartAttemptDto) {
    const normalizedCode = dto.accessCode.trim().toUpperCase();
    const pin = dto.candidatePin.trim();

    // 1. Verify exam existence & publication status
    const exam = await this.prisma.exam.findUnique({
      where: { accessCode: normalizedCode },
      include: {
        workspace: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          include: { question: true },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Examination with room code "${normalizedCode}" was not found.`);
    }

    if (!exam.isPublished) {
      throw new BadRequestException("This examination is not currently active or published.");
    }

    // 2. Check timing window if scheduled
    const now = new Date();
    if (exam.startsAt && now < exam.startsAt) {
      throw new BadRequestException(`This exam has not started yet. Opens at ${exam.startsAt.toISOString()}.`);
    }
    if (exam.endsAt && now > exam.endsAt) {
      throw new BadRequestException("This exam session has officially closed.");
    }

    // 3. Check for existing attempt with this PIN
    const existingAttempt = await this.prisma.examAttempt.findUnique({
      where: {
        unique_exam_candidate_attempt: {
          examId: exam.id,
          candidatePin: pin,
        },
      },
    });

    if (existingAttempt) {
      if (existingAttempt.status === "SUBMITTED") {
        throw new BadRequestException("This candidate PIN has already completed and submitted this examination.");
      }
      if (existingAttempt.status === "DISQUALIFIED") {
        throw new ForbiddenException("Candidate has been disqualified from this examination due to security violations.");
      }

      // Session resumption: calculate remaining time from Redis
      const remainingSeconds = await this.redis.getRemainingSeconds(existingAttempt.id);
      const bufferedAnswers = await this.redis.getBufferedAnswers(existingAttempt.id);
      const violations = await this.redis.getViolations(existingAttempt.id);

      // Sanitize questions
      const sanitized = this.formatQuestionsForCandidate(exam.questions.map((q) => q.question), exam);

      return {
        isResumed: true,
        attemptId: existingAttempt.id,
        examId: exam.id,
        examTitle: exam.title,
        candidateName: existingAttempt.candidateName,
        candidatePin: existingAttempt.candidatePin,
        durationMins: exam.durationMins,
        deadline: existingAttempt.deadline,
        remainingSeconds,
        violations,
        maxTabViolations: exam.maxTabViolations,
        questions: sanitized,
        restoredAnswers: bufferedAnswers,
      };
    }

    // 4. Standalone hall credit check & deduction
    await this.workspacesService.deductCredit(exam.workspaceId, 1);

    // 5. Initialize fresh attempt
    const deadline = new Date(now.getTime() + exam.durationMins * 60 * 1000);
    const newAttempt = await this.prisma.examAttempt.create({
      data: {
        examId: exam.id,
        candidateName: dto.candidateName.trim(),
        candidatePin: pin,
        studentId: dto.studentId,
        startedAt: now,
        deadline,
        status: "IN_PROGRESS",
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      },
    });

    // 6. Initialize sub-millisecond Redis timer
    const timer = await this.redis.startTimer(newAttempt.id, exam.durationMins);

    // 7. Sanitize & deliver questions
    const sanitized = this.formatQuestionsForCandidate(exam.questions.map((q) => q.question), exam);

    return {
      isResumed: false,
      attemptId: newAttempt.id,
      examId: exam.id,
      examTitle: exam.title,
      candidateName: newAttempt.candidateName,
      candidatePin: newAttempt.candidatePin,
      durationMins: exam.durationMins,
      deadline: timer.deadline,
      remainingSeconds: timer.remainingSecs,
      violations: 0,
      maxTabViolations: exam.maxTabViolations,
      questions: sanitized,
      restoredAnswers: {},
    };
  }

  /**
   * Securely strips correct answers and applies shuffling policies
   */
  private formatQuestionsForCandidate(rawQuestions: any[], exam: any) {
    let list = [...rawQuestions];
    if (exam.shuffleQuestions) {
      list = this.shuffleArray(list);
    }

    return list.map((q) => {
      let options = Array.isArray(q.options) ? [...q.options] : [];
      if (exam.shuffleChoices) {
        options = this.shuffleArray(options);
      }

      // SECURITY CRITICAL: Strip isCorrect and explanation
      const sanitizedOptions = options.map((opt: any) => ({
        id: opt.id,
        text: opt.text,
        keyLabel: opt.keyLabel,
      }));

      return {
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        marks: q.marks,
        options: sanitizedOptions,
      };
    });
  }

  /**
   * Phase 4.2: Ephemeral Answer Buffering (Zero-DB writes during live test)
   */
  async bufferAnswer(attemptId: string, dto: BufferAnswerDto) {
    const remaining = await this.redis.getRemainingSeconds(attemptId);
    if (remaining <= 0) {
      // Check attempt status in DB to ensure it wasn't already marked
      const attempt = await this.prisma.examAttempt.findUnique({ where: { id: attemptId } });
      if (attempt?.status === "SUBMITTED") {
        throw new BadRequestException("Examination has already been submitted.");
      }
    }

    await this.redis.bufferAnswer(attemptId, dto.questionId, dto.selectedVal);
    return { success: true, savedAt: new Date().toISOString() };
  }

  /**
   * Phase 4.3: Proctoring Telemetry & Anti-Cheat Heartbeat
   */
  async recordTelemetry(attemptId: string, dto: RecordTelemetryDto) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });

    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found.`);
    if (attempt.status !== "IN_PROGRESS") {
      return { status: attempt.status, disqualified: attempt.status === "DISQUALIFIED" };
    }

    const currentViolations = await this.redis.incrementViolations(attemptId);
    const maxAllowed = attempt.exam.maxTabViolations;

    // Check if threshold exceeded
    if (maxAllowed > 0 && currentViolations >= maxAllowed) {
      await this.prisma.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: "DISQUALIFIED",
          violations: currentViolations,
          antiCheatLogs: {
            push: {
              type: dto.eventType,
              timestamp: dto.timestamp || new Date().toISOString(),
              questionIdx: dto.questionIdx,
              violationCount: currentViolations,
              outcome: "DISQUALIFIED",
            },
          } as any,
        },
      });

      return {
        disqualified: true,
        violations: currentViolations,
        message: "Maximum tab switch limit reached. You have been disqualified from this session.",
      };
    }

    return {
      disqualified: false,
      violations: currentViolations,
      remainingViolations: Math.max(0, maxAllowed - currentViolations),
    };
  }

  /**
   * Phase 4.4: Atomic Submission & Deterministic Auto-Grading Engine
   */
  async submitAttempt(attemptId: string, dto: SubmitAttemptDto) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            workspace: true,
            questions: {
              include: { question: true },
            },
          },
        },
      },
    });

    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found.`);

    if (attempt.status === "SUBMITTED") {
      return this.getCandidateResultSlip(attemptId);
    }

    // 1. Gather all candidate answers: merge Redis buffer with client fallback
    const buffered = await this.redis.getBufferedAnswers(attemptId);
    const allAnswers: Record<string, any> = { ...buffered, ...(dto.finalAnswers || {}) };
    const violations = await this.redis.getViolations(attemptId);

    // 2. Deterministic Grading
    let totalMarks = 0;
    let earnedMarks = 0;
    const answerRecordsToCreate: any[] = [];

    for (const eq of attempt.exam.questions) {
      const q = eq.question;
      totalMarks += q.marks;

      const candidateSubmission = allAnswers[q.id];
      let isCorrect = false;
      let marksAwarded = 0;

      if (candidateSubmission) {
        let chosenOptId: string | null = null;
        if (typeof candidateSubmission === "string") {
          chosenOptId = candidateSubmission;
        } else if (typeof candidateSubmission === "object") {
          chosenOptId = candidateSubmission.selected || candidateSubmission.id || null;
        }

        const rawOptions = (Array.isArray(q.options) ? q.options : []) as any[];

        if (q.type === "MCQ" || q.type === "TRUE_FALSE") {
          const correctOption = rawOptions.find((opt) => opt.isCorrect === true);
          if (
            correctOption &&
            chosenOptId &&
            (correctOption.id === chosenOptId ||
              (correctOption.keyLabel && correctOption.keyLabel.toUpperCase() === String(chosenOptId).toUpperCase()))
          ) {
            isCorrect = true;
            marksAwarded = q.marks;
          }
        } else if (q.type === "MULTI_SELECT") {
          const correctIds = rawOptions.filter((opt) => opt.isCorrect === true).map((opt) => opt.id);
          const chosenIds = Array.isArray(candidateSubmission.selected)
            ? candidateSubmission.selected
            : [chosenOptId];

          const isMatch =
            correctIds.length === chosenIds.length &&
            correctIds.every((id: string) => chosenIds.includes(id));

          if (isMatch) {
            isCorrect = true;
            marksAwarded = q.marks;
          }
        }
      }

      earnedMarks += marksAwarded;

      answerRecordsToCreate.push({
        attemptId: attempt.id,
        questionId: q.id,
        selectedVal: candidateSubmission ? { selected: candidateSubmission } : {},
        isCorrect,
        marksAwarded,
      });
    }

    const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100 * 10) / 10 : 0;
    const grade = this.calculateGrade(percentage);

    // 3. Atomic Database Commit
    await this.prisma.$transaction(async (tx) => {
      // Upsert answers
      for (const ans of answerRecordsToCreate) {
        await tx.attemptAnswer.upsert({
          where: {
            attemptId_questionId: {
              attemptId: ans.attemptId,
              questionId: ans.questionId,
            },
          },
          update: {
            selectedVal: ans.selectedVal,
            isCorrect: ans.isCorrect,
            marksAwarded: ans.marksAwarded,
          },
          create: ans,
        });
      }

      // Update attempt status
      await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          score: earnedMarks,
          totalMarks,
          percentage,
          grade,
          violations,
        },
      });
    });

    const resultSlip = await this.getCandidateResultSlip(attemptId);

    // Asynchronous webhook dispatch for external developer integrations
    if (attempt.exam?.workspace?.webhookUrl) {
      this.dispatchWebhook(attempt.exam.workspace, {
        event: "exam.attempt.completed",
        timestamp: new Date().toISOString(),
        attemptId,
        examId: attempt.examId,
        studentId: attempt.studentId,
        candidateName: attempt.candidateName,
        candidatePin: attempt.candidatePin,
        score: earnedMarks,
        totalMarks,
        percentage,
        grade,
        resultSlip,
      }).catch(() => {});
    }

    return resultSlip;
  }

  private async dispatchWebhook(workspace: any, payload: any) {
    if (!workspace.webhookUrl) return;
    try {
      const bodyStr = JSON.stringify(payload);
      const signature = workspace.webhookSecret
        ? crypto.createHmac("sha256", workspace.webhookSecret).update(bodyStr).digest("hex")
        : "";

      await fetch(workspace.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cbt-signature": signature ? `sha256=${signature}` : "",
          "x-cbt-event": payload.event,
        },
        body: bodyStr,
      });
    } catch {
      // Non-blocking catch
    }
  }

  /**
   * Phase 4.5: Candidate Result Slip Generation
   */
  async getCandidateResultSlip(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          select: {
            title: true,
            accessCode: true,
            durationMins: true,
            showResultAfter: true,
            workspace: { select: { name: true } },
          },
        },
        answers: {
          include: {
            attempt: false,
          },
        },
      },
    });

    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found.`);

    const durationSpentMins = attempt.submittedAt
      ? Math.max(1, Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 60000))
      : attempt.exam.durationMins;

    const totalQuestions = attempt.answers.length;
    const correctCount = attempt.answers.filter((a) => a.isCorrect === true).length;
    const wrongCount = attempt.answers.filter((a) => a.isCorrect === false && a.selectedVal && Object.keys(a.selectedVal as any).length > 0).length;
    const unattemptedCount = Math.max(0, totalQuestions - (correctCount + wrongCount));

    return {
      attemptId: attempt.id,
      candidateName: attempt.candidateName,
      candidatePin: attempt.candidatePin,
      studentId: attempt.studentId,
      examTitle: attempt.exam.title,
      accessCode: attempt.exam.accessCode,
      institutionName: attempt.exam.workspace.name,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      timeSpentMins: durationSpentMins,
      score: attempt.score ?? 0,
      totalMarks: attempt.totalMarks ?? 0,
      percentage: attempt.percentage ?? 0,
      grade: attempt.grade ?? "F9",
      violations: attempt.violations,
      status: attempt.status,
      showResultAfter: attempt.exam.showResultAfter,
      breakdown: {
        totalQuestions,
        correctCount,
        wrongCount,
        unattemptedCount,
      },
    };
  }
}
