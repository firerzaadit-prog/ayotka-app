import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const tiers = [
  { minJumlah: 2, diskonPersen: 20, label: '2-9 siswa (diskon 20%)' },
  { minJumlah: 10, diskonPersen: 25, label: '10-49 siswa (diskon 25%)' },
  { minJumlah: 50, diskonPersen: 30, label: '50+ siswa (diskon 30%)' },
];
for (const t of tiers) {
  const r = await prisma.voucherPriceTier.upsert({ where: { minJumlah: t.minJumlah }, update: { diskonPersen: t.diskonPersen, label: t.label }, create: t });
  console.log('upserted:', r.label);
}
await prisma[${'$'}disconnect]();
console.log('Done!');
