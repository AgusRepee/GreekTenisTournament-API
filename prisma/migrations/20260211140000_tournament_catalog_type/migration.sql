-- AlterTable
ALTER TABLE `Tournament` ADD COLUMN `tournamentType` ENUM('greek500', 'masters1000') NOT NULL DEFAULT 'greek500';
