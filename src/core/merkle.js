/**
 * Simple Merkle Tree for efficient P2P synchronization
 *
 * BUG 4 FIX: sha256 is async (returns a Promise). The original synchronous
 * constructor/buildTree produced arrays of Promises instead of hashes, making
 * every root comparison meaningless. The class is now fully async via a static
 * factory method `MerkleTree.create(data)`.
 */
import { sha256 } from '../utils/crypto_utils.js';

export class MerkleTree {
  constructor() {
    this.leaves = [];
    this.root = null;
  }

  /**
   * Async factory — always use this instead of `new MerkleTree(data)`.
   * @param {Array} data - Items to hash into leaves (strings or JSON-serialisable objects)
   * @returns {Promise<MerkleTree>}
   */
  static async create(data = []) {
    const tree = new MerkleTree();
    const stringified = data.map(d => typeof d === 'string' ? d : JSON.stringify(d));
    tree.leaves = await Promise.all(stringified.map(s => sha256(s)));
    tree.leaves.sort();
    tree.root = await tree._buildTree(tree.leaves);
    return tree;
  }

  async _buildTree(leaves) {
    if (leaves.length === 0) return sha256('');
    if (leaves.length === 1) return leaves[0];
    const nextLevel = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = (i + 1 < leaves.length) ? leaves[i + 1] : left;
      nextLevel.push(await sha256(left + right));
    }
    return this._buildTree(nextLevel);
  }

  getRoot() {
    return this.root;
  }
}
