-- Plantel de grupos editado desde admin + tópico de noticias
ALTER TABLE `Tournament` ADD COLUMN `groupRosterOverrideJson` JSON NULL;
ALTER TABLE `News` ADD COLUMN `topic` VARCHAR(32) NOT NULL DEFAULT 'General';
ALTER TABLE `News` MODIFY COLUMN `image` LONGTEXT NULL;
