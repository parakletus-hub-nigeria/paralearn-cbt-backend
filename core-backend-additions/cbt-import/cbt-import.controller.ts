import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import { CbtImportService } from "./cbt-import.service";
import { ApiTags, ApiOperation, ApiHeader } from "@nestjs/swagger";

/**
 * Service-to-service controller called by the CBT microservice.
 * Auth is done via shared secret (x-cbt-service-key), NOT JWT.
 * Route prefix: non-tenant/cbt-import (bypasses TenantMiddleware)
 */
@ApiTags("CBT Import (Service-to-Service)")
@Controller("non-tenant/cbt-import")
export class CbtImportController {
  private readonly logger = new Logger("CbtImportController");

  constructor(private readonly cbtImportService: CbtImportService) {}

  /**
   * Validates the shared service secret from the CBT microservice using constant-time comparison.
   * This replaces JWT auth for machine-to-machine calls.
   */
  private validateServiceKey(serviceKey: string | undefined): void {
    const expected =
      process.env.CBT_SERVICE_SECRET || "pln_cbt_internal_secret_2026";
    if (!serviceKey) {
      throw new UnauthorizedException("Invalid or missing CBT service key.");
    }
    const a = Buffer.from(serviceKey);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException("Invalid or missing CBT service key.");
    }
  }

  /**
   * Step 1: Returns classes the requesting user has access to within their school.
   *
   * - Admins/Owners → all classes in the school
   * - Teachers → only classes assigned via TeacherClass or ClassTeacher
   * - Students/Others → ForbiddenException
   */
  @Post("classes")
  @ApiOperation({
    summary: "Fetch classes accessible to a user (role-scoped)",
    description:
      "CBT microservice calls this to list classes the admin/teacher can import candidates from.",
  })
  @ApiHeader({ name: "x-cbt-service-key", required: true })
  async getAccessibleClasses(
    @Headers("x-cbt-service-key") serviceKey: string,
    @Body() body: { email: string; schoolId: string },
  ) {
    this.validateServiceKey(serviceKey);

    if (!body.email || !body.schoolId) {
      throw new BadRequestException("email and schoolId are required.");
    }

    this.logger.log(
      `CBT import: fetching classes for ${body.email} in school ${body.schoolId}`,
    );

    return this.cbtImportService.getAccessibleClasses(
      body.email,
      body.schoolId,
    );
  }

  /**
   * Step 2: Returns students enrolled in the selected classes.
   *
   * Re-validates that the user actually has access to the requested classIds
   * (prevents a tampered request from pulling students from classes the user
   * shouldn't see).
   */
  @Post("students")
  @ApiOperation({
    summary: "Fetch students from selected classes for CBT candidate import",
    description:
      "CBT microservice calls this after the admin selects classes. Returns active enrollments.",
  })
  @ApiHeader({ name: "x-cbt-service-key", required: true })
  async getStudentsForClasses(
    @Headers("x-cbt-service-key") serviceKey: string,
    @Body() body: { email: string; schoolId: string; classIds: string[] },
  ) {
    this.validateServiceKey(serviceKey);

    if (!body.email || !body.schoolId || !body.classIds?.length) {
      throw new BadRequestException(
        "email, schoolId, and at least one classId are required.",
      );
    }

    this.logger.log(
      `CBT import: fetching students for ${body.classIds.length} classes (user: ${body.email})`,
    );

    return this.cbtImportService.getStudentsForClasses(
      body.email,
      body.schoolId,
      body.classIds,
    );
  }
}
