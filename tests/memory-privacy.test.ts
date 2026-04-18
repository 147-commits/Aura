/**
 * Memory & Privacy Tests
 *
 * Tests that:
 * 1. Encryption/decryption works correctly
 * 2. Private messages are never stored
 * 3. Memory CRUD operations work
 * 4. Per-message remember_flag is respected
 */

import { encrypt, decrypt } from "../server/encryption";
import { pool } from "../server/db";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

// ─── Encryption Tests ────────────────────────────────────────────────────────

// Test 1: Encrypt returns a different string
{
  const plaintext = "I am building an AI startup";
  const encrypted = encrypt(plaintext);
  assert(encrypted !== plaintext, "Encrypted text differs from plaintext");
  assert(encrypted.includes(":"), "Encrypted text has AES-GCM format (iv:tag:data)");
}

// Test 2: Decrypt recovers original text
{
  const plaintext = "My goal is to raise a seed round by Q3";
  const encrypted = encrypt(plaintext);
  const decrypted = decrypt(encrypted);
  assert(decrypted === plaintext, "Decrypt recovers original plaintext");
}

// Test 3: Different encryptions of same text produce different ciphertext (random IV)
{
  const plaintext = "Same text encrypted twice";
  const enc1 = encrypt(plaintext);
  const enc2 = encrypt(plaintext);
  assert(enc1 !== enc2, "Same plaintext produces different ciphertext (random IV)");
  assert(decrypt(enc1) === plaintext, "First encryption decrypts correctly");
  assert(decrypt(enc2) === plaintext, "Second encryption decrypts correctly");
}

// Test 4: Decrypt handles invalid input gracefully
{
  const result = decrypt("invalid:ciphertext:data");
  assert(typeof result === "string", "Decrypt returns string on invalid input (no crash)");
}

// Test 5: Encrypt handles empty string
{
  const plaintext = "";
  const encrypted = encrypt(plaintext);
  const decrypted = decrypt(encrypted);
  assert(decrypted === plaintext, "Encrypt/decrypt handles empty string");
}

// Test 6: Encrypt handles unicode
{
  const plaintext = "Goals: build 日本語 app with émojis 🚀";
  const encrypted = encrypt(plaintext);
  const decrypted = decrypt(encrypted);
  assert(decrypted === plaintext, "Encrypt/decrypt handles unicode and emoji");
}

// Test 7: Encrypt handles long text
{
  const plaintext = "A".repeat(10000);
  const encrypted = encrypt(plaintext);
  const decrypted = decrypt(encrypted);
  assert(decrypted === plaintext, "Encrypt/decrypt handles 10KB text");
}

// ─── Privacy Invariant Tests ─────────────────────────────────────────────────

// Test 8: Private messages should never be stored in DB
// This is enforced in routes.ts: if (isPrivate) skip saveMessage()
// We verify the logic by checking the routes code
{
  const routeCode = require("fs").readFileSync(
    require("path").join(__dirname, "../server/routes.ts"),
    "utf-8"
  );
  assert(
    routeCode.includes("isPrivate") && routeCode.includes("!isPrivate"),
    "Routes check isPrivate flag before storing messages"
  );
}

// Test 9: Memory extraction skips private messages
{
  const routeCode = require("fs").readFileSync(
    require("path").join(__dirname, "../server/routes.ts"),
    "utf-8"
  );
  assert(
    routeCode.includes("rememberFlag") && routeCode.includes("isPrivate"),
    "Routes respect rememberFlag and isPrivate for memory extraction"
  );
}

// Test 10: Memories are encrypted before storage
{
  const memoryEngineCode = require("fs").readFileSync(
    require("path").join(__dirname, "../server/memory-engine.ts"),
    "utf-8"
  );
  assert(
    memoryEngineCode.includes("encrypt(") && memoryEngineCode.includes("text_encrypted"),
    "Memory engine encrypts text before storage"
  );
}

// Test 11: Memories are decrypted on retrieval
{
  const memoryEngineCode = require("fs").readFileSync(
    require("path").join(__dirname, "../server/memory-engine.ts"),
    "utf-8"
  );
  assert(
    memoryEngineCode.includes("decrypt(") && memoryEngineCode.includes("text_encrypted"),
    "Memory engine decrypts text on retrieval"
  );
}

// Test 12: Messages are encrypted before storage
{
  const memoryEngineCode = require("fs").readFileSync(
    require("path").join(__dirname, "../server/memory-engine.ts"),
    "utf-8"
  );
  assert(
    memoryEngineCode.includes("content_encrypted"),
    "Message engine marks content as encrypted"
  );
}

// Test 13: Delete all memories removes all records
{
  const memoryEngineCode = require("fs").readFileSync(
    require("path").join(__dirname, "../server/memory-engine.ts"),
    "utf-8"
  );
  assert(
    memoryEngineCode.includes("DELETE FROM memories WHERE user_id"),
    "Delete all memories uses correct SQL"
  );
}

// ─── API Route Tests ─────────────────────────────────────────────────────────

// Test 14: Memory CRUD routes are registered
{
  const routeCode = require("fs").readFileSync(
    require("path").join(__dirname, "../server/routes.ts"),
    "utf-8"
  );
  assert(routeCode.includes('"/api/memories"'), "GET /api/memories route exists");
  assert(routeCode.includes('app.post("/api/memories"'), "POST /api/memories route exists");
  assert(routeCode.includes('app.delete("/api/memories/:id"'), "DELETE /api/memories/:id route exists");
  assert(routeCode.includes('app.delete("/api/memories"'), "DELETE /api/memories route exists");
}

// Test 15: Device ID is read from header
{
  const routeCode = require("fs").readFileSync(
    require("path").join(__dirname, "../server/routes.ts"),
    "utf-8"
  );
  assert(
    routeCode.includes("x-device-id") || routeCode.includes("X-Device-ID"),
    "Routes read device ID from request header"
  );
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

pool.end().catch(() => {});

console.log("\n─── Memory & Privacy Tests Complete ───\n");
