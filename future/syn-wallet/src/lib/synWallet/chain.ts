import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  type Keypair,
} from "@solana/web3.js";
import { SYN_WALLET_RPC_URL } from "../../config/synWallet";

let connection: Connection | null = null;

export function getSynWalletConnection(): Connection {
  if (!connection) {
    connection = new Connection(SYN_WALLET_RPC_URL, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60_000,
    });
  }
  return connection;
}

export type SynWalletBalance = {
  lamports: number;
  sol: number;
};

export type SynTokenBalance = {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number | null;
};

export async function fetchSolBalance(publicKey: string): Promise<SynWalletBalance> {
  const conn = getSynWalletConnection();
  const lamports = await conn.getBalance(new PublicKey(publicKey));
  return { lamports, sol: lamports / LAMPORTS_PER_SOL };
}

export async function fetchTokenBalances(publicKey: string): Promise<SynTokenBalance[]> {
  const conn = getSynWalletConnection();
  const owner = new PublicKey(publicKey);
  const res = await conn.getParsedTokenAccountsByOwner(owner, {
    programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  });
  return res.value
    .map(({ account }) => {
      const info = account.data.parsed.info;
      const amount: string = info.tokenAmount.amount;
      const decimals: number = info.tokenAmount.decimals;
      const uiAmount: number | null = info.tokenAmount.uiAmount;
      return {
        mint: info.mint as string,
        amount,
        decimals,
        uiAmount,
      };
    })
    .filter((t) => t.uiAmount != null && t.uiAmount > 0)
    .sort((a, b) => (b.uiAmount ?? 0) - (a.uiAmount ?? 0));
}

export async function fetchRecentSignatures(publicKey: string, limit = 12) {
  const conn = getSynWalletConnection();
  return conn.getSignaturesForAddress(new PublicKey(publicKey), { limit });
}

export async function sendSolTransfer(
  keypair: Keypair,
  toAddress: string,
  solAmount: number,
): Promise<string> {
  if (!Number.isFinite(solAmount) || solAmount <= 0) {
    throw new Error("Enter a valid SOL amount.");
  }
  const conn = getSynWalletConnection();
  const to = new PublicKey(toAddress.trim());
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: keypair.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: to,
      lamports,
    }),
  );
  tx.sign(keypair);
  const sig = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

export function jupiterSwapUrl(inputMint = "So11111111111111111111111111111111111111112"): string {
  return `https://jup.ag/swap/${inputMint}-USDC`;
}
