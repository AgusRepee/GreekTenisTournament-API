-- CreateTable
CREATE TABLE `Player` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(64) NOT NULL,
    `birthDate` DATE NULL,
    `nationality` VARCHAR(64) NULL,
    `playingHand` VARCHAR(16) NULL,
    `heightCm` INTEGER NULL,
    `profileBio` TEXT NULL,
    `profileImage` VARCHAR(512) NULL,
    `profileVisibility` ENUM('active', 'hidden') NOT NULL DEFAULT 'active',
    `rosterActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tournament` (
    `id` VARCHAR(64) NOT NULL,
    `slug` VARCHAR(128) NULL,
    `name` VARCHAR(255) NOT NULL,
    `status` ENUM('upcoming', 'finished') NOT NULL DEFAULT 'upcoming',
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `location` VARCHAR(255) NOT NULL,
    `coverImage` VARCHAR(255) NULL,
    `slotsTotal` INTEGER NULL,
    `slotsTaken` INTEGER NULL,
    `ligaDoc` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tournament_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TournamentLeague` (
    `id` VARCHAR(32) NOT NULL,
    `tournamentId` VARCHAR(64) NOT NULL,
    `leagueNum` INTEGER NOT NULL,

    INDEX `TournamentLeague_tournamentId_idx`(`tournamentId`),
    UNIQUE INDEX `TournamentLeague_tournamentId_leagueNum_key`(`tournamentId`, `leagueNum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Group` (
    `id` VARCHAR(32) NOT NULL,
    `tournamentId` VARCHAR(64) NOT NULL,
    `key` VARCHAR(32) NOT NULL,
    `displayName` VARCHAR(128) NOT NULL,

    INDEX `Group_tournamentId_idx`(`tournamentId`),
    UNIQUE INDEX `Group_tournamentId_key_key`(`tournamentId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupPlayer` (
    `groupId` VARCHAR(32) NOT NULL,
    `playerId` VARCHAR(64) NOT NULL,
    `seed` INTEGER NULL,

    PRIMARY KEY (`groupId`, `playerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Match` (
    `id` VARCHAR(64) NOT NULL,
    `tournamentId` VARCHAR(64) NOT NULL,
    `groupId` VARCHAR(32) NULL,
    `stage` ENUM('group', 'interzonal', 'quarterfinal', 'semifinal', 'final', 'repechage', 'other') NOT NULL DEFAULT 'other',
    `roundLabel` VARCHAR(128) NULL,
    `player1Id` VARCHAR(64) NOT NULL,
    `player2Id` VARCHAR(64) NOT NULL,
    `winnerId` VARCHAR(64) NULL,
    `score` VARCHAR(255) NOT NULL DEFAULT '',
    `scheduledDate` DATE NULL,
    `scheduledTime` VARCHAR(16) NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Match_tournamentId_idx`(`tournamentId`),
    INDEX `Match_groupId_idx`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MatchResult` (
    `id` VARCHAR(32) NOT NULL,
    `dedupeKey` VARCHAR(512) NOT NULL,
    `tournamentId` VARCHAR(64) NOT NULL,
    `matchId` VARCHAR(64) NULL,
    `groupKey` VARCHAR(64) NULL,
    `roundNum` INTEGER NULL,
    `playerA` VARCHAR(255) NOT NULL,
    `playerB` VARCHAR(255) NOT NULL,
    `score` TEXT NULL,
    `status` ENUM('pending', 'played', 'walkover', 'retired', 'suspended') NOT NULL DEFAULT 'pending',
    `playedAt` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MatchResult_dedupeKey_key`(`dedupeKey`),
    INDEX `MatchResult_tournamentId_idx`(`tournamentId`),
    INDEX `MatchResult_matchId_idx`(`matchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RankingSnapshot` (
    `id` VARCHAR(32) NOT NULL,
    `leagueNum` INTEGER NOT NULL,
    `payload` JSON NOT NULL,
    `computedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RankingSnapshot_leagueNum_computedAt_idx`(`leagueNum`, `computedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `News` (
    `id` VARCHAR(32) NOT NULL,
    `slug` VARCHAR(160) NULL,
    `title` VARCHAR(255) NOT NULL,
    `excerpt` TEXT NULL,
    `body` LONGTEXT NULL,
    `image` VARCHAR(512) NULL,
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `News_slug_key`(`slug`),
    INDEX `News_status_publishedAt_idx`(`status`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(32) NOT NULL,
    `actor` VARCHAR(128) NULL,
    `action` VARCHAR(64) NOT NULL,
    `entity` VARCHAR(64) NOT NULL,
    `entityId` VARCHAR(64) NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(128) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TournamentLeague` ADD CONSTRAINT `TournamentLeague_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Group` ADD CONSTRAINT `Group_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupPlayer` ADD CONSTRAINT `GroupPlayer_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupPlayer` ADD CONSTRAINT `GroupPlayer_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_player1Id_fkey` FOREIGN KEY (`player1Id`) REFERENCES `Player`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_player2Id_fkey` FOREIGN KEY (`player2Id`) REFERENCES `Player`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_winnerId_fkey` FOREIGN KEY (`winnerId`) REFERENCES `Player`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchResult` ADD CONSTRAINT `MatchResult_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchResult` ADD CONSTRAINT `MatchResult_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
