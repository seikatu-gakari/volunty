-- CreateEnum
CREATE TYPE "participation_mode" AS ENUM ('online', 'offline', 'hybrid');

-- AlterTable
ALTER TABLE "m_opportunity" ADD COLUMN "category" VARCHAR(50),
ADD COLUMN "participation_mode" "participation_mode";
