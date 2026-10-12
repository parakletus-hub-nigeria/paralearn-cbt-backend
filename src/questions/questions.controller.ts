import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes } from "@nestjs/swagger";
import { QuestionsService } from "./questions.service";
import { CreateQuestionDto, UpdateQuestionDto, BulkCreateQuestionsDto } from "./dto/create-question.dto";
import { Public } from "../access/public.decorator";
import { Caller, type CbtCaller } from "../access/caller.decorator";
import { CbtAccessService } from "../access/cbt-access.service";

@ApiTags("Questions")
@Controller("questions")
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly access: CbtAccessService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a single question in workspace question bank" })
  createQuestion(@Body() dto: CreateQuestionDto, @Caller() caller: CbtCaller) {
    dto.workspaceId = this.access.workspaceFor(caller, dto.workspaceId);
    return this.questionsService.createQuestion(dto);
  }

  @Post("bulk")
  @ApiOperation({ summary: "Create multiple questions in a single atomic transaction" })
  async createBulk(@Body() dto: BulkCreateQuestionsDto, @Caller() caller: CbtCaller) {
    dto.workspaceId = this.access.workspaceFor(caller, dto.workspaceId);
    if (dto.examId) await this.access.assertExam(caller, dto.examId);
    return this.questionsService.createBulkQuestions(dto);
  }

  @Post("import-excel")
  @ApiOperation({ summary: "Upload Excel (.xlsx) file to parse and create questions" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  async uploadExcel(
    @UploadedFile() file: any,
    @Body("workspaceId") workspaceId: string,
    @Caller() caller: CbtCaller,
    @Body("examId") examId?: string
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException("An Excel (.xlsx) file is required.");
    }
    workspaceId = this.access.workspaceFor(caller, workspaceId);
    if (examId) await this.access.assertExam(caller, examId);
    return this.questionsService.importFromExcel(file.buffer, workspaceId, examId);
  }

  @Get()
  @ApiOperation({ summary: "List questions in workspace bank with optional search" })
  @ApiQuery({ name: "workspaceId", required: true, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "type", required: false, type: String })
  listQuestions(
    @Query("workspaceId") workspaceId: string,
    @Caller() caller: CbtCaller,
    @Query("search") search?: string,
    @Query("type") type?: string
  ) {
    return this.questionsService.findWorkspaceQuestions(
      this.access.workspaceFor(caller, workspaceId),
      search,
      type
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get question details" })
  async getQuestion(@Param("id") id: string, @Caller() caller: CbtCaller) {
    await this.access.assertQuestion(caller, id);
    return this.questionsService.findQuestionById(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update question prompt, options or marks" })
  async updateQuestion(@Param("id") id: string, @Body() dto: UpdateQuestionDto, @Caller() caller: CbtCaller) {
    await this.access.assertQuestion(caller, id);
    return this.questionsService.updateQuestion(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete question from bank" })
  async deleteQuestion(@Param("id") id: string, @Caller() caller: CbtCaller) {
    await this.access.assertQuestion(caller, id);
    return this.questionsService.deleteQuestion(id);
  }
}
