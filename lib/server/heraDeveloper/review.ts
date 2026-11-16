import type { DeveloperProposal } from "./store.js";

export function buildDailyReview(input: {
  day: string;
  cloudReason: string | null;
  openCount: number;
}): Omit<DeveloperProposal, "id" | "createdAt" | "status"> {
  const cloud = input.cloudReason ?? "Cursor Cloud Agents can be asked to plan on a separate branch.";
  return {
    title: `Daily development review ${input.day}`,
    discovery: cloud,
    changeSummary: "No code was written by the daily review.",
    why: "The review records system status for the owner. It does not change the production app.",
    testsPassed: "No production tests were required because no code changed.",
    testsFailed: "",
    benefits: "You get a daily status without a deploy.",
    risks: "A review can miss issues that were not checked. It does not prove the app is healthy.",
    ready: false,
    testedSha: `review-only-${input.day}`,
    branchName: "",
    sensitive: false,
    rollback: "No code changed, so there is nothing to roll back.",
  };
}
