/** Horarios mínimos para smoke API del bot (Novak L3). */
import '../src/envBootstrap.js';
import { prisma } from '../src/lib/prisma.js';

const TOURNAMENT_ID = 't-novak-l3';

const scheduled = [
  { key: 't-novak-l3|2|A|bocchicchio f.|pusterla p.', date: '2026-06-20', time: '18:00' },
  { key: 't-novak-l3|2|A|rusel s.|repecka a.', date: '2026-06-22', time: '20:00' },
  { key: 't-novak-l3|4|C|figueroa m.|vito c.', date: '2026-06-20', time: '19:00' },
  { key: 't-novak-l3|5|C|santi g.|del valle g.', date: '2026-06-21', time: '18:00' },
];

async function main() {
  for (const row of scheduled) {
    const updated = await prisma.tournamentScheduleEntry.updateMany({
      where: { dedupeKey: row.key, tournamentId: TOURNAMENT_ID },
      data: {
        scheduleStatus: 'scheduled',
        date: row.date,
        time: row.time,
      },
    });
    if (updated.count === 0) {
      console.warn('[seedSmokeAssistantSchedules] missing', row.key);
    }
  }
  console.log('[seedSmokeAssistantSchedules] OK', scheduled.length, 'horarios');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
