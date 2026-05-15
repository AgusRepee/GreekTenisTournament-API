ALTER TABLE `AdminUser` ADD COLUMN `email` VARCHAR(255) NULL;
CREATE UNIQUE INDEX `AdminUser_email_key` ON `AdminUser`(`email`);

CREATE TABLE `AdminPasswordResetToken` (
  `id` VARCHAR(32) NOT NULL,
  `adminUserId` VARCHAR(32) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `AdminPasswordResetToken_tokenHash_key`(`tokenHash`),
  INDEX `AdminPasswordResetToken_adminUserId_idx`(`adminUserId`),
  INDEX `AdminPasswordResetToken_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AdminPasswordResetToken`
  ADD CONSTRAINT `AdminPasswordResetToken_adminUserId_fkey`
  FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
