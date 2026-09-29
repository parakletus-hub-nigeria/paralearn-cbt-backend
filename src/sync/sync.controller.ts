import { Controller, Post, Get, Param, Res } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Response } from "express";
import { SyncService } from "./sync.service";

@ApiTags("Synchronization & Export")
@Controller("sync")
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post("export-scores/:examId")
  @ApiOperation({ summary: "Sync submitted candidate scores directly to ParaLearn Core Term Report Cards" })
  exportScoresToParaLearn(@Param("examId") examId: string) {
    return this.syncService.exportExamScoresToParaLearn(examId);
  }

  @Get("export-csv/:examId")
  @ApiOperation({ summary: "Download CSV score sheet of all candidate attempts" })
  async exportCsv(@Param("examId") examId: string, @Res() res: Response) {
    const csvContent = await this.syncService.exportExamScoresToCsv(examId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="cbt-exam-${examId}-scores.csv"`);
    res.status(200).send(csvContent);
  }
}
