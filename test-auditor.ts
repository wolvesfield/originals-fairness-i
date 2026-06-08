import { IntegrityAuditor } from './src/analysis/IntegrityAuditor.ts';

const auditor = new IntegrityAuditor();
auditor.registerSeed('test', 'hash123');

const startOld = Date.now();
for (let i = 0; i < 100000; i++) {
  const hash = 'hash123';
  const cached = auditor.resolveServerSeed(hash);
}
console.log('Old:', Date.now() - startOld);
