import fs from "node:fs";

const files = [
  "src/data/syntheticWatchers.ts",
  "src/lib/sentinelIntel.ts",
  "src/lib/oracleCryptoBrain.ts",
  "src/lib/oracleSupremeConversation.ts",
  "src/components/SynexusLiveScanner.tsx",
  "src/components/SynexusBootSequence.tsx",
  "src/config/titanGuidelines.ts",
  "src/config/site.ts",
  "src/config/sentinelAegis.ts",
  "src/lib/watcherVoice.ts",
  "src/lib/titanInstantCrypto.ts",
  "src/components/HomeEducationalHub.tsx",
  "src/components/OracleAdminControlCenter.tsx",
  "src/pages/About.tsx",
];

const reps = [
  [/from "\.\.\/config\/sentinelGuardian"/g, 'from "../config/sentinelHelix"'],
  [/answerGuardianWalletQuestion/g, "answerHelixQuestion"],
  [/buildGuardianWalletBrief/g, "buildHelixBrief"],
  [/assessGuardianPosture/g, "assessHelixPosture"],
  [/GUARDIAN_SENTINEL_NAME/g, "HELIX_SENTINEL_NAME"],
  [/GUARDIAN_SHORT_NAME/g, "HELIX_SHORT_NAME"],
  [/GUARDIAN_ROLE/g, "HELIX_ROLE"],
  [/GUARDIAN_LESSON/g, "HELIX_LESSON"],
  [/GUARDIAN_STATUS_IDLE/g, "HELIX_STATUS_IDLE"],
  [/id: "guardian"/g, 'id: "helix"'],
  [/laneId: "guardian"/g, 'laneId: "helix"'],
  [/sentinelById\(sentinels, "guardian"\)/g, 'sentinelById(sentinels, "helix")'],
  [/case "guardian":/g, 'case "helix":'],
  [/dirs\.guardian/g, "dirs.helix"],
  [/out\.guardian/g, "out.helix"],
  [/guardianSentinel/g, "helixSentinel"],
  [/guardianHits/g, "helixHits"],
  [/guardianStats/g, "helixStats"],
  [/guardianStatus/g, "helixStatus"],
  [/SENTINEL_LANES\.guardian/g, "SENTINEL_LANES.helix"],
  [/^  guardian: \{/gm, "  helix: {"],
  [/standby\.guardian|aegis:.*\n.*pulse:.*\n.*leviathan:.*\n.*cipher:.*\n.*guardian:/g, "SKIP"],
  [/Sentinel Guardian/g, "Sentinel Helix"],
  [/syn_wallet_guardian/g, "syn_wallet_helix"],
  [/SyN Wallet Guardian/g, "Helix — wallet security"],
  [/\|guardian\b/g, "|helix"],
  [/\bguardian\|/g, "helix|"],
  [/\/guardian\b/g, "/helix"],
  [/\bGuardian\b/g, "Helix"],
];

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log("missing", f);
    continue;
  }
  let t = fs.readFileSync(f, "utf8");
  const before = t;
  for (const [a, b] of reps) t = t.replace(a, b);
  if (t !== before) {
    fs.writeFileSync(f, t);
    console.log("updated", f);
  } else {
    console.log("unchanged", f);
  }
}
