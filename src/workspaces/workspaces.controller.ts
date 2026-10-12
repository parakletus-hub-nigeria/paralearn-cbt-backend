import { Controller, Post, Get, Patch, Body, Param, GoneException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { WorkspacesService } from "./workspaces.service";
import { Public } from "../access/public.decorator";
import { Caller, type CbtCaller } from "../access/caller.decorator";
import { CbtAccessService } from "../access/cbt-access.service";

@ApiTags("Workspaces")
@Controller("workspaces")
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly access: CbtAccessService,
  ) {}

  @Post("standalone")
  @ApiOperation({ summary: "Create an independent Exam Hall workspace (internal)" })
  createStandalone(
    @Body() body: { name: string; ownerName: string; email: string; webhookUrl?: string },
    @Caller() caller: CbtCaller
  ) {
    this.access.assertService(caller);
    return this.workspacesService.createStandaloneWorkspace(body);
  }

  @Post("login")
  @Public()
  @ApiOperation({ summary: "Retired: examiners sign in at https://cbt.pln.ng/cbt/auth" })
  examinerLogin() {
    throw new GoneException("Examiner sign-in has moved to https://cbt.pln.ng/cbt/auth.");
  }

  @Post("institution")
  @ApiOperation({ summary: "Sync or retrieve a ParaLearn School workspace (internal)" })
  createInstitution(
    @Body() body: { schoolId: string; schoolName: string; email: string },
    @Caller() caller: CbtCaller
  ) {
    this.access.assertService(caller);
    return this.workspacesService.findOrCreateInstitutionWorkspace(
      body.schoolId,
      body.schoolName,
      body.email
    );
  }

  @Post(":id/rotate-api-key")
  @ApiOperation({ summary: "Rotate external developer API key" })
  rotateApiKey(@Param("id") id: string, @Caller() caller: CbtCaller) {
    return this.workspacesService.rotateApiKey(this.access.workspaceFor(caller, id));
  }

  @Patch(":id/webhook")
  @ApiOperation({ summary: "Update webhook URL for real-time exam completion dispatches" })
  updateWebhook(
    @Param("id") id: string,
    @Body() body: { webhookUrl: string },
    @Caller() caller: CbtCaller
  ) {
    return this.workspacesService.updateWebhook(
      this.access.workspaceFor(caller, id),
      body.webhookUrl
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get workspace overview, API key, and credit balance" })
  getWorkspace(@Param("id") id: string, @Caller() caller: CbtCaller) {
    return this.workspacesService.getWorkspaceById(this.access.workspaceFor(caller, id));
  }
}
