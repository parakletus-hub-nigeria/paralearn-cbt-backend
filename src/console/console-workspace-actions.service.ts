import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AttemptStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Permanent deletion of a CBT workspace from the Parakletus admin console.
 * The schema cascades from CbtWorkspace to exams, questions, candidates,
 * attempts, answers and credit logs, so one delete removes everything.
 */
@Injectable()
export class ConsoleWorkspaceActionsService {
  private readonly logger = new Logger("ConsoleWorkspaceActions");

  constructor(private readonly prisma: PrismaService) {}

  async delete(id: string, confirm: string, actor: string) {
    const workspace = await this.prisma.cbtWorkspace.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, externalId: true, _count: { select: { exams: true, questions: true } } },
    });
    if (!workspace) throw new NotFoundException("Workspace not found");

    if (confirm.trim().toLowerCase() !== workspace.name.trim().toLowerCase()) {
      throw new BadRequestException("Confirmation doesn't match the workspace name");
    }

    // Never wipe a workspace while someone is sitting one of its exams.
    const live = await this.prisma.examAttempt.count({
      where: { status: AttemptStatus.IN_PROGRESS, exam: { workspaceId: id } },
    });
    if (live > 0) {
      throw new ConflictException(`${live} exam attempt${live === 1 ? " is" : "s are"} in progress. Try again when they finish.`);
    }

    const candidates = await this.prisma.candidate.count({ where: { exam: { workspaceId: id } } });
    await this.prisma.cbtWorkspace.delete({ where: { id } });

    const removed = { exams: workspace._count.exams, questions: workspace._count.questions, candidates };
    // CBT has no audit table; this line goes to the App Service log stream.
    this.logger.warn(
      `CONSOLE_WORKSPACE_DELETED ${JSON.stringify({ id, name: workspace.name, type: workspace.type, externalId: workspace.externalId, admin: actor, via: "admin-console", removed })}`,
    );
    return { deleted: { id, name: workspace.name }, removed };
  }
}
