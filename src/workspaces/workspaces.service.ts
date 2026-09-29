import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import * as crypto from "crypto";

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  private generateApiKey(): string {
    return `pln_live_sk_${crypto.randomBytes(24).toString("hex")}`;
  }

  private generateWebhookSecret(): string {
    return `pln_whsec_${crypto.randomBytes(20).toString("hex")}`;
  }

  async findOrCreateInstitutionWorkspace(schoolId: string, schoolName: string, email: string) {
    let workspace = await this.prisma.cbtWorkspace.findFirst({
      where: { externalId: schoolId },
    });

    if (!workspace) {
      workspace = await this.prisma.cbtWorkspace.create({
        data: {
          name: schoolName,
          type: "INSTITUTION",
          externalId: schoolId,
          ownerEmail: email,
          credits: 999999, // Institutional schools have unlimited tests
          apiKey: this.generateApiKey(),
          webhookSecret: this.generateWebhookSecret(),
        },
      });
    }

    return workspace;
  }

  async createStandaloneWorkspace(data: {
    name: string;
    ownerName: string;
    email: string;
    webhookUrl?: string;
  }) {
    const apiKey = this.generateApiKey();
    const webhookSecret = this.generateWebhookSecret();

    return this.prisma.cbtWorkspace.create({
      data: {
        name: data.name,
        type: "STANDALONE_HALL",
        ownerName: data.ownerName,
        ownerEmail: data.email,
        credits: 30, // 30 Free candidates signup bonus
        apiKey,
        webhookUrl: data.webhookUrl || null,
        webhookSecret,
        creditLogs: {
          create: {
            amount: 30,
            action: "BONUS_SIGNUP",
            balanceAfter: 30,
          },
        },
      },
    });
  }

  async examinerLogin(email: string, password?: string) {
    let workspace = await this.prisma.cbtWorkspace.findFirst({
      where: {
        ownerEmail: { equals: email.trim(), mode: "insensitive" },
      },
      include: {
        _count: {
          select: { exams: true, questions: true },
        },
      },
    });

    if (!workspace) {
      // Auto-create workspace so examiner is never stranded
      const created = await this.createStandaloneWorkspace({
        name: `${email.split("@")[0]}'s Exam Hall`,
        ownerName: email.split("@")[0],
        email: email.trim(),
      });
      return created;
    }

    return workspace;
  }

  async findWorkspaceByApiKey(apiKey: string) {
    if (!apiKey) throw new UnauthorizedException("API Key is missing.");
    const workspace = await this.prisma.cbtWorkspace.findUnique({
      where: { apiKey },
    });
    if (!workspace) {
      throw new UnauthorizedException("Invalid ParaLearn CBT API Key.");
    }
    return workspace;
  }

  async rotateApiKey(workspaceId: string) {
    const newApiKey = this.generateApiKey();
    return this.prisma.cbtWorkspace.update({
      where: { id: workspaceId },
      data: { apiKey: newApiKey },
      select: { id: true, name: true, apiKey: true, updatedAt: true },
    });
  }

  async updateWebhook(workspaceId: string, webhookUrl: string) {
    return this.prisma.cbtWorkspace.update({
      where: { id: workspaceId },
      data: { webhookUrl },
      select: { id: true, name: true, webhookUrl: true, webhookSecret: true },
    });
  }

  async getWorkspaceById(id: string) {
    const workspace = await this.prisma.cbtWorkspace.findUnique({
      where: { id },
      include: {
        _count: {
          select: { exams: true, questions: true },
        },
      },
    });

    if (!workspace) throw new NotFoundException(`Workspace ${id} not found.`);
    return workspace;
  }

  async deductCredit(workspaceId: string, amount: number = 1): Promise<number> {
    const workspace = await this.getWorkspaceById(workspaceId);
    if (workspace.type === "INSTITUTION") return workspace.credits; // Unlimited

    if (workspace.credits < amount) {
      throw new Error("Insufficient candidate credits. Please top up your exam hall balance.");
    }

    const updated = await this.prisma.cbtWorkspace.update({
      where: { id: workspaceId },
      data: {
        credits: { decrement: amount },
        creditLogs: {
          create: {
            amount: -amount,
            action: "EXAM_ATTEMPT",
            balanceAfter: workspace.credits - amount,
          },
        },
      },
    });

    return updated.credits;
  }
}
