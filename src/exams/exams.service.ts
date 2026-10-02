import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { CreateExamDto, UpdateExamDto, AttachQuestionsDto } from "./dto/create-exam.dto";

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a collision-resistant human-readable room code like "JAMB-7K82" or "MOCK-9X4F"
   */
  private generateAccessCode(titlePrefix: string = "EXAM"): string {
    const cleanPrefix = titlePrefix
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 4)
      .toUpperCase() || "TEST";
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let randomPart = "";
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${cleanPrefix}-${randomPart}`;
  }

  async createExam(dto: CreateExamDto) {
    const workspace = await this.prisma.cbtWorkspace.findUnique({
      where: { id: dto.workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException(`Workspace ${dto.workspaceId} does not exist`);
    }

    let accessCode = dto.accessCode?.trim().toUpperCase();
    if (accessCode) {
      const existing = await this.prisma.exam.findUnique({ where: { accessCode } });
      if (existing) {
        throw new ConflictException(`Access code "${accessCode}" is already in use.`);
      }
    } else {
      let attempts = 0;
      while (!accessCode && attempts < 5) {
        const candidate = this.generateAccessCode(dto.title);
        const existing = await this.prisma.exam.findUnique({ where: { accessCode: candidate } });
        if (!existing) accessCode = candidate;
        attempts++;
      }
      if (!accessCode) {
        accessCode = `CBT-${Date.now().toString(36).toUpperCase()}`;
      }
    }

    return this.prisma.exam.create({
      data: {
        workspaceId: dto.workspaceId,
        title: dto.title,
        instructions: dto.instructions ?? "Answer all questions. The test will automatically submit when time expires.",
        durationMins: dto.durationMins ?? 60,
        accessType: dto.accessType ?? "ACCESS_CODE",
        accessCode,
        maxTabViolations: dto.maxTabViolations ?? 3,
        shuffleQuestions: dto.shuffleQuestions ?? true,
        shuffleChoices: dto.shuffleChoices ?? true,
        showResultAfter: dto.showResultAfter ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
  }

  async findWorkspaceExams(workspaceId: string) {
    return this.prisma.exam.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { questions: true, attempts: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findExamById(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        workspace: {
          select: { id: true, name: true, type: true },
        },
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            question: true,
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
    });

    if (!exam) throw new NotFoundException(`Exam ${id} not found.`);
    return exam;
  }

  /**
   * Candidate Lobby Lookup: Strips out correct answers for security
   */
  async findExamByAccessCode(accessCode: string) {
    const normalizedCode = accessCode.trim().toUpperCase();
    const exam = await this.prisma.exam.findUnique({
      where: { accessCode: normalizedCode },
      include: {
        workspace: {
          select: { id: true, name: true },
        },
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with code "${normalizedCode}" not found.`);
    }

    if (!exam.isPublished) {
      throw new BadRequestException("This examination is not yet open or published by the administrator.");
    }

    // Return sanitized public candidate view
    return {
      id: exam.id,
      accessCode: exam.accessCode,
      title: exam.title,
      instructions: exam.instructions,
      accessType: exam.accessType,
      durationMins: exam.durationMins,
      totalQuestions: exam._count.questions,
      totalMarks: exam.totalMarks,
      maxTabViolations: exam.maxTabViolations,
      workspaceName: exam.workspace.name,
      startsAt: exam.startsAt,
      endsAt: exam.endsAt,
    };
  }

  async updateExam(id: string, dto: UpdateExamDto) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException(`Exam ${id} not found.`);

    return this.prisma.exam.update({
      where: { id },
      data: dto,
    });
  }

  async deleteExam(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: { _count: { select: { attempts: true } } },
    });
    if (!exam) throw new NotFoundException(`Exam ${id} not found.`);

    if (exam._count.attempts > 0) {
      throw new BadRequestException("Cannot delete exam with existing candidate submissions. Archive or unpublish instead.");
    }

    return this.prisma.exam.delete({ where: { id } });
  }

  async attachQuestions(examId: string, dto: AttachQuestionsDto) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException(`Exam ${examId} not found.`);

    // Delete existing question mappings and replace
    await this.prisma.examQuestion.deleteMany({
      where: { examId },
    });

    if (dto.questionIds.length > 0) {
      // Create new links
      await this.prisma.examQuestion.createMany({
        data: dto.questionIds.map((qId, idx) => ({
          examId,
          questionId: qId,
          orderIndex: idx,
        })),
      });

      // Recalculate total marks
      const questions = await this.prisma.question.findMany({
        where: { id: { in: dto.questionIds } },
        select: { marks: true },
      });
      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

      await this.prisma.exam.update({
        where: { id: examId },
        data: { totalMarks },
      });
    } else {
      await this.prisma.exam.update({
        where: { id: examId },
        data: { totalMarks: 0 },
      });
    }

    return this.findExamById(examId);
  }

  /**
   * Live Invigilation Board Monitoring
   */
  async getLiveMonitorStats(examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        _count: { select: { questions: true } },
        attempts: {
          select: {
            id: true,
            candidateName: true,
            candidatePin: true,
            studentId: true,
            status: true,
            violations: true,
            startedAt: true,
            submittedAt: true,
            score: true,
            percentage: true,
            grade: true,
            ipAddress: true,
          },
          orderBy: { startedAt: "desc" },
        },
        candidates: {
          select: {
            id: true,
            candidateName: true,
            candidatePin: true,
            studentId: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!exam) throw new NotFoundException(`Exam ${examId} not found.`);

    const totalRegistered = exam.candidates.length;
    const totalEnrolled = Math.max(totalRegistered, exam.attempts.length);
    const inProgress = exam.attempts.filter((a) => a.status === "IN_PROGRESS").length;
    const submitted = exam.attempts.filter((a) => a.status === "SUBMITTED").length;
    const disqualified = exam.attempts.filter((a) => a.status === "DISQUALIFIED").length;
    const notStarted = Math.max(0, totalRegistered - exam.attempts.length);

    const submittedScores = exam.attempts
      .filter((a) => a.status === "SUBMITTED" && a.percentage !== null)
      .map((a) => a.percentage as number);

    const averageScore = submittedScores.length > 0
      ? Math.round(submittedScores.reduce((sum, val) => sum + val, 0) / submittedScores.length)
      : 0;

    return {
      exam: {
        id: exam.id,
        title: exam.title,
        accessCode: exam.accessCode,
        durationMins: exam.durationMins,
        isPublished: exam.isPublished,
        totalQuestions: exam._count.questions,
        totalMarks: exam.totalMarks,
        accessType: exam.accessType,
      },
      metrics: {
        totalRegistered,
        totalEnrolled,
        notStarted,
        inProgress,
        submitted,
        disqualified,
        averageScore,
      },
      roster: exam.candidates,
      candidates: exam.attempts,
    };
  }
}
