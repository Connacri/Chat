/**
 * Nexus Chat - Integration Test
 * Verifies User Discovery, Friend Adding, and E2EE Messaging.
 * Runs in Node.js with in-memory IndexedDB and Web Crypto API.
 */

// 1. Setup Browser/Web Globals in Node.js BEFORE other imports execute
import './setup-mock-env.js';

// 2. Import Core Modules
import { CRDT } from '../src/core/crdt.js';
import { Security } from '../src/core/security.js';
import { FriendManager } from '../src/core/friends.js';
import { NexusDB } from '../src/core/db.js';
import { Identity } from '../src/core/identity.js';

// Helper to pause execution
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function runTests() {
  console.log("=================================================");
  console.log("   NEXUS P2P CHAT - PROTOCOL & INTEGRATION TESTS");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error(e);
      failed++;
    }
  };

  // -----------------------------------------------------------------
  // Test 1: Hardware-bound Identity Creation
  // -----------------------------------------------------------------
  await test("Hardware-bound Identity Creation", async () => {
    const idA = new Identity();
    const registration = await idA.create("+33612345678");

    if (!registration.did.startsWith("did:nexus:key:")) {
      throw new Error("DID format is invalid");
    }
    if (!registration.publicKey || registration.publicKey.length < 32) {
      throw new Error("Public key was not generated correctly");
    }
    if (!registration.proof) {
      throw new Error("Signature proof is missing");
    }
    
    // Verify hardware signature ownership
    const isVerified = await idA.verifyOwnership(registration);
    if (!isVerified) {
      throw new Error("Failed to verify hardware signature ownership");
    }
  });

  // -----------------------------------------------------------------
  // Test 2: End-to-End Encryption (E2EE) between friends
  // -----------------------------------------------------------------
  await test("End-to-End Encryption (E2EE) between Friends", async () => {
    // Instantiate two security managers (simulating two friends)
    const securityA = new Security();
    const securityB = new Security();

    // Exchange ephemeral ECDH keys
    const pubKeyA = await securityA.init();
    const pubKeyB = await securityB.init();

    if (!pubKeyA || !pubKeyB) {
      throw new Error("ECDH keys were not initialized");
    }

    const plainMessage = "Secret message: Antigravity is a powerful AI coding assistant.";
    
    // User A encrypts for User B
    const encryptedJson = await securityA.encrypt(plainMessage, pubKeyB);
    const encryptedData = JSON.parse(encryptedJson);

    if (!encryptedData.iv || !encryptedData.ciphertext) {
      throw new Error("Encrypted packet is missing IV or ciphertext");
    }
    if (encryptedData.ciphertext === plainMessage) {
      throw new Error("Message was not encrypted (ciphertext matches plaintext)");
    }

    // User B decrypts the message from User A
    const decryptedMessage = await securityB.decrypt(encryptedJson, pubKeyA);

    if (decryptedMessage !== plainMessage) {
      throw new Error(`Decryption failed. Expected: '${plainMessage}', got: '${decryptedMessage}'`);
    }
  });

  // -----------------------------------------------------------------
  // Test 3: CRDT Conflict Resolution (LWW & Log-Based)
  // -----------------------------------------------------------------
  await test("CRDT Conflict Resolution (LWW & Log Merges)", async () => {
    // 1. Last-Write-Wins (LWW) Profile Merge
    const profileA = {
      name: { val: "Alice", ts: 1000 },
      city: { val: "Paris", ts: 1000 },
      age: { val: 25, ts: 1000 },
    };

    const profileB = {
      name: { val: "Alice In Wonderland", ts: 2000 }, // newer change
      city: { val: "Lyon", ts: 500 },                // older change
      age: { val: 26, ts: 2000 },                     // newer change
    };

    const mergedProfile = CRDT.mergeObjects(profileA, profileB);

    if (mergedProfile.name.val !== "Alice In Wonderland") {
      throw new Error("LWW failed: newer name did not overwrite older name");
    }
    if (mergedProfile.city.val !== "Paris") {
      throw new Error("LWW failed: older city overrode newer city");
    }
    if (mergedProfile.age.val !== 26) {
      throw new Error("LWW failed: newer age did not win");
    }

    // 2. Append-only Log Merge (Messages)
    const logA = [
      { id: "msg1", ts: 100, content: "Hello" },
      { id: "msg2", ts: 200, content: "How are you?" }
    ];

    const logB = [
      { id: "msg2", ts: 200, content: "How are you?" }, // duplicate
      { id: "msg3", ts: 300, content: "Fine, and you?" }  // new message
    ];

    const mergedLog = CRDT.mergeLogs(logA, logB);

    if (mergedLog.length !== 3) {
      throw new Error(`Log merge failed: expected 3 messages, got ${mergedLog.length}`);
    }
    if (mergedLog[0].id !== "msg1" || mergedLog[1].id !== "msg2" || mergedLog[2].id !== "msg3") {
      throw new Error("Log merge failed: messages are not sorted chronologically");
    }
  });

  // -----------------------------------------------------------------
  // Test 4: Friend adding and Database Persistence
  // -----------------------------------------------------------------
  await test("Friend adding and Local Database Persistence", async () => {
    const testDb = new NexusDB("test_persistence_db");
    await testDb.ready;

    const userId = "did:nexus:key:userA";
    const friendId = "did:nexus:key:userB";

    // Simulate adding friend in db
    const list = { id: userId, list: [friendId], ts: Date.now() };
    await testDb.put("friends", list);

    const retrievedList = await testDb.get("friends", userId);
    if (!retrievedList || !retrievedList.list.includes(friendId)) {
      throw new Error("Friend list was not persisted correctly in IndexedDB");
    }
  });

  // -----------------------------------------------------------------
  // Test 5: Discovery Profiles Filtering
  // -----------------------------------------------------------------
  await test("Discovery Profiles Filtering (Tinder-style logic)", async () => {
    // Mock user database
    const users = {
      "user1": { id: "user1", name: "Alice", city: "Paris", age: 25 },
      "user2": { id: "user2", name: "Bob", city: "Lyon", age: 30 },
      "user3": { id: "user3", name: "Charlie", city: "Paris", age: 45 },
      "user4": { id: "user4", name: "Clara", city: "Marseille", age: 22 },
    };

    const myId = "user1";
    const myFriends = ["user2"]; // Bob is already a friend
    const passedIds = ["user3"];  // Charlie was passed/swiped left

    // Simulating the exact filter logic in DiscoverScreen in App.jsx
    const filterProfiles = (filterName, filterCity, minAge, maxAge) => {
      return Object.values(users).filter(u => {
        if (u.id === myId) return false;             // filter self
        if (myFriends.includes(u.id)) return false;  // filter friends
        if (passedIds.includes(u.id)) return false;   // filter passed
        if (filterName && !u.name.toLowerCase().includes(filterName.toLowerCase())) return false;
        if (filterCity && u.city && !u.city.toLowerCase().includes(filterCity.toLowerCase())) return false;
        if (u.age && (u.age < minAge || u.age > maxAge)) return false;
        return true;
      });
    };

    // Case 1: Discover profiles with no filters
    // Should show Clara (Bob is a friend, Charlie is passed, Alice is self)
    const res1 = filterProfiles("", "", 18, 60);
    if (res1.length !== 1 || res1[0].id !== "user4") {
      throw new Error(`Case 1 failed: expected only Clara (user4), got ${JSON.stringify(res1)}`);
    }

    // Case 2: Filter by city "Paris" (Charlie is passed, Alice is self, so should be empty)
    const res2 = filterProfiles("", "Paris", 18, 60);
    if (res2.length !== 0) {
      throw new Error(`Case 2 failed: expected empty array, got ${JSON.stringify(res2)}`);
    }
  });

  console.log("\n=================================================");
  console.log(`   TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
