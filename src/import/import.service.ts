import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@/prisma/prisma.service";

/** Shape returned by ParaLearn Core POST /non-tenant/cbt-import/classes */
interface CoreClassResponse {
  user: { id: string; name: string; email: string };
  tier: "ADMIN" | "TEACHER";
  classes: Array<{
    id: string;
    name: string;
    code: string | null;
    level: number | null;
    stream: string | null;
    activeStudents: number;
  }>;
}

/** Shape returned by ParaLearn Core POST /non-tenant/cbt-import/students */
interface CoreStudentResponse {
  user: { id: string; name: string };
  totalStudents: number;
  classesRequested: string[];
  students: Array<{
    studentId: string;
    sisStudentId: string | null;
    firstName: string | null;
    lastName: string | null;
    fullName: string;
    email: string | null;
    phone: string | null;
    gender: string | null;
    className: string;
    classId: string;
  }>;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger("ImportService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Build the Core API base URL and shared service key */
  private getCoreConfig() {
    const coreApiUrl = this.config.get<string>(
      "PARALEARN_CORE_API_URL",
      "http://localhost:3000/api",
    );
    const serviceSecret = this.config.get<string>(
      "CBT_SERVICE_SECRET",
      "pln_cbt_internal_secret_2026",
    );
    return { coreApiUrl, serviceSecret };
  }

  /**
   * Validates that the workspace exists, is of type INSTITUTION,
   * and has a linked schoolId (externalId).
   */
  private async resolveInstitutionWorkspace(workspaceId: string) {
    const workspace = await this.prisma.cbtWorkspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace "${workspaceId}" not found.`);
    }

    if (workspace.type !== "INSTITUTION") {
      throw new BadRequestException(
        "Importing candidates from ParaLearn is only available for Institution workspaces. " +
          "Standalone exam halls should use Excel upload or manual entry.",
      );
    }

    if (!workspace.externalId) {
      throw new BadRequestException(
        "This institution workspace is not linked to a ParaLearn school. " +
          "Please re-sync the workspace first.",
      );
    }

    return { workspace, schoolId: workspace.externalId };
  }

  /**
   * Step 1: Fetch importable classes from ParaLearn Core.
   * Called when the admin clicks "Import from ParaLearn".
   */
  async fetchImportableClasses(workspaceId: string, email: string) {
    const { schoolId } = await this.resolveInstitutionWorkspace(workspaceId);
    const { coreApiUrl, serviceSecret } = this.getCoreConfig();

    let data: CoreClassResponse;

    try {
      const response = await fetch(
        `${coreApiUrl}/non-tenant/cbt-import/classes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cbt-service-key": serviceSecret,
          },
          body: JSON.stringify({ email, schoolId }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `Core API returned HTTP ${response.status} for classes: ${errorText}`,
        );

        if (response.status === 401 || response.status === 403) {
          throw new ForbiddenException(
            `Access denied by ParaLearn Core: ${errorText}`,
          );
        }
        if (response.status === 404) {
          throw new NotFoundException(
            `ParaLearn Core could not find user "${email}" in this school.`,
          );
        }

        throw new InternalServerErrorException(
          `ParaLearn Core returned an error: ${errorText}`,
        );
      }

