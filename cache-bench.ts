const map = new Map<string, string>();
const size = 10000;
for(let i=0; i<size; i++) {
  map.set(`hash${i}`, `val${i}`);
}

const start = Date.now();
for(let i=0; i<100000; i++) {
  const hash = `hash${i % size}`;
  const normalized = hash.toLowerCase().trim();
  map.get(normalized);
}
console.log('With normalize:', Date.now() - start);

const start2 = Date.now();
for(let i=0; i<100000; i++) {
  const hash = `hash${i % size}`;
  // if we know it's already normalized (or assume it is and normalize before entering hot loop)
  map.get(hash);
}
console.log('Without normalize:', Date.now() - start2);

// Let's also check substring optimization in resolveServerSeed
let logs = 0;
const start3 = Date.now();
for(let i=0; i<100000; i++) {
  const hash = `hash${i % size}`;
  const truncated = hash.slice(0, 16);
  logs++;
}
console.log('With slice:', Date.now() - start3);
