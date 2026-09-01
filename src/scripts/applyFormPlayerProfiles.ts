/**
 * Actualiza perfiles desde formulario (jun 2026) sin tocar rankings/puntos.
 * Match por ID de jugador existente; no crea duplicados.
 */
import '../envBootstrap.js';
import { prisma } from '../lib/prisma.js';
import { normPlayerCatalogKey } from '../lib/playerProfileCatalog.js';
import { recalculateRankings } from '../services/recalculateRankings.js';

type FormRow = {
  playerId: string;
  tournamentKey: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  nationality: string;
  playingHand: 'Derecha' | 'Zurdo';
  profileBio?: string;
  profileImage?: string;
  category?: string;
  createIfMissing?: boolean;
};

const FORM_ROWS: FormRow[] = [
  {
    playerId: 'p-l6nd-fedrjanic-n',
    tournamentKey: 'Fedrjanic N.',
    firstName: 'Nicolas',
    lastName: 'Fedrjanic',
    birthDate: '1994-11-08',
    nationality: 'Argentina',
    playingHand: 'Zurdo',
    profileBio: 'Apodo: Fersha · Revés: A dos manos',
    profileImage: 'players/nicolas-fedrjanic.webp',
  },
  {
    playerId: 'p-l4nd-garcia-j',
    tournamentKey: 'Garcia J.',
    firstName: 'Juan',
    lastName: 'Garcia',
    birthDate: '2004-10-25',
    nationality: 'Argentina',
    playingHand: 'Derecha',
    profileBio: 'Revés: A dos manos',
  },
  {
    playerId: 'p-l3-bianco-d',
    tournamentKey: 'Bianco D.',
    firstName: 'Diego',
    lastName: 'Bianco',
    birthDate: '1977-08-18',
    nationality: 'Argentina',
    playingHand: 'Derecha',
    profileBio: 'Revés: A una mano',
    profileImage: 'players/diego-bianco.webp',
  },
  {
    playerId: 'p-l5nd-gonzalez-dias-c',
    tournamentKey: 'González Días C.',
    firstName: 'Christian',
    lastName: 'Gonzalez Dias',
    birthDate: '1976-05-19',
    nationality: 'Argentina',
    playingHand: 'Derecha',
    profileBio: 'Apodo: Crispy · Revés: A dos manos',
    profileImage: 'players/christian-gonzalez-dias.webp',
  },
  {
    playerId: 'p-l1-araujo-j',
    tournamentKey: 'Araujo J.',
    firstName: 'Juan Manuel',
    lastName: 'Araujo',
    birthDate: '1980-02-14',
    nationality: 'Argentina',
    playingHand: 'Derecha',
    profileBio: 'Revés: A dos manos',
    profileImage: 'players/juan-manuel-araujo.webp',
  },
  {
    playerId: 'p-l1-alvarez-i',
    tournamentKey: 'Alvarez I.',
    firstName: 'Ivan',
    lastName: 'Alvarez',
    birthDate: '1971-08-10',
    nationality: 'Argentina',
    playingHand: 'Derecha',
    profileImage: 'players/ivan-alvarez.webp',
  },
  {
    playerId: 'p-l1-tacain-r',
    tournamentKey: 'Tacain R.',
    firstName: 'Roman',
    lastName: 'Tacain',
    birthDate: '2002-06-11',
    nationality: 'Argentina',
    playingHand: 'Derecha',
  },
  {
    playerId: 'p-l6nd-antuna-a',
    tournamentKey: 'Antuña A.',
    firstName: 'Alberto',
    lastName: 'Antuña',
    birthDate: '1987-10-25',
    nationality: 'Argentina',
    playingHand: 'Derecha',
    profileImage: 'players/alberto-antuna.webp',
  },
  {
    playerId: 'p-l2-molina-l',
    tournamentKey: 'Molina L.',
    firstName: 'Leonardo',
    lastName: 'Molina',
    birthDate: '1982-05-17',
    nationality: 'Argentina',
    playingHand: 'Derecha',
  },
  {
    playerId: 'p-l4-miletta-j',
    tournamentKey: 'Miletta J.',
    firstName: 'Juan Jose',
    lastName: 'Miletta',
    birthDate: '1972-08-08',
    nationality: 'Argentina',
    playingHand: 'Derecha',
    category: 'Cuarta',
    createIfMissing: true,
    profileImage: 'players/juan-jose-miletta.webp',
  },
];

async function main(): Promise<void> {
  const includePhotos = process.argv.includes('--with-photos');
  let updated = 0;
  let skipped = 0;

  for (const row of FORM_ROWS) {
    const byId = await prisma.player.findUnique({
      where: { id: row.playerId },
      select: { id: true, name: true, category: true },
    });

    let target = byId;
    if (!target) {
      const all = await prisma.player.findMany({ select: { id: true, name: true, displayName: true, category: true } });
      const key = normPlayerCatalogKey(row.tournamentKey);
      target =
        all.find(
          (p) => normPlayerCatalogKey(p.name) === key || normPlayerCatalogKey(p.displayName ?? '') === key,
        ) ?? null;
    }

    if (!target && row.createIfMissing) {
      const displayName = `${row.firstName} ${row.lastName}`.trim();
      const created = await prisma.player.create({
        data: {
          id: row.playerId,
          name: row.tournamentKey,
          category: row.category ?? 'Cuarta',
          firstName: row.firstName,
          lastName: row.lastName,
          displayName,
          nationality: row.nationality,
          playingHand: row.playingHand,
          birthDate: new Date(`${row.birthDate}T12:00:00.000Z`),
        },
      });
      target = { id: created.id, name: created.name, category: created.category };
      console.log(`[form-profiles] Creado ${row.tournamentKey} → ${displayName} (${created.id})`);
    }

    if (!target) {
      console.warn(`[form-profiles] No encontrado: ${row.tournamentKey} (${row.playerId})`);
      skipped += 1;
      continue;
    }

    const displayName = `${row.firstName} ${row.lastName}`.trim();
    await prisma.player.update({
      where: { id: target.id },
      data: {
        firstName: row.firstName,
        lastName: row.lastName,
        displayName,
        nationality: row.nationality,
        playingHand: row.playingHand,
        birthDate: new Date(`${row.birthDate}T12:00:00.000Z`),
        profileBio: row.profileBio ?? null,
        ...(includePhotos && row.profileImage ? { profileImage: row.profileImage } : {}),
      },
    });

    updated += 1;
    console.log(
      `[form-profiles] OK ${row.tournamentKey} → ${displayName} (${target.id})${includePhotos && row.profileImage ? ' + foto' : ''}`,
    );
  }

  const ranking = await recalculateRankings(prisma);
  console.log(
    `[form-profiles] Completado: ${updated} actualizados, ${skipped} omitidos; ${ranking.rowsWritten} filas de ranking recalculadas.${includePhotos ? '' : ' (sin fotos; usar --with-photos tras subir webp)'}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
