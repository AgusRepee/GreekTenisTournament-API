import '../src/envBootstrap.js';
import { prisma } from '../src/lib/prisma.js';

const TOURNAMENT_ID = 't-novak-l3';

const r = await prisma.matchResult.count({ where: { tournamentId: TOURNAMENT_ID } });
const schedules = await prisma.tournamentScheduleEntry.groupBy({
  by: ['scheduleStatus'],
  where: { tournamentId: TOURNAMENT_ID },
  _count: true,
});
const samples = await prisma.matchResult.findMany({
  where: { tournamentId: TOURNAMENT_ID },
  select: { dedupeKey: true, status: true, score: true },
  take: 10,
  orderBy: { updatedAt: 'desc' },
});
console.log('results', r);
console.log('schedules', schedules);
console.log('latest', samples);
await prisma.$disconnect();
