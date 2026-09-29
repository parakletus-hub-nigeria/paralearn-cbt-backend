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

@ApiTags("Questions")
@Controller("questions")
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @ApiOperation({ summary: "Create a single question in workspace question bank" })
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.questionsService.createQuestion(dto);
  }

  @Post("bulk")
  @ApiOperation({ summary: "Create multiple questions in a single atomic transaction" })
  createBulk(@Body() dto: BulkCreateQuestionsDto) {
    return this.questionsService.createBulkQuestions(dto);
  }

  @Post("import-excel")
  @ApiOperation({ summary: "Upload Excel (.xlsx) file to parse and create questions" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  async uploadExcel(
    @UploadedFile() file: any,
    @Body("workspaceId") workspaceId: string,
    @Body("examId") examId?: string
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException("An Excel (.xlsx) file is required.");
    }
    if (!workspaceId) {
      throw new BadRequestException("workspaceId is required.");
    }
    return this.questionsService.importFromExcel(file.buffer, workspaceId, examId);
  }

  @Get()
  @ApiOperation({ summary: "List questions in workspace bank with optional search" })
  @ApiQuery({ name: "workspaceId", required: true, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "type", required: false, type: String })
  listQuestions(
    @Query("workspaceId") workspaceId: string,
    @Query("search") search?: string,
    @Query("type") type?: string
  ) {
    return this.questionsService.findWorkspaceQuestions(workspaceId, search, type);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get question details" })
  getQuestion(@Param("id") id: string) {
    return this.questionsService.findQuestionById(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update question prompt, options or marks" })
  updateQuestion(@Param("id") id: string, @Body() dto: UpdateQuestionDto) {
    return this.questionsService.updateQuestion(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete question from bank" })
  deleteQuestion(@Param("id") id: string) {
    return this.questionsService.deleteQuestion(id);
  }
}
