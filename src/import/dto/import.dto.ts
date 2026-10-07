import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  IsOptional,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/** Step 1: Request classes from ParaLearn Core */
export class FetchImportableClassesDto {
  @ApiProperty({ description: "Workspace ID (must be INSTITUTION type)" })
  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @ApiProperty({
    description: "Admin/Teacher email registered in ParaLearn Core",
  })
  @IsString()
  @IsNotEmpty()
  email!: string;
}

/** Step 2: Import students from selected classes */
export class ImportCandidatesFromParalearnDto {
  @ApiProperty({ description: "Workspace ID (must be INSTITUTION type)" })
  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @ApiProperty({ description: "Target exam ID to import candidates into" })
  @IsString()
  @IsNotEmpty()
  examId!: string;

  @ApiProperty({
    description: "Admin/Teacher email registered in ParaLearn Core",
  })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "Class IDs to import students from",
    type: [String],
    example: ["cls_abc123", "cls_def456"],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  classIds!: string[];

  @ApiPropertyOptional({
    description:
      "If true, auto-generate 6-digit PINs for each candidate. Otherwise use their studentId.",
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  autoGeneratePin?: boolean;
}
