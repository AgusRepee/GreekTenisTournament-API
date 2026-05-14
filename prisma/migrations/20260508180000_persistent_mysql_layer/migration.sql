-- AlterTable Player
ALTER TABLE `Player` ADD COLUMN `firstName` VARCHAR(128) NULL,
    ADD COLUMN `lastName` VARCHAR(128) NULL,
    ADD COLUMN `displayName` VARCHAR(255) NULL;

-- AlterTable TournamentLeague
ALTER TABLE `TournamentLeague` ADD COLUMN `groupStageStatus` VARCHAR(32) NULL,
    ADD COLUMN `eliminationStatus` VARCHAR(32) NULL,
    ADD COLUMN `rulesJson` JSON NULL;

-- AlterTable Match
ALTER TABLE `Match` ADD COLUMN `tournamentLeagueId` VARCHAR(32) NULL,
    ADD COLUMN `scheduleStatus` ENUM('unscheduled', 'scheduled', 'confirmed', 'rescheduled', 'postponed', 'cancelled', 'suspended') NOT NULL DEFAULT 'unscheduled',
    ADD COLUMN `scheduledCourt` VARCHAR(128) NULL,
    ADD COLUMN `loserId` VARCHAR(64) NULL;

-- Indexes + FKs Match
CREATE INDEX `Match_tournamentLeagueId_idx` ON `Match`(`tournamentLeagueId`);
ALTER TABLE `Match` ADD CONSTRAINT `Match_tournamentLeagueId_fkey` FOREIGN KEY (`tournamentLeagueId`) REFERENCES `TournamentLeague`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Match` ADD CONSTRAINT `Match_loserId_fkey` FOREIGN KEY (`loserId`) REFERENCES `Player`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable MatchResult
ALTER TABLE `MatchResult` ADD COLUMN `setsJson` JSON NULL;

-- AlterTable AuditLog (campos auditoría extendidos)
ALTER TABLE `AuditLog` ADD COLUMN `tournamentId` VARCHAR(64) NULL,
    ADD COLUMN `league` VARCHAR(32) NULL,
    ADD COLUMN `beforeJson` JSON NULL,
    ADD COLUMN `afterJson` JSON NULL,
    ADD COLUMN `createdBy` VARCHAR(128) NULL;

CREATE INDEX `AuditLog_tournamentId_idx` ON `AuditLog`(`tournamentId`);

-- CreateTable EliminationBracket
CREATE TABLE `EliminationBracket` (
    `id` VARCHAR(32) NOT NULL,
    `tournamentLeagueId` VARCHAR(32) NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `bracketJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EliminationBracket_tournamentLeagueId_key`(`tournamentLeagueId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EliminationBracket` ADD CONSTRAINT `EliminationBracket_tournamentLeagueId_fkey` FOREIGN KEY (`tournamentLeagueId`) REFERENCES `TournamentLeague`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable LeagueRankingRow
CREATE TABLE `LeagueRankingRow` (
    `id` VARCHAR(32) NOT NULL,
    `playerId` VARCHAR(64) NOT NULL,
    `league` INTEGER NOT NULL,
    `points` INTEGER NOT NULL DEFAULT 0,
    `played` INTEGER NOT NULL DEFAULT 0,
    `wins` INTEGER NOT NULL DEFAULT 0,
    `losses` INTEGER NOT NULL DEFAULT 0,
    `titles` INTEGER NOT NULL DEFAULT 0,
    `finals` INTEGER NOT NULL DEFAULT 0,
    `statsJson` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LeagueRankingRow_league_idx`(`league`),
    UNIQUE INDEX `LeagueRankingRow_playerId_league_key`(`playerId`, `league`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LeagueRankingRow` ADD CONSTRAINT `LeagueRankingRow_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Torneo cerrado (IDs de jugadores, sin FK para permitir valores legacy/import)
ALTER TABLE `Tournament` ADD COLUMN `winnerId` VARCHAR(64) NULL,
    ADD COLUMN `finalistId` VARCHAR(64) NULL;
