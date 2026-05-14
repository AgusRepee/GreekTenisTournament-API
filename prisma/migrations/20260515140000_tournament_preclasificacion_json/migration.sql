-- Persistencia de snapshot de preclasificación (seeds) en torneo.
ALTER TABLE `Tournament` ADD COLUMN `preclasificacionJson` JSON NULL;
