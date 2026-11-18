/**
 * Checks the Capacitor iOS app, then archives it for TestFlight when Xcode can sign.
 * The shell loads https://www.synexus.pro. It does not upload by itself.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = resolve(root, "ios/App/App.xcodeproj");
const plist = resolve(root, "ios/App/App/Info.plist");
const icon = resolve(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
const archive = resolve(root, "ios/App/build/SyNexus.xcarchive");

function fail(message) {
  console.error(message);
  process.exit(1);
}

const plistText = existsSync(plist) ? readFileSync(plist, "utf8") : "";
const required = [
  "NSMicrophoneUsageDescription",
  "NSSpeechRecognitionUsageDescription",
  "NSFaceIDUsageDescription",
  "ITSAppUsesNonExemptEncryption",
  "<string>SyNexus</string>",
];
for (const key of required) {
  if (!plistText.includes(key)) fail(`iOS Info.plist is missing ${key}`);
}
if (!existsSync(icon)) fail("iOS app icon is missing.");

const pbx = readFileSync(resolve(root, "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
if (!pbx.includes("PRODUCT_BUNDLE_IDENTIFIER = com.synexus.app;")) {
  fail("Bundle id is not com.synexus.app.");
}

let developerDir = "";
try {
  developerDir = execFileSync("xcode-select", ["-p"], { encoding: "utf8" }).trim();
} catch {
  developerDir = "";
}
if (!developerDir || developerDir.includes("CommandLineTools")) {
  fail(
    "The iOS project is ready, but Xcode.app is not installed.\n" +
      "Install Xcode from the App Store, then run: sudo xcode-select -s /Applications/Xcode.app\n" +
      "Sign in with the Apple Developer account in Xcode, set the team on the App target, and run npm run ios:testflight again.",
  );
}

let identities = "";
try {
  identities = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], { encoding: "utf8" });
} catch {
  identities = "";
}
if (!/Apple (Development|Distribution)/.test(identities)) {
  fail(
    "Xcode is installed, but this Mac has no Apple Development certificate.\n" +
      "Open ios/App/App.xcodeproj, select the App target, and choose your team under Signing.",
  );
}

execFileSync(
  "xcodebuild",
  [
    "-project",
    project,
    "-scheme",
    "App",
    "-configuration",
    "Release",
    "-destination",
    "generic/platform=iOS",
    "-archivePath",
    archive,
    "archive",
  ],
  { stdio: "inherit" },
);

console.log(`Archive ready: ${archive}`);
console.log("Open it in Xcode Organizer and choose Distribute App → TestFlight.");
