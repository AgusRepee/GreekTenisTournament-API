-- Partidos marcados manualmente por admin para la sección "Partidos importantes" (máx. 5).
ALTER TABLE `TournamentScheduleEntry` ADD COLUMN `featuredForHome` BOOLEAN NOT NULL DEFAULT false;
