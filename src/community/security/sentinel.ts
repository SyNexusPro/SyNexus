export type SentinelScanStatus =
  | "safe"
  | "warning"
  | "danger"
  | "unknown"
  | "not_scanned";

export type SentinelSignal = {
  code: string;
  weight: number;
  detail?: string;
};

export type SentinelScanResult = {
  status: SentinelScanStatus;
  score: number | null;
  provider: string | null;
  checkedAt: string | null;
  signals: SentinelSignal[];
};

export type UserRiskInput = {
  userId: string;
  accountCreatedAt?: string;
  duplicatePostCount?: number;
  postsLastHour?: number;
  commentsLastHour?: number;
  followsLastHour?: number;
  reportCount?: number;
  violationCount?: number;
};

export type PostRiskInput = {
  authorId: string;
  body: string;
  urls: string[];
  walletAddresses: string[];
  contractAddresses: string[];
  mentionCount: number;
};

const unavailableResult = (): SentinelScanResult => ({
  status: "not_scanned",
  score: null,
  provider: null,
  checkedAt: null,
  signals: [],
});

/**
 * Provider adapters are intentionally not simulated. Phase 4 will connect
 * server-side scanners; until then callers must display NOT SCANNED.
 */
export async function scanUrl(_url: string): Promise<SentinelScanResult> {
  return unavailableResult();
}

export async function scanWalletAddress(
  _address: string,
  _chain?: string,
): Promise<SentinelScanResult> {
  return unavailableResult();
}

export async function scanContractAddress(
  _address: string,
  _chain?: string,
): Promise<SentinelScanResult> {
  return unavailableResult();
}

export async function calculateUserRisk(
  _input: UserRiskInput,
): Promise<SentinelScanResult> {
  return unavailableResult();
}

export async function calculatePostRisk(
  _input: PostRiskInput,
): Promise<SentinelScanResult> {
  return unavailableResult();
}
