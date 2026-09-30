import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { BulkUpsertCandidatesDto, CandidateRosterItemDto, UpsertCandidateDto } from "./dto/candidate.dto";

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePin(pin: string): string {
    return pin.trim().toUpperCase();
  }

  private normalizeCandidate(dto: UpsertCandidateDto | (CandidateRosterItemDto & { examId: string })) {
    return {
      examId: dto.examId,
      candidateName: dto.candidateName.trim(),
      candidatePin: this.normalizePin(dto.candidatePin),
      studentId: dto.studentId?.trim() || null,
      email: dto.email?.trim().toLowerCase() || null,
      phone: dto.phone?.trim() || null,
      metadata: dto.metadata || undefined,
    };
  }

  async upsertCandidate(dto: UpsertCandidateDto) {
    const exam = await this.prisma.exam.findUnique({ where: { id: dto.examId } });
    if (!exam) throw new NotFoundException(`Exam ${dto.examId} not found.`);

    const data = this.normalizeCandidate(dto);
    return this.prisma.candidate.upsert({
      where: {
        unique_exam_candidate: {
          examId: data.examId,
          candidatePin: data.candidatePin,
        },
      },
      update: {
        candidateName: data.candidateName,
        studentId: data.studentId,
        email: data.email,
        phone: data.phone,
        metadata: data.metadata,
      },
      create: data,
    });
  }

  async bulkUpsertCandidates(dto: BulkUpsertCandidatesDto) {
    const exam = await this.prisma.exam.findUnique({ where: { id: dto.examId } });
    if (!exam) throw new NotFoundException(`Exam ${dto.examId} not found.`);

    const normalized = dto.candidates.map((candidate) =>
      this.normalizeCandidate({ ...candidate, examId: dto.examId })
    );

    const pins = new Set<string>();
    for (const candidate of normalized) {
      if (pins.has(candidate.candidatePin)) {
        throw new BadRequestException(`Duplicate candidate PIN "${candidate.candidatePin}" in upload.`);
      }
      pins.add(candidate.candidatePin);
    }

    const candidates = await this.prisma.$transaction(
      normalized.map((candidate) =>
        this.prisma.candidate.upsert({
          where: {
            unique_exam_candidate: {
              examId: candidate.examId,
              candidatePin: candidate.candidatePin,
            },
          },
          update: {
            candidateName: candidate.candidateName,
            studentId: candidate.studentId,
            email: candidate.email,
            phone: candidate.phone,
            metadata: candidate.metadata,
          },
          create: candidate,
        })
      )
    );

    return { count: candidates.length, candidates };
  }

  async listExamCandidates(examId: string, search?: string) {
    return this.prisma.candidate.findMany({
      where: {
        examId,
        ...(search
          ? {
              OR: [
                { candidateName: { contains: search, mode: "insensitive" } },
                { candidatePin: { contains: search, mode: "insensitive" } },
                { studentId: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getCandidateById(id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: { exam: { select: { id: true, title: true, accessCode: true } } },
    });
    if (!candidate) throw new NotFoundException(`Candidate ${id} not found.`);
    return candidate;
  }

  async deleteCandidate(id: string) {
    await this.getCandidateById(id);
    return this.prisma.candidate.delete({ where: { id } });
  }
}
