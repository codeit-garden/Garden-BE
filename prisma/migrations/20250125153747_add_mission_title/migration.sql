/*
  Warnings:

  - You are about to drop the `Floriography` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `title` to the `Mission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "title" TEXT NOT NULL;

-- DropTable
DROP TABLE "Floriography";
