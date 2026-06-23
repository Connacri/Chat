import { CRDT } from '../src/core/crdt.js';

const local = { name: { val: 'Alice', ts: 100 } };
const remote = { name: { val: 'Bob', ts: 110 } };
const merged = CRDT.mergeObjects(local, remote);

if (merged.name.val === 'Bob') {
  console.log('CRDT LWW Merge Test Passed');
} else {
  console.error('CRDT LWW Merge Test Failed');
  process.exit(1);
}
