-- Nombres genéricos para jugadores sistema del cuadro KO (sin referencias a ligas concretas).
UPDATE `Player`
SET
  `name` = 'TBD',
  `displayName` = 'TBD',
  `updatedAt` = NOW(3)
WHERE
  `id` LIKE 'sys-ko-%'
  AND `id` <> 'sys-ko-bye';
