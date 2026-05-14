-- Jugadores sistema para huecos TBD del cuadro KO (FK en `Match` hasta avanzar ganadores).
INSERT INTO `Player` (`id`, `name`, `category`, `profileVisibility`, `rosterActive`, `createdAt`, `updatedAt`)
VALUES
  ('sys-ko-sf1a', 'TBD (SF1)', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-sf1b', 'TBD (SF1)', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-sf2a', 'TBD (SF2)', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-sf2b', 'TBD (SF2)', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-fa', 'TBD (Final)', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-fb', 'TBD (Final)', 'system', 'hidden', 0, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `updatedAt` = VALUES(`updatedAt`);
