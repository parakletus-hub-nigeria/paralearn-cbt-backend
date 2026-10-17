import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";

/** CSV export of an exam's results. Report cards are fed through ParaLearn Core's report-card link. */
@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

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
