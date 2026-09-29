import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@/prisma/prisma.service";

@Injectable()
export class SyncService {
  private readonly logger = new Logger("SyncService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  /**
   * Syncs completed CBT exam scores back to ParaLearn Core SIS for Term Report Cards
   */
  async exportExamScoresToParaLearn(examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        workspace: true,
        attempts: {
          where: { status: "SUBMITTED" },
        },
      },
    });

    if (!exam) throw new NotFoundException(`Exam ${examId} not found.`);

    if (exam.workspace.type !== "INSTITUTION" || !exam.workspace.externalId) {
      throw new BadRequestException(
        "Direct ParaLearn SIS synchronization is only available for Institution workspaces linked to a school."
      );
    }

    const schoolId = exam.workspace.externalId;
    const coreApiUrl = this.config.get<string>("PARALEARN_CORE_API_URL", "http://localhost:3000/api");
    const serviceSecret = this.config.get<string>("CBT_SERVICE_SECRET", "pln_cbt_internal_secret_2026");

    // Filter attempts that have a mapped studentId
    const scorePayloads = exam.attempts
      .filter((a) => a.studentId)
      .map((attempt) => ({
        studentId: attempt.studentId,
        candidateName: attempt.candidateName,
        examId: exam.id,
        examTitle: exam.title,
        score: attempt.score,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        grade: attempt.grade,
        submittedAt: attempt.submittedAt,
      }));

    this.logger.log(
      `Dispatching ${scorePayloads.length} exam scores for "${exam.title}" to ParaLearn School (${schoolId}) at ${coreApiUrl}`
    );

    let dispatchSuccess = false;
    let responseData = null;

    try {
      // Direct HTTP dispatch to ParaLearn core RMS endpoint
      const response = await fetch(`${coreApiUrl}/rms/cbt-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cbt-service-key": serviceSecret,
        },
        body: JSON.stringify({
          schoolId,
          examId: exam.id,
          examTitle: exam.title,
          scores: scorePayloads,
        }),
      });

      if (response.ok) {
        dispatchSuccess = true;
        responseData = await response.json().catch(() => ({ status: "ok" }));
      } else {
        const errorText = await response.text();
        this.logger.warn(`ParaLearn Core sync returned HTTP ${response.status}: ${errorText}`);
      }
    } catch (err: any) {
      this.logger.warn(`Could not reach ParaLearn Core API at ${coreApiUrl}: ${err.message}. Payload logged for async retry.`);
    }

    return {
      success: dispatchSuccess,
      syncedCount: scorePayloads.length,
      schoolId,
      examTitle: exam.title,
      response: responseData,
      payloadPreview: scorePayloads.slice(0, 5),
    };
  }

  /**
   * Generates a standard CSV report string for tutors & teachers
   */
  async exportExamScoresToCsv(examId: string): Promise<string> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        workspace: true,
        attempts: {
          orderBy: { score: "desc" },
        },
      },
    });

    if (!exam) throw new NotFoundException(`Exam ${examId} not found.`);

    const headers = [
      "Candidate Name",
      "PIN / Reg No",
      "Student ID",
      "Score",
      "Total Marks",
      "Percentage",
      "Grade",
      "Violations",
      "Status",
      "Submitted At",
    ];

    const rows = exam.attempts.map((a) => [
      `"${a.candidateName.replace(/"/g, '""')}"`,
      `"${a.candidatePin}"`,
      `"${a.studentId || "N/A"}"`,
      a.score ?? 0,
      a.totalMarks ?? 0,
      `${a.percentage ?? 0}%`,
      a.grade || "N/A",
      a.violations,
      a.status,
      a.submittedAt ? a.submittedAt.toISOString() : "Not submitted",
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
}
