/**
 * Actualiza perfiles de jugadores desde catálogo embebido (jugadores.txt).
 */
import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { normPlayerCatalogKey, PLAYER_PROFILE_CATALOG } from '../lib/playerProfileCatalog.js';

async function main(): Promise<void> {
  const allPlayers = await prisma.player.findMany({
    select: { id: true, name: true, displayName: true },
  });
  const seenIds = new Set<string>();
  let updated = 0;
  let missing = 0;

  for (const row of PLAYER_PROFILE_CATALOG) {
    const key = normPlayerCatalogKey(row.tournamentKey);
    const hit = allPlayers.find(
      (p) => normPlayerCatalogKey(p.name) === key || normPlayerCatalogKey(p.displayName ?? '') === key,
    );
    if (!hit || seenIds.has(hit.id)) {
      if (!hit) {
        console.warn(`[seed-profiles] No encontrado: ${row.tournamentKey}`);
        missing += 1;
      }
      continue;
    }
    seenIds.add(hit.id);
    const displayName = `${row.firstName} ${row.lastName}`.trim();
    await prisma.player.update({
      where: { id: hit.id },
      data: {
        firstName: row.firstName,
        lastName: row.lastName,
        displayName,
        nationality: row.nationality,
        playingHand: row.playingHand,
        birthDate: new Date(`${row.birthDate}T12:00:00.000Z`),
        ...(row.profileImage ? { profileImage: row.profileImage } : {}),
      },
    });
    updated += 1;
    console.log(`[seed-profiles] OK ${row.tournamentKey} → ${displayName}`);
  }

  console.log(`[seed-profiles] Completado: ${updated} actualizados, ${missing} sin match`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
