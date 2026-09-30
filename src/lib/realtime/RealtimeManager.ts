import { sampleTokens } from "../../data/tokens";
import { supabase } from "../supabaseClient";
import { readDashboardCache, writeDashboardCache } from "./dashboardCache";
import type { DashboardSnapshot, LiveEventName, RealtimeMessage, TapeToken } from "./types";

const CHANNEL = "synexus-live";

function sampleTape(): TapeToken[] {
  return sampleTokens.slice(0, 12).map((token) => ({
    id: token.id,
    symbol: token.symbol,
    name: token.name,
    mint: token.mintAddress ?? token.id,
    priceUsd: token.priceUsd,
    change24hPct: token.change24hPct,
    marketCapUsd: token.marketCapUsd ?? 0,
    liquidityUsd: token.liquidityUsd ?? 0,
    volume24hUsd: token.volume24hUsd ?? 0,
    safetyScore: token.guardianRisk === "SAFE" ? 78 : token.guardianRisk === "WARNING" ? 52 : 24,
    risk: token.guardianRisk,
    createdAt: 0,
  }));
}

function emptySnapshot(tokens: TapeToken[], source: DashboardSnapshot["source"]): DashboardSnapshot {
  return {
    updatedAt: Date.now(),
    source,
    connected: false,
    walletAddress: null,
    walletSol: null,
    tokens,
    alerts: [],
  };
}

function changed(prev: TapeToken, next: TapeToken): boolean {
  return (
    prev.priceUsd !== next.priceUsd ||
    prev.change24hPct !== next.change24hPct ||
    prev.marketCapUsd !== next.marketCapUsd ||
    prev.safetyScore !== next.safetyScore ||
    prev.liquidityUsd !== next.liquidityUsd ||
    prev.volume24hUsd !== next.volume24hUsd
  );
}

class RealtimeManager {
  private listeners = new Set<() => void>();
  private snapshot: DashboardSnapshot;
  private socket: WebSocket | null = null;
  private retryMs = 800;
  private pollTimer = 0;
  private started = false;
  private inflight: Promise<void> | null = null;
  private usingSocket = false;
  private channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

  constructor() {
    const cached = readDashboardCache();
    this.snapshot = cached?.tokens.length
      ? { ...cached, walletAddress: cached.walletAddress ?? null, walletSol: cached.walletSol ?? null }
      : emptySnapshot(sampleTape(), "sample");
  }

  getSnapshot = (): DashboardSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.start();
    return () => this.listeners.delete(listener);
  };

  start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    void this.refresh();
    this.openSocket();
    this.openBroadcast();
  }

  noteWallet(address: string | null, sol: number | null): void {
    if (this.snapshot.walletAddress === address && this.snapshot.walletSol === sol) return;
    this.commit({ ...this.snapshot, walletAddress: address, walletSol: sol });
    this.publish("WALLET_CHANGED", address ? `${address.slice(0, 4)} balance updated` : "Wallet cleared");
  }

  publish(name: LiveEventName, detail: string, mint?: string): void {
    const alerts = [`${name.replace(/_/g, " ")} · ${detail}`, ...this.snapshot.alerts].slice(0, 6);
    this.commit({ ...this.snapshot, alerts });
    const payload: RealtimeMessage = { type: "event", name, detail, mint };
    void this.channel?.send({ type: "broadcast", event: "synexus", payload });
  }

  refresh(): Promise<void> {
    if (this.inflight) return this.inflight;
    this.inflight = this.pull().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private commit(next: DashboardSnapshot): void {
    this.snapshot = next;
    writeDashboardCache(next);
    for (const listener of this.listeners) listener();
  }

  private mergeTokens(tokens: TapeToken[], source: DashboardSnapshot["source"]): void {
    if (!tokens.length) return;
    const prev = new Map(this.snapshot.tokens.map((token) => [token.mint, token]));
    let any = this.snapshot.tokens.length !== tokens.length;
    const next = tokens.map((token) => {
      const old = prev.get(token.mint);
      if (!old || changed(old, token)) any = true;
      return token;
    });
    if (!any && this.snapshot.source === "live") return;
    this.commit({ ...this.snapshot, tokens: next, source, updatedAt: Date.now() });
  }

  private applyMessage(message: RealtimeMessage): void {
    if (message.type === "snapshot" && message.dashboard.tokens?.length) {
      this.mergeTokens(message.dashboard.tokens, "live");
      return;
    }
    if (message.type === "patch") {
      const byMint = new Map(this.snapshot.tokens.map((token) => [token.mint, token]));
      let any = false;
      for (const token of message.tokens) {
        const old = byMint.get(token.mint);
        if (!old) {
          byMint.set(token.mint, token);
          any = true;
          continue;
        }
        if (changed(old, token)) {
          byMint.set(token.mint, token);
          any = true;
        }
      }
      if (!any) return;
      this.commit({
        ...this.snapshot,
        tokens: this.snapshot.tokens.map((token) => byMint.get(token.mint) ?? token),
        source: "live",
        updatedAt: message.updatedAt,
      });
      return;
    }
    if (message.type === "event") {
      const line = `${message.name.replace(/_/g, " ")} · ${message.detail}`;
      if (this.snapshot.alerts[0] === line) return;
      const alerts = [line, ...this.snapshot.alerts].slice(0, 6);
      this.commit({ ...this.snapshot, alerts });
    }
  }

  private async pull(): Promise<void> {
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) return;
      const data = (await response.json()) as { tokens?: TapeToken[] };
      if (data.tokens?.length) this.mergeTokens(data.tokens, "live");
    } catch {
      /* keep the cached tape */
    }
  }

  private schedulePoll(): void {
    if (this.pollTimer || this.usingSocket) return;
    this.pollTimer = window.setInterval(() => {
      if (!this.usingSocket) void this.refresh();
    }, 25_000);
  }

  private openSocket(): void {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    let socket: WebSocket;
    try {
      socket = new WebSocket(`${proto}://${window.location.host}/api/realtime/ws`);
    } catch {
      this.schedulePoll();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.usingSocket = true;
      this.retryMs = 800;
      if (this.pollTimer) {
        window.clearInterval(this.pollTimer);
        this.pollTimer = 0;
      }
      this.commit({ ...this.snapshot, connected: true });
    };
    socket.onmessage = (event) => {
      try {
        this.applyMessage(JSON.parse(String(event.data)) as RealtimeMessage);
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onclose = () => {
      this.usingSocket = false;
      if (this.socket === socket) this.socket = null;
      this.commit({ ...this.snapshot, connected: false });
      this.schedulePoll();
      window.setTimeout(() => this.openSocket(), this.retryMs);
      this.retryMs = Math.min(15_000, this.retryMs * 2);
    };
    socket.onerror = () => socket.close();
  }

  private openBroadcast(): void {
    if (!supabase) return;
    this.channel = supabase
      .channel(CHANNEL)
      .on("broadcast", { event: "synexus" }, ({ payload }) => {
        if (payload && typeof payload === "object" && "type" in payload) {
          this.applyMessage(payload as RealtimeMessage);
        }
      });
    this.channel.subscribe();
  }
}

export const realtime = new RealtimeManager();
