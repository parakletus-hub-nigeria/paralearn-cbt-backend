import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsArray, ValidateNested, IsBoolean } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum QuestionTypeEnum {
  MCQ = "MCQ",
  TRUE_FALSE = "TRUE_FALSE",
  MULTI_SELECT = "MULTI_SELECT",
  ESSAY = "ESSAY",
}

export class QuestionOptionDto {
  @ApiProperty({ example: "opt_1" })
  @IsString()
  id!: string;

  @ApiProperty({ example: "Coulomb" })
  @IsString()
  text!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isCorrect!: boolean;

  @ApiPropertyOptional({ example: "A" })
  @IsString()
  @IsOptional()
  keyLabel?: string;
}

export class CreateQuestionDto {
  @ApiProperty({ description: "Workspace ID owning this question" })
  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @ApiProperty({ description: "Question prompt (supports Markdown & LaTeX formulas)", example: "What is the SI unit of electric charge?" })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({ enum: QuestionTypeEnum, default: QuestionTypeEnum.MCQ })
  @IsEnum(QuestionTypeEnum)
  @IsOptional()
  type?: QuestionTypeEnum;

  @ApiPropertyOptional({ default: 1.0 })
  @IsNumber()
  @IsOptional()
  marks?: number;

  @ApiProperty({ type: [QuestionOptionDto], description: "List of answer choices" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options!: QuestionOptionDto[];

  @ApiPropertyOptional({ description: "Explanation or solution note for candidate review", example: "Charge Q = I * t, measured in Coulombs (C)." })
  @IsString()
  @IsOptional()
  explanation?: string;
}

export class UpdateQuestionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  prompt?: string;

  @ApiPropertyOptional({ enum: QuestionTypeEnum })
  @IsEnum(QuestionTypeEnum)
  @IsOptional()
  type?: QuestionTypeEnum;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  marks?: number;

  @ApiPropertyOptional({ type: [QuestionOptionDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  explanation?: string;
}

export class BulkCreateQuestionsDto {
  @ApiProperty({ description: "Workspace ID" })
  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @ApiPropertyOptional({ description: "Optional exam ID to automatically attach newly created questions" })
  @IsString()
  @IsOptional()
  examId?: string;

  @ApiProperty({ type: [CreateQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions!: CreateQuestionDto[];
}
