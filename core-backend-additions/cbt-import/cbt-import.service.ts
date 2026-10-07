import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Roles that grant access to ALL classes in a school */
const ADMIN_ROLES = [
  "admin",
  "owner",
  "principal",
  "vp",
  "vice-principal",
  "vice_principal",
  "superadmin",
  "super_admin",
];

/** Roles that grant access only to assigned classes */
const TEACHER_ROLES = [
  "teacher",
  "class-teacher",
  "class_teacher",
  "head-teacher",
  "head_teacher",
];

@Injectable()
export class CbtImportService {
  private readonly logger = new Logger("CbtImportService");

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves a user by email within a school and determines their role tier:
   * - ADMIN: full access to all school classes
   * - TEACHER: scoped to classes assigned via TeacherClass / ClassTeacher / TeacherSubject
   * - NONE: no import permission
   */
  private async resolveUserRole(
    email: string,
    schoolId: string,
  ): Promise<{
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
    tier: "ADMIN" | "TEACHER";
  }> {
    const prismaAny = this.prisma as any;
    const cleanEmail = email.trim().toLowerCase();

    // 1. Find user in this school (or search globally if user's schoolId is null, e.g. superadmin/owner)
    let user = await prismaAny.user.findFirst({
      where: {
        email: { equals: cleanEmail, mode: "insensitive" },
        schoolId,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isSuperAdmin: true,
        schoolId: true,
      },
    });

    if (!user) {
      user = await prismaAny.user.findFirst({
        where: {
          email: { equals: cleanEmail, mode: "insensitive" },
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isSuperAdmin: true,
          schoolId: true,
        },
      });
    }

    if (!user) {
      throw new NotFoundException(
        `No active user found with email "${email}".`,
      );
    }

    // If global super admin, automatically grant full ADMIN tier
    if (user.isSuperAdmin) {
      return { user, tier: "ADMIN" };
    }

    // 2. Fetch user roles for this school
    const userRoles = await prismaAny.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });

    const roleNames: string[] = userRoles
      .filter(
        (ur: any) =>
          ur.role && (ur.role.schoolId === schoolId || !ur.role.schoolId),
      )
      .map((ur: any) => (ur.role.name || "").toLowerCase());

    this.logger.debug(
      `User ${cleanEmail} has roles: ${JSON.stringify(roleNames)} in school ${schoolId}`,
    );

    // 3. Determine tier
    if (roleNames.some((r) => ADMIN_ROLES.includes(r))) {
      return { user, tier: "ADMIN" };
    }

    if (roleNames.some((r) => TEACHER_ROLES.includes(r))) {
      return { user, tier: "TEACHER" };
    }

    throw new ForbiddenException(
      `User "${email}" does not have admin or teacher permissions to import candidates.`,
    );
  }

  /**
   * Helper to retrieve all class IDs assigned to a teacher within a specific school.
   * Checks ClassTeacher, TeacherClass, and TeacherSubject join tables.
   */
  private async getTeacherAssignedClassIds(
    teacherId: string,
    schoolId: string,
  ): Promise<string[]> {
    const prismaAny = this.prisma as any;

    const [classTeachers, teacherClasses, teacherSubjects] = await Promise.all([
      // Class teachers (form tutors)
      prismaAny.classTeacher.findMany({
        where: { teacherId, schoolId, isActive: true },
        select: { classId: true },
      }),
      // Subject teacher class assignments
      prismaAny.teacherClass.findMany({
        where: { teacherId },
        include: { class: { select: { id: true, schoolId: true } } },
      }),
      // Teacher subject assignments (with specific class)
      prismaAny.teacherSubject.findMany({
        where: { teacherId, schoolId, classId: { not: null } },
        select: { classId: true },
      }),
    ]);

    const classIds = new Set<string>();

    for (const ct of classTeachers) {
      if (ct.classId) classIds.add(ct.classId);
    }
    for (const tc of teacherClasses) {
      if (tc.class && tc.class.schoolId === schoolId) {
        classIds.add(tc.class.id);
      }
    }
    for (const ts of teacherSubjects) {
      if (ts.classId) classIds.add(ts.classId);
    }

    return Array.from(classIds);
  }

  /**
   * Returns classes the user has access to, including active student counts.
   */
  async getAccessibleClasses(email: string, schoolId: string) {
    const prismaAny = this.prisma as any;
    const { user, tier } = await this.resolveUserRole(email, schoolId);

    let classWhere: any = { schoolId };

    // If teacher, scope to their assigned classes only
    if (tier === "TEACHER") {
      const assignedClassIds = await this.getTeacherAssignedClassIds(
        user.id,
        schoolId,
      );

      if (assignedClassIds.length === 0) {
        return {
          user: {
            id: user.id,
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
            email: user.email,
          },
          tier,
          classes: [],
        };
      }

      classWhere = { ...classWhere, id: { in: assignedClassIds } };
    }

    const classes = await prismaAny.class.findMany({
      where: classWhere,
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        stream: true,
        _count: {
          select: {
            enrollments: {
              where: {
                status: "active",
                student: { isActive: true },
              },
            },
          },
        },
      },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });

    return {
      user: {
        id: user.id,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email,
      },
      tier,
      classes: classes.map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        level: c.level,
        stream: c.stream,
        activeStudents: c._count.enrollments,
      })),
    };
  }

  /**
   * Returns students enrolled in the selected classes.
   * Re-validates that the user actually has access to the requested class IDs.
   */
  async getStudentsForClasses(
    email: string,
    schoolId: string,
    classIds: string[],
  ) {
    const prismaAny = this.prisma as any;
    const { user, tier } = await this.resolveUserRole(email, schoolId);

    // Re-validate class access for teachers (prevents unauthorized parameter tampering)
    if (tier === "TEACHER") {
      const assignedIds = new Set(
        await this.getTeacherAssignedClassIds(user.id, schoolId),
      );
      const unauthorized = classIds.filter((id) => !assignedIds.has(id));
      if (unauthorized.length > 0) {
        throw new ForbiddenException(
          `You do not have access to import candidates from class IDs: ${unauthorized.join(", ")}`,
        );
      }
    }

    // Verify all requested classes belong to the target school
    const validClasses = await prismaAny.class.findMany({
      where: { id: { in: classIds }, schoolId },
      select: { id: true, name: true },
    });

    if (validClasses.length !== classIds.length) {
      const validIds = new Set(validClasses.map((c: any) => c.id));
      const invalid = classIds.filter((id) => !validIds.has(id));
      throw new ForbiddenException(
        `Classes not found in this school: ${invalid.join(", ")}`,
      );
    }

    // Fetch active enrollments with active student details
    const enrollments = await prismaAny.enrollment.findMany({
      where: {
        classId: { in: classIds },
        status: "active",
        student: { isActive: true },
      },
      select: {
        id: true,
        classId: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            studentId: true,
            gender: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Deduplicate students in case of multi-class enrollment
    const seen = new Set<string>();
    const students = enrollments
      .filter((e: any) => {
        if (!e.student || seen.has(e.student.id)) return false;
        seen.add(e.student.id);
        return true;
      })
      .map((e: any) => ({
        studentId: e.student.id,
        sisStudentId: e.student.studentId, // e.g. "STU-2026-001"
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        fullName:
          `${e.student.firstName || ""} ${e.student.lastName || ""}`.trim() ||
          "Unnamed Student",
        email: e.student.email,
        phone: e.student.phoneNumber,
        gender: e.student.gender,
        className: e.class?.name || "Unknown Class",
        classId: e.class?.id || e.classId,
      }));

    return {
      user: {
        id: user.id,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      },
      totalStudents: students.length,
      classesRequested: validClasses.map((c: any) => c.name),
      students,
    };
  }
}
