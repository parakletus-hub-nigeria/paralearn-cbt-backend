import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { CreateQuestionDto, UpdateQuestionDto, BulkCreateQuestionsDto } from "./dto/create-question.dto";
import * as XLSX from "xlsx";

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuestion(dto: CreateQuestionDto) {
    const workspace = await this.prisma.cbtWorkspace.findUnique({
      where: { id: dto.workspaceId },
    });
    if (!workspace) throw new NotFoundException(`Workspace ${dto.workspaceId} not found.`);

    return this.prisma.question.create({
      data: {
        workspaceId: dto.workspaceId,
        prompt: dto.prompt,
        type: dto.type ?? "MCQ",
        marks: dto.marks ?? 1.0,
        options: dto.options as any,
        explanation: dto.explanation,
      },
    });
  }

  async createBulkQuestions(dto: BulkCreateQuestionsDto) {
    const workspace = await this.prisma.cbtWorkspace.findUnique({
      where: { id: dto.workspaceId },
    });
    if (!workspace) throw new NotFoundException(`Workspace ${dto.workspaceId} not found.`);

    const createdQuestions = await this.prisma.$transaction(
      dto.questions.map((q) =>
        this.prisma.question.create({
          data: {
            workspaceId: dto.workspaceId,
            prompt: q.prompt,
            type: q.type ?? "MCQ",
            marks: q.marks ?? 1.0,
            options: q.options as any,
            explanation: q.explanation,
          },
        })
      )
    );

    // If an examId was provided, attach these questions to the exam
    if (dto.examId) {
      const exam = await this.prisma.exam.findUnique({ where: { id: dto.examId } });
      if (exam) {
        const currentCount = await this.prisma.examQuestion.count({
          where: { examId: dto.examId },
        });

        await this.prisma.examQuestion.createMany({
          data: createdQuestions.map((q, index) => ({
            examId: dto.examId!,
            questionId: q.id,
            orderIndex: currentCount + index,
          })),
        });

        // Update exam total marks
        const additionalMarks = createdQuestions.reduce((sum, q) => sum + q.marks, 0);
        await this.prisma.exam.update({
          where: { id: dto.examId },
          data: { totalMarks: { increment: additionalMarks } },
        });
      }
    }

    return {
      count: createdQuestions.length,
      questions: createdQuestions,
    };
  }

  /**
   * Parses an uploaded Excel buffer into valid question models
   */
  async importFromExcel(buffer: Buffer, workspaceId: string, examId?: string) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException("Uploaded Excel sheet is empty or contains no valid worksheets.");
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (rows.length === 0) {
      throw new BadRequestException("No data rows found in worksheet.");
    }

    const parsedQuestions: CreateQuestionDto[] = [];

    for (const row of rows) {
      // Find prompt column
      const prompt =
        row["Question"] ||
        row["question"] ||
        row["PROMPT"] ||
        row["Prompt"] ||
        row["Question Text"] ||
        row["Item"];

      if (!prompt || String(prompt).trim() === "") continue;

      const optA = String(row["Option A"] || row["OptionA"] || row["A"] || "").trim();
      const optB = String(row["Option B"] || row["OptionB"] || row["B"] || "").trim();
      const optC = String(row["Option C"] || row["OptionC"] || row["C"] || "").trim();
      const optD = String(row["Option D"] || row["OptionD"] || row["D"] || "").trim();

      const rawAnswer = String(
        row["Correct Answer"] ||
        row["Answer"] ||
        row["Correct"] ||
        row["Key"] ||
        ""
      ).trim().toUpperCase();

      const marks = parseFloat(row["Marks"] || row["Points"] || "1") || 1.0;
      const explanation = String(row["Explanation"] || row["Rationale"] || "").trim();

      const options = [
        { id: "opt_a", keyLabel: "A", text: optA, isCorrect: rawAnswer === "A" || rawAnswer === optA.toUpperCase() },
        { id: "opt_b", keyLabel: "B", text: optB, isCorrect: rawAnswer === "B" || rawAnswer === optB.toUpperCase() },
        { id: "opt_c", keyLabel: "C", text: optC, isCorrect: rawAnswer === "C" || rawAnswer === optC.toUpperCase() },
        { id: "opt_d", keyLabel: "D", text: optD, isCorrect: rawAnswer === "D" || rawAnswer === optD.toUpperCase() },
      ].filter((opt) => opt.text.length > 0);

      // If no option was marked correct, default first option to prevent invalid data
      if (options.length > 0 && !options.some((o) => o.isCorrect)) {
        options[0].isCorrect = true;
      }

      parsedQuestions.push({
        workspaceId,
        prompt: String(prompt).trim(),
        type: "MCQ" as any,
        marks,
        options,
        explanation: explanation || undefined,
      });
    }

    if (parsedQuestions.length === 0) {
      throw new BadRequestException(
        "Could not parse any valid questions. Ensure headers are: Question, Option A, Option B, Option C, Option D, Correct Answer, Marks"
      );
    }

    return this.createBulkQuestions({
      workspaceId,
      examId,
      questions: parsedQuestions,
    });
  }

  async findWorkspaceQuestions(workspaceId: string, search?: string, type?: string) {
    return this.prisma.question.findMany({
      where: {
        workspaceId,
        ...(type ? { type: type as any } : {}),
        ...(search
          ? {
              prompt: {
                contains: search,
                mode: "insensitive",
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findQuestionById(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        examLinks: {
          include: { exam: { select: { id: true, title: true, accessCode: true } } },
        },
      },
    });

    if (!question) throw new NotFoundException(`Question ${id} not found.`);
    return question;
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException(`Question ${id} not found.`);

    return this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.prompt ? { prompt: dto.prompt } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.marks !== undefined ? { marks: dto.marks } : {}),
        ...(dto.options ? { options: dto.options as any } : {}),
        ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
      },
    });
  }

  async deleteQuestion(id: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException(`Question ${id} not found.`);

    return this.prisma.question.delete({ where: { id } });
  }
}
