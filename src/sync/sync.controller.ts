import { Controller, Post, Get, Param, Res } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Response } from "express";
import { SyncService } from "./sync.service";
import { Public } from "../access/public.decorator";
import { Caller, type CbtCaller } from "../access/caller.decorator";
import { CbtAccessService } from "../access/cbt-access.service";

@ApiTags("Synchronization & Export")
@Controller("sync")
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly access: CbtAccessService,
  ) {}

  @Post("export-scores/:examId")
  @ApiOperation({ summary: "Sync submitted candidate scores directly to ParaLearn Core Term Report Cards" })
  async exportScoresToParaLearn(@Param("examId") examId: string, @Caller() caller: CbtCaller) {
    await this.access.assertExam(caller, examId);
    return this.syncService.exportExamScoresToParaLearn(examId);
  }

  @Get("export-csv/:examId")
  @ApiOperation({ summary: "Download CSV score sheet of all candidate attempts" })
  async exportCsv(@Param("examId") examId: string, @Res() res: Response, @Caller() caller: CbtCaller) {
    await this.access.assertExam(caller, examId);
    const csvContent = await this.syncService.exportExamScoresToCsv(examId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="cbt-exam-${examId}-scores.csv"`);
    res.status(200).send(csvContent);
  }
}
