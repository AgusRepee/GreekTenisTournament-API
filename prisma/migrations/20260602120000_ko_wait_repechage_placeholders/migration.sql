-- Cupos pendientes de repechaje en cuartos (WAIT_RP_n ↔ sys-ko-wait-rp-n).
INSERT INTO `Player` (`id`, `name`, `category`, `profileVisibility`, `rosterActive`, `createdAt`, `updatedAt`)
VALUES
  ('sys-ko-wait-rp-0', 'Pendiente repechaje 0', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-wait-rp-1', 'Pendiente repechaje 1', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-wait-rp-2', 'Pendiente repechaje 2', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-wait-rp-3', 'Pendiente repechaje 3', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-wait-rp-4', 'Pendiente repechaje 4', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-wait-rp-5', 'Pendiente repechaje 5', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-wait-rp-6', 'Pendiente repechaje 6', 'system', 'hidden', 0, NOW(3), NOW(3)),
  ('sys-ko-wait-rp-7', 'Pendiente repechaje 7', 'system', 'hidden', 0, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `updatedAt` = VALUES(`updatedAt`);
