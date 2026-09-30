-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('REGISTERED', 'STARTED', 'SUBMITTED', 'DISQUALIFIED');

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidatePin" TEXT NOT NULL,
    "studentId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'REGISTERED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_examId_candidatePin_key" ON "Candidate"("examId", "candidatePin");

-- CreateIndex
CREATE INDEX "Candidate_examId_status_idx" ON "Candidate"("examId", "status");

-- CreateIndex
CREATE INDEX "Candidate_studentId_idx" ON "Candidate"("studentId");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
