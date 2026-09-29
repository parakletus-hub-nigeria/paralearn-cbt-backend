import { Controller, Post, Get, Patch, Body, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { WorkspacesService } from "./workspaces.service";

@ApiTags("Workspaces")
@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post("standalone")
  @ApiOperation({ summary: "Create an independent tutor Exam Hall workspace (issues API key & credits)" })
  createStandalone(
    @Body() body: { name: string; ownerName: string; email: string; webhookUrl?: string }
  ) {
    return this.workspacesService.createStandaloneWorkspace(body);
  }

  @Post("institution")
  @ApiOperation({ summary: "Sync or retrieve a ParaLearn School workspace via SSO" })
  createInstitution(@Body() body: { schoolId: string; schoolName: string; email: string }) {
    return this.workspacesService.findOrCreateInstitutionWorkspace(
      body.schoolId,
      body.schoolName,
      body.email
    );
  }

  @Post(":id/rotate-api-key")
  @ApiOperation({ summary: "Rotate external developer API key" })
  rotateApiKey(@Param("id") id: string) {
    return this.workspacesService.rotateApiKey(id);
  }

  @Patch(":id/webhook")
  @ApiOperation({ summary: "Update webhook URL for real-time exam completion dispatches" })
  updateWebhook(@Param("id") id: string, @Body() body: { webhookUrl: string }) {
    return this.workspacesService.updateWebhook(id, body.webhookUrl);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get workspace overview, API key, and credit balance" })
  getWorkspace(@Param("id") id: string) {
    return this.workspacesService.getWorkspaceById(id);
  }
}
