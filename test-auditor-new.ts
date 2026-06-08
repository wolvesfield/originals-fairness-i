import { IntegrityAuditor } from './src/analysis/IntegrityAuditor.ts';

const auditor = new IntegrityAuditor();
auditor.registerSeed('test', 'hash123');

const startNew = Date.now();
for (let i = 0; i < 100000; i++) {
  const hash = 'hash123';
  // inline what resolveServerSeed does
  const normalizedHash = hash.toLowerCase().trim();
  const cached = auditor['localCache'].get(normalizedHash);
  // simulate the rest
}
console.log('New loop overhead:', Date.now() - startNew);

const startOpt = Date.now();
for (let i = 0; i < 100000; i++) {
  auditor.resolveServerSeed('hash123');
}
console.log('Opt:', Date.now() - startOpt);
