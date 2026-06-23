/**
 * Simple Merkle Tree for efficient P2P synchronization
 */
import { sha256 } from '../utils/crypto_utils.js';

export class MerkleTree {
  constructor(data = []) {
    this.leaves = data.map(d => typeof d === 'string' ? d : JSON.stringify(d))
                     .map(s => sha256(s))
                     .sort();
    this.tree = this.buildTree(this.leaves);
  }

  buildTree(leaves) {
    if (leaves.length === 0) return [sha256('')];
    if (leaves.length === 1) return leaves;

    const nextLevel = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = (i + 1 < leaves.length) ? leaves[i + 1] : left;
      nextLevel.push(sha256(left + right));
    }
    return this.buildTree(nextLevel);
  }

  getRoot() {
    return this.tree[0];
  }
}
