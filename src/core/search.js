/**
 * Distributed Local Index for Search with Filters
 */
import { db } from './db.js';

export class SearchIndex {
  constructor() {
    this.index = new Map(); // local cache of searchable fields
  }

  async build() {
    const users = await db.getAll('users');
    users.forEach(u => this.update(u));
  }

  update(user) {
    if (!user || !user.id) return;
    // Indexing fields for quick search
    this.index.set(user.id, {
      name: user.name?.toLowerCase() || "",
      city: user.city?.toLowerCase() || "",
      age: user.age || 0,
      interests: user.interests?.map(i => i.toLowerCase()) || [],
      verified: !!user.verified,
      profession: user.profession?.toLowerCase() || "",
      did: user.id,
      phone: user.phone || ""
    });
  }

  search(filters) {
    return Array.from(this.index.values()).filter(u => {
      if (filters.name && !(u.name && u.name.includes(filters.name.toLowerCase()))) return false;
      if (filters.city && !(u.city && u.city.includes(filters.city.toLowerCase()))) return false;
      if (filters.minAge && u.age < filters.minAge) return false;
      if (filters.maxAge && u.age > filters.maxAge) return false;
      if (filters.verified !== undefined && u.verified !== filters.verified) return false;
      if (filters.interest && !u.interests.some(i => i.includes(filters.interest.toLowerCase()))) return false;
      if (filters.phone && !u.phone.includes(filters.phone)) return false;
      return true;
    });
  }
}

export const searchIndex = new SearchIndex();
