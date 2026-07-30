import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/controllers/MasterController.ts', 'utf8');

content = content.replace(
  `let confidence = 0`,
  `const confidence = 0`
);

writeFileSync('src/controllers/MasterController.ts', content);
