import { chmodSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Hostinger's post-server-migration environment can extract node_modules with the
 * execute bit stripped from downloaded native binaries. Prisma's schema-engine then
 * fails to spawn with EACCES during `prisma migrate deploy`, even though the file
 * exists and `prisma generate` (which doesn't spawn it) succeeds. Restoring +x is a
 * no-op on platforms where it's already set, and fs.chmodSync is safe to call on
 * Windows (where dev installs run) without throwing.
 */
const targets = [
  'node_modules/@prisma/engines',
  'node_modules/.prisma/client',
];

for (const dir of targets) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    try {
      if (statSync(full).isFile()) chmodSync(full, 0o755);
    } catch {
      // best-effort; never fail the install over this
    }
  }
}
