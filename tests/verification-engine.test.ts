/**
 * Verification Engine Tests — composite confidence and domain calibration.
 * Pure unit tests — no API calls.
 *
 * Run: npx tsx tests/verification-engine.test.ts
 */

import {
  computeCompositeConfidence,
  applyDomainCalibration,
  type CompositeSignals,
} from "../server/verification-engine";
import type { Confidence } from "../server/confidence-calibrator";

// ─── Test Harness ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failed++;
    process.exitCode = 1;
  } else {
    console.log(`  PASS: ${message}`);
    passed++;
  }
}

function describe(name: string, fn: () => void) {
  console.log(`\n━━━ ${name} ━━━`);
  fn();
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 1: computeCompositeConfidence()
// ═════════════════════════════════════════════════════════════════════════════

describe("computeCompositeConfidence() — threshold boundaries", () => {
  // All signals at 1.0 → should be High (100)
  {
    const result = computeCompositeConfidence({
      sourceAuthorityAvg: 1.0,
      crossSourceAgreement: 1.0,
      selfConsistencyScore: 1.0,
      retrievalRelevance: 1.0,
      domainCalibration: "High",
    });
    assert(result.score === 100, `All max → score 100 (got ${result.score})`);
    assert(result.level === "High", "All max → High");
  }

  // All signals at 0.0, domain Low → should be Low
  {
    const result = computeCompositeConfidence({
      sourceAuthorityAvg: 0.0,
      crossSourceAgreement: 0.0,
      selfConsistencyScore: 0.0,
      retrievalRelevance: 0.0,
      domainCalibration: "Low",
    });
    assert(result.score < 60, `All min → score < 60 (got ${result.score})`);
    assert(result.level === "Low", "All min → Low");
  }

  // Boundary: exactly 85 → High
  {
    const result = computeCompositeConfidence({
      sourceAuthorityAvg: 0.9,
      crossSourceAgreement: 0.9,
      selfConsistencyScore: 0.9,
      retrievalRelevance: 0.7,
      domainCalibration: "High",
    });
    assert(result.score >= 85, `High signals → score >= 85 (got ${result.score})`);
    assert(result.level === "High", "High signals → High");
  }

  // Medium range: 60-84
  {
    const result = computeCompositeConfidence({
      sourceAuthorityAvg: 0.7,
      crossSourceAgreement: 0.6,
      selfConsistencyScore: 0.6,
      retrievalRelevance: 0.5,
      domainCalibration: "Medium",
    });
    assert(result.score >= 60 && result.score < 85, `Medium signals → 60-84 (got ${result.score})`);
    assert(result.level === "Medium", "Medium signals → Medium");
  }

  // Low range: below 60
  {
    const result = computeCompositeConfidence({
      sourceAuthorityAvg: 0.3,
      crossSourceAgreement: 0.2,
      selfConsistencyScore: 0.3,
      retrievalRelevance: 0.2,
      domainCalibration: "Low",
    });
    assert(result.score < 60, `Low signals → score < 60 (got ${result.score})`);
    assert(result.level === "Low", "Low signals → Low");
  }
});

describe("computeCompositeConfidence() — weight verification", () => {
  // Source authority matters most (25%)
  {
    const highAuth = computeCompositeConfidence({
      sourceAuthorityAvg: 1.0, crossSourceAgreement: 0.5,
      selfConsistencyScore: 0.5, retrievalRelevance: 0.5, domainCalibration: "Medium",
    });
    const lowAuth = computeCompositeConfidence({
      sourceAuthorityAvg: 0.0, crossSourceAgreement: 0.5,
      selfConsistencyScore: 0.5, retrievalRelevance: 0.5, domainCalibration: "Medium",
    });
    assert(highAuth.score > lowAuth.score, "Higher source authority → higher score");
  }

  // Cross-source agreement matters equally (25%)
  {
    const highAgree = computeCompositeConfidence({
      sourceAuthorityAvg: 0.5, crossSourceAgreement: 1.0,
      selfConsistencyScore: 0.5, retrievalRelevance: 0.5, domainCalibration: "Medium",
    });
    const lowAgree = computeCompositeConfidence({
      sourceAuthorityAvg: 0.5, crossSourceAgreement: 0.0,
      selfConsistencyScore: 0.5, retrievalRelevance: 0.5, domainCalibration: "Medium",
    });
    assert(highAgree.score > lowAgree.score, "Higher agreement → higher score");
  }

  // Score is always 0-100
  {
    for (let i = 0; i < 10; i++) {
      const result = computeCompositeConfidence({
        sourceAuthorityAvg: Math.random(),
        crossSourceAgreement: Math.random(),
        selfConsistencyScore: Math.random(),
        retrievalRelevance: Math.random(),
        domainCalibration: (["High", "Medium", "Low"] as const)[Math.floor(Math.random() * 3)],
      });
      assert(result.score >= 0 && result.score <= 100, `Random signals → score in [0,100] (got ${result.score})`);
    }
  }
});

describe("computeCompositeConfidence() — domain calibration impact", () => {
  // Domain High vs Low — same other signals
  {
    const withHigh = computeCompositeConfidence({
      sourceAuthorityAvg: 0.7, crossSourceAgreement: 0.7,
      selfConsistencyScore: 0.7, retrievalRelevance: 0.7, domainCalibration: "High",
    });
    const withLow = computeCompositeConfidence({
      sourceAuthorityAvg: 0.7, crossSourceAgreement: 0.7,
      selfConsistencyScore: 0.7, retrievalRelevance: 0.7, domainCalibration: "Low",
    });
    assert(withHigh.score > withLow.score, "Domain High → higher score than Domain Low");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 2: applyDomainCalibration()
// ═════════════════════════════════════════════════════════════════════════════

describe("applyDomainCalibration() — downgrade only", () => {
  // Domain can downgrade High → Medium
  assert(applyDomainCalibration("High", "Medium") === "Medium", "Domain Medium downgrades High → Medium");

  // Domain can downgrade High → Low
  assert(applyDomainCalibration("High", "Low") === "Low", "Domain Low downgrades High → Low");

  // Domain can downgrade Medium → Low
  assert(applyDomainCalibration("Medium", "Low") === "Low", "Domain Low downgrades Medium → Low");

  // Domain CANNOT upgrade Low → Medium
  assert(applyDomainCalibration("Low", "Medium") === "Low", "Domain Medium does NOT upgrade Low");

  // Domain CANNOT upgrade Low → High
  assert(applyDomainCalibration("Low", "High") === "Low", "Domain High does NOT upgrade Low");

  // Domain CANNOT upgrade Medium → High
  assert(applyDomainCalibration("Medium", "High") === "Medium", "Domain High does NOT upgrade Medium");

  // Same level → no change
  assert(applyDomainCalibration("High", "High") === "High", "Same High → High");
  assert(applyDomainCalibration("Medium", "Medium") === "Medium", "Same Medium → Medium");
  assert(applyDomainCalibration("Low", "Low") === "Low", "Same Low → Low");
});

describe("applyDomainCalibration() — real-world scenarios", () => {
  // Finance: composite says High but domain says "never High for forecasts"
  assert(
    applyDomainCalibration("High", "Medium") === "Medium",
    "Finance forecast: composite High → domain downgrades to Medium"
  );

  // Engineering: composite says High for established pattern, domain agrees
  assert(
    applyDomainCalibration("High", "High") === "High",
    "Engineering established pattern: both agree → stays High"
  );

  // Marketing: composite Medium, domain says Low for viral prediction
  assert(
    applyDomainCalibration("Medium", "Low") === "Low",
    "Marketing viral: composite Medium → domain downgrades to Low"
  );
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`  Verification Engine: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);
