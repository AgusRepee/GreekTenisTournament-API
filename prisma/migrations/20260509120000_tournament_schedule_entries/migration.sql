-- CreateTable
CREATE TABLE `TournamentScheduleEntry` (
    `dedupeKey` VARCHAR(512) NOT NULL,
    `tournamentId` VARCHAR(64) NOT NULL,
    `leagueNum` INTEGER NOT NULL,
    `scheduleStatus` ENUM('unscheduled', 'scheduled', 'confirmed', 'rescheduled', 'postponed', 'cancelled', 'suspended') NOT NULL DEFAULT 'unscheduled',
    `date` VARCHAR(32) NULL,
    `time` VARCHAR(32) NULL,
    `venue` VARCHAR(256) NULL,
    `note` TEXT NULL,
    `confirmedAt` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TournamentScheduleEntry_tournamentId_idx`(`tournamentId`),
    PRIMARY KEY (`dedupeKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TournamentScheduleEntry` ADD CONSTRAINT `TournamentScheduleEntry_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