      data = await response.json();
    } catch (err: any) {
      if (
        err instanceof ForbiddenException ||
        err instanceof NotFoundException ||
        err instanceof InternalServerErrorException
      ) {
        throw err;
      }
      this.logger.error(
        `Failed to reach ParaLearn Core at ${coreApiUrl}: ${err.message}`,
      );
      throw new InternalServerErrorException(
        "Could not connect to ParaLearn Core API. Please try again later.",
      );
    }

    return {
      success: true,
      user: data.user,
      accessTier: data.tier,
      classes: data.classes,
      totalClasses: data.classes.length,
      totalAvailableStudents: data.classes.reduce(
        (sum, c) => sum + c.activeStudents,
        0,
      ),
    };
  }

  /**
   * Step 2: Import students from selected classes into the exam roster.
   *
   * Flow:
   *  1. Validate workspace & exam
   *  2. Call Core API to get students for selected classes
   *  3. Auto-generate PINs (6-digit numeric)
   *  4. Bulk upsert as Candidate records with studentId mapped
   */
  async importCandidatesFromParalearn(params: {
    workspaceId: string;
    examId: string;
    email: string;
    classIds: string[];
    autoGeneratePin?: boolean;
  }) {
    const {
      workspaceId,
      examId,
      email,
      classIds,
      autoGeneratePin = true,
    } = params;

    // 1. Validate workspace
    const { schoolId } = await this.resolveInstitutionWorkspace(workspaceId);

    // 2. Validate exam belongs to this workspace
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      throw new NotFoundException(`Exam "${examId}" not found.`);
    }

    if (exam.workspaceId !== workspaceId) {
      throw new ForbiddenException(
        "This exam does not belong to the specified workspace.",
      );
    }

    // 3. Fetch students from Core
    const { coreApiUrl, serviceSecret } = this.getCoreConfig();
    let coreData: CoreStudentResponse;

    try {
      const response = await fetch(
        `${coreApiUrl}/non-tenant/cbt-import/students`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cbt-service-key": serviceSecret,
          },
          body: JSON.stringify({ email, schoolId, classIds }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `Core API returned HTTP ${response.status} for students: ${errorText}`,
        );

        if (response.status === 401 || response.status === 403) {
          throw new ForbiddenException(
            `Access denied by ParaLearn Core: ${errorText}`,
          );
        }

        throw new InternalServerErrorException(
          `ParaLearn Core returned an error: ${errorText}`,
        );
      }

      coreData = await response.json();
    } catch (err: any) {
      if (
        err instanceof ForbiddenException ||
        err instanceof InternalServerErrorException
      ) {
        throw err;
      }
      this.logger.error(`Failed to reach ParaLearn Core: ${err.message}`);
      throw new InternalServerErrorException(
        "Could not connect to ParaLearn Core API. Please try again later.",
      );
    }

    if (coreData.students.length === 0) {
      return {
        success: true,
        imported: 0,
        message: "No active students found in the selected classes.",
        candidates: [],
      };
    }

    // 4. Query existing candidates for this exam to prevent duplicate entries on re-import
    const existingCandidates = await this.prisma.candidate.findMany({
      where: { examId },
      select: {
        id: true,
        candidatePin: true,
        studentId: true,
        email: true,
      },
    });

    const usedPins = new Set(existingCandidates.map((c) => c.candidatePin));
    const existingByStudentId = new Map<
      string,
      (typeof existingCandidates)[0]
    >();
    const existingByEmail = new Map<string, (typeof existingCandidates)[0]>();

    for (const c of existingCandidates) {
      if (c.studentId) existingByStudentId.set(c.studentId, c);
      if (c.email) existingByEmail.set(c.email.toLowerCase(), c);
    }

    let newlyCreatedCount = 0;
    let updatedCount = 0;

    const candidateData = coreData.students.map((student) => {
      const cleanEmail = student.email?.toLowerCase() || null;
      const existing =
        (student.studentId && existingByStudentId.get(student.studentId)) ||
        (cleanEmail && existingByEmail.get(cleanEmail));

      let pin: string;

      if (existing) {
        // Reuse their already assigned PIN so re-import updates instead of duplicating
        pin = existing.candidatePin;
        updatedCount++;
      } else {
        newlyCreatedCount++;
        if (autoGeneratePin) {
          pin = this.generateUniquePin(usedPins);
        } else {
          // Use their SIS studentId as the PIN if available and not already taken
          const candidateSisPin = student.sisStudentId?.trim().toUpperCase();
          if (candidateSisPin && !usedPins.has(candidateSisPin)) {
            pin = candidateSisPin;
          } else {
            pin = this.generateUniquePin(usedPins);
          }
        }
        usedPins.add(pin);
      }

      return {
        examId,
        candidateName: student.fullName,
        candidatePin: pin,
        studentId: student.studentId, // ParaLearn Core User.id — enables score sync
        email: cleanEmail,
        phone: student.phone || null,
        metadata: {
          importedFrom: "paralearn",
          className: student.className,
          classId: student.classId,
          sisStudentId: student.sisStudentId,
          gender: student.gender,
          importedAt: new Date().toISOString(),
        },
      };
    });

    // 5. Bulk upsert via transaction
    const candidates = await this.prisma.$transaction(
      candidateData.map((candidate) =>
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
        }),
      ),
    );

    this.logger.log(
      `Imported ${candidates.length} candidates (${newlyCreatedCount} new, ${updatedCount} updated) ` +
        `from ParaLearn into exam "${exam.title}" (${examId})`,
    );

    return {
      success: true,
      imported: candidates.length,
      newlyCreated: newlyCreatedCount,
      updated: updatedCount,
      examId,
      examTitle: exam.title,
      classesImported: coreData.classesRequested,
      message: `Successfully imported ${candidates.length} candidates (${newlyCreatedCount} added, ${updatedCount} updated) from ${coreData.classesRequested.length} class(es).`,
      candidates: candidates.map((c) => ({
        id: c.id,
        candidateName: c.candidateName,
        candidatePin: c.candidatePin,
        studentId: c.studentId,
        email: c.email,
      })),
    };
  }

  /**
   * Generates a unique 6-digit numeric PIN that doesn't collide
   * with any existing PINs in the set.
   */
  private generateUniquePin(usedPins: Set<string>): string {
    let pin: string;
    let attempts = 0;
    const MAX_ATTEMPTS = 1000;

    do {
      pin = String(Math.floor(100000 + Math.random() * 900000)); // 100000–999999
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        throw new InternalServerErrorException(
          "Unable to generate unique PINs. Too many candidates on this exam.",
        );
      }
    } while (usedPins.has(pin));

    return pin;
  }
}
