import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ImportService } from "./import.service";
import {
  FetchImportableClassesDto,
  ImportCandidatesFromParalearnDto,
} from "./dto/import.dto";
import { Public } from "../access/public.decorator";
import { Caller, type CbtCaller } from "../access/caller.decorator";
import { CbtAccessService } from "../access/cbt-access.service";

@ApiTags("ParaLearn Import")
@Controller("import")
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly access: CbtAccessService,
  ) {}

  /**
   * Step 1: Admin clicks "Import from ParaLearn" →
   * Returns classes the user can access (role-scoped).
   */
  @Post("classes")
  @ApiOperation({
    summary: "Fetch importable classes from ParaLearn Core (role-scoped)",
    description:
      "Calls ParaLearn Core to resolve the user's role and return " +
      "the classes they have access to. Admins see all classes, " +
      "teachers see only their assigned classes.",
  })
  fetchImportableClasses(@Body() dto: FetchImportableClassesDto, @Caller() caller: CbtCaller) {
    return this.importService.fetchImportableClasses(
      this.access.workspaceFor(caller, dto.workspaceId),
      dto.email,
    );
  }

  /**
   * Step 2: Admin selects classes and confirms →
   * Fetches students and bulk-creates Candidate records.
   */
  @Post("candidates")
  @ApiOperation({
    summary:
      "Import students from selected ParaLearn classes into an exam roster",
    description:
      "Fetches students from the selected classes via ParaLearn Core, " +
      "auto-generates unique 6-digit PINs, and creates Candidate records " +
      "on the specified exam. Maps studentId for automatic score export.",
  })
  async importCandidates(@Body() dto: ImportCandidatesFromParalearnDto, @Caller() caller: CbtCaller) {
    const workspaceId = this.access.workspaceFor(caller, dto.workspaceId);
    await this.access.assertExam(caller, dto.examId);
    return this.importService.importCandidatesFromParalearn({
      workspaceId,
      examId: dto.examId,
      examTitle: dto.examTitle,
      email: dto.email,
      classIds: dto.classIds,
      autoGeneratePin: dto.autoGeneratePin,
    });
  }
}
