// Script untuk cek migration status menggunakan direct connection (non-pooler)
// Ganti DATABASE_URL dengan direct URL (port 5432) sementara

import { PrismaClient } from '@prisma/client';

// Override env supaya pakai direct connection
process.env.DATABASE_URL = process.env.DATABASE_URL.replace(':6543/', ':5432/');

const prisma = new PrismaClient();

async function main() {
  try {
    // Check packages columns
    const pkgCols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'packages' 
      ORDER BY ordinal_position
    `);
    console.log('\n=== packages columns in DB ===');
    pkgCols.forEach(c => console.log(` - ${c.column_name}: ${c.data_type}`));

    // Check migrations applied
    const migrations = await prisma.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at, logs
      FROM _prisma_migrations 
      ORDER BY started_at DESC 
      LIMIT 20
    `);
    console.log('\n=== Migrations in DB ===');
    migrations.forEach(m => {
      const status = m.rolled_back_at ? 'ROLLED BACK' : (m.finished_at ? 'DONE' : 'PENDING/FAILED');
      console.log(` - ${m.migration_name}: ${status}`);
      if (m.logs) console.log(`   LOGS: ${m.logs}`);
    });

  } catch(e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
