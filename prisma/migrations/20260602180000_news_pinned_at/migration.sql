-- AlterTable
ALTER TABLE `News` ADD COLUMN `pinnedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `News_pinnedAt_idx` ON `News`(`pinnedAt`);
