import { Controller, Post, Get, Patch, Delete, Body, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ExamsService } from "./exams.service";
import { CreateExamDto, UpdateExamDto, AttachQuestionsDto } from "./dto/create-exam.dto";
import { Public } from "../access/public.decorator";
import { Caller, type CbtCaller } from "../access/caller.decorator";
import { CbtAccessService } from "../access/cbt-access.service";

@ApiTags("Exams")
@Controller("exams")
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly access: CbtAccessService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new examination within a workspace" })
  createExam(@Body() dto: CreateExamDto, @Caller() caller: CbtCaller) {
    dto.workspaceId = this.access.workspaceFor(caller, dto.workspaceId);
    return this.examsService.createExam(dto);
  }

  @Get()
  @ApiOperation({ summary: "List examinations for a specific workspace" })
  @ApiQuery({ name: "workspaceId", required: true, type: String })
  listExams(@Query("workspaceId") workspaceId: string, @Caller() caller: CbtCaller) {
    return this.examsService.findWorkspaceExams(this.access.workspaceFor(caller, workspaceId));
  }

  @Get("code/:accessCode")
  @ApiOperation({ summary: "Candidate lobby verification by exam access code" })
  @Public()
  getExamByCode(@Param("accessCode") accessCode: string) {
    return this.examsService.findExamByAccessCode(accessCode);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get detailed exam configuration including questions" })
  async getExamById(@Param("id") id: string, @Caller() caller: CbtCaller) {
    await this.access.assertExam(caller, id);
    return this.examsService.findExamById(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update exam settings, timing, or published status" })
  async updateExam(@Param("id") id: string, @Body() dto: UpdateExamDto, @Caller() caller: CbtCaller) {
    await this.access.assertExam(caller, id);
    return this.examsService.updateExam(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an exam (only if no candidate attempts exist)" })
  async deleteExam(@Param("id") id: string, @Caller() caller: CbtCaller) {
    await this.access.assertExam(caller, id);
    return this.examsService.deleteExam(id);
  }

  @Post(":id/questions")
  @ApiOperation({ summary: "Attach question list and update total marks" })
  async attachQuestions(@Param("id") id: string, @Body() dto: AttachQuestionsDto, @Caller() caller: CbtCaller) {
    await this.access.assertExam(caller, id);
    for (const questionId of dto.questionIds) await this.access.assertQuestion(caller, questionId);
    return this.examsService.attachQuestions(id, dto);
  }

  @Get(":id/monitor")
  @ApiOperation({ summary: "Get real-time live invigilation board metrics and candidate roster" })
  async getLiveMonitor(@Param("id") id: string, @Caller() caller: CbtCaller) {
    await this.access.assertExam(caller, id);
    return this.examsService.getLiveMonitorStats(id);
  }
}
