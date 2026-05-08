const sampleTransactions = [
  {
    type: "TRANSFER",
    signature: "4Yd8TQHozmxp1fT8KZy7pVvsc2wq3q1",
    timestamp: Date.now() / 1000 - 7200,
    nativeTransfers: [{ fromUserAccount: "M2mx93...", toUserAccount: "8VnLkP...", amount: 12000000 }],
    tokenTransfers: [],
    source: "SYSTEM_PROGRAM",
    fee: 5000,
    transactionError: null
  },
  {
    type: "SWAP",
    signature: "2ad7KZ1Wpulse8nXcV8xYHk7Vq9",
    timestamp: Date.now() / 1000 - 11400,
    nativeTransfers: [],
    tokenTransfers: [
      { fromUserAccount: "M2mx93...", toUserAccount: "JUP6Lk...", tokenAmount: 24.1, mint: "USDC" },
      { fromUserAccount: "JUP6Lk...", toUserAccount: "M2mx93...", tokenAmount: 0.42, mint: "SOL" }
    ],
    source: "JUPITER",
    fee: 8000,
    transactionError: null
  },
  {
    type: "TRANSFER",
    signature: "8tNw1DustM5Ud7aYp2sQ",
    timestamp: Date.now() / 1000 - 12400,
    nativeTransfers: [{ fromUserAccount: "TinySenderA", toUserAccount: "M2mx93...", amount: 1000 }],
    tokenTransfers: [],
    source: "SYSTEM_PROGRAM",
    fee: 5000,
    transactionError: null
  },
  {
    type: "TRANSFER",
    signature: "9dNw2DustM5Ud7aYp2sQ",
    timestamp: Date.now() / 1000 - 12700,
    nativeTransfers: [{ fromUserAccount: "TinySenderB", toUserAccount: "M2mx93...", amount: 1200 }],
    tokenTransfers: [],
    source: "SYSTEM_PROGRAM",
    fee: 5000,
    transactionError: null
  },
  {
    type: "TRANSFER",
    signature: "7PoisonLookalike5Ud7aYp2sQ",
    timestamp: Date.now() / 1000 - 12820,
    nativeTransfers: [{ fromUserAccount: "M2mxPoisonRoute9xQeWvGfakeaF7K", toUserAccount: "M2mx93...", amount: 900 }],
    tokenTransfers: [],
    source: "SYSTEM_PROGRAM",
    fee: 5000,
    transactionError: null
  },
  {
    type: "UNKNOWN",
    signature: "5ScaryProgramXw4mH7",
    timestamp: Date.now() / 1000 - 16100,
    nativeTransfers: [],
    tokenTransfers: [{ fromUserAccount: "M2mx93...", toUserAccount: "RiskyVault111", tokenAmount: 2.2, mint: "UNKNOWN" }],
    source: "UNVERIFIED_PROGRAM",
    fee: 12000,
    transactionError: null
  },
  {
    type: "TRANSFER",
    signature: "3OkTx3nK1qX4",
    timestamp: Date.now() / 1000 - 19000,
    nativeTransfers: [{ fromUserAccount: "M2mx93...", toUserAccount: "KnownExchange", amount: 5500000 }],
    tokenTransfers: [],
    source: "SYSTEM_PROGRAM",
    fee: 5000,
    transactionError: null
  },
  {
    type: "TRANSFER",
    signature: "6Fail9GzHnP",
    timestamp: Date.now() / 1000 - 22000,
    nativeTransfers: [],
    tokenTransfers: [],
    source: "TOKEN_PROGRAM",
    fee: 5000,
    transactionError: { InstructionError: [1, "Custom"] }
  }
];

const knownRiskyPrograms = new Set([
  "UNVERIFIED_PROGRAM",
  "RiskyVault111",
  "FakeAirdropRouter",
  "MixerBridge"
]);

// Public-blocklist of wallets flagged in security reports.
const knownRiskyAddresses = new Set([
  "GKJBELftW5Rjg24wP88NRaKGsEBtrPLgMiv3DhbJwbzQ"
]);

const knownGoodProgramAliases = new Set([
  "SYSTEM_PROGRAM",
  "TOKEN_PROGRAM",
  "ASSOCIATED_TOKEN_PROGRAM",
  "JUPITER",
  "JUPITER_V6",
  "RAYDIUM",
  "RAYDIUM_AMM",
  "RAYDIUM_CLMM",
  "ORCA",
  "ORCA_WHIRLPOOLS",
  "PHOENIX",
  "MAGIC_EDEN",
  "TENSOR",
  "PHANTOM",
  "PUMP_FUN",
  "OKX",
  "OKX_DEX",
  "DRIFT",
  "MANGO"
]);

const knownGoodProgramIds = new Set([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
]);

const knownGoodProgramPrefixes = [
  "JUP6Lk",
  "whirLb",
  "CAMMCz",
  "675kPX",
  "6EF8rr"
];

const activeTraderProgramTypes = new Set([
  "SWAP",
  "NFT_SALE",
  "NFT_LISTING",
  "NFT_BID",
  "NFT_CANCEL_LISTING",
  "COMPRESSED_NFT_MINT"
]);

const state = {
  mode: "sample",
  lastReport: null,
  animationTick: 0
};

const nodes = {
  form: document.querySelector("#scan-form"),
  wallet: document.querySelector("#wallet-address"),
  heliusKey: document.querySelector("#helius-key"),
  elevenKey: document.querySelector("#eleven-key"),
  voiceId: document.querySelector("#voice-id"),
  historyLimit: document.querySelector("#history-limit"),
  statusLine: document.querySelector("#status-line"),
  verdictCard: document.querySelector("#verdict-card"),
  verdictTitle: document.querySelector("#verdict-title"),
  riskScore: document.querySelector("#risk-score"),
  riskSummary: document.querySelector("#risk-summary"),
  signalsList: document.querySelector("#signals-list"),
  signalCount: document.querySelector("#signal-count"),
  reasoningText: document.querySelector("#reasoning-text"),
  nextAction: document.querySelector("#next-action"),
  dataSource: document.querySelector("#data-source"),
  transactionCount: document.querySelector("#transaction-count"),
  activityTable: document.querySelector("#activity-table"),
  signalTemplate: document.querySelector("#signal-template"),
  promptButton: document.querySelector("#prompt-button"),
  aiButton: document.querySelector("#ai-button"),
  openaiKey: document.querySelector("#openai-key"),
  openaiModel: document.querySelector("#openai-model"),
  voiceButton: document.querySelector("#voice-button"),
  canvas: document.querySelector("#pulse-canvas"),
  simulationInput: document.querySelector("#simulation-input"),
  simulateButton: document.querySelector("#simulate-button"),
  simulationStatus: document.querySelector("#simulation-status"),
  simulationSummary: document.querySelector("#simulation-summary"),
  simulationChanges: document.querySelector("#simulation-changes"),
  simulationMeta: document.querySelector("#simulation-meta"),
  txVerdictCard: document.querySelector("#tx-verdict-card"),
  txVerdictTitle: document.querySelector("#tx-verdict-title"),
  txRiskScore: document.querySelector("#tx-risk-score"),
  combinedWarning: document.querySelector("#combined-warning"),
  combinedWarningText: document.querySelector("#combined-warning-text")
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shorten(value = "") {
  if (value.length <= 16) return value || "unknown";
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function lamportsToSol(lamports = 0) {
  return Number(lamports) / 1_000_000_000;
}

function formatAmount(tx) {
  const native = tx.nativeTransfers?.[0];
  if (native) return `${lamportsToSol(native.amount).toFixed(5)} SOL`;
  const token = tx.tokenTransfers?.[0];
  if (token) return `${Number(token.tokenAmount || 0).toFixed(4)} ${token.mint || "token"}`;
  return "none";
}

function getCounterparty(tx, walletAddress) {
  const native = tx.nativeTransfers?.[0];
  if (native) {
    return native.fromUserAccount?.includes(walletAddress.slice(0, 6))
      ? native.toUserAccount
      : native.fromUserAccount;
  }

  const token = tx.tokenTransfers?.[0];
  if (token) {
    return token.fromUserAccount?.includes(walletAddress.slice(0, 6))
      ? token.toUserAccount
      : token.fromUserAccount;
  }

  return tx.accountData?.[0]?.account || tx.source || "unknown";
}

function getTransactionAccounts(tx) {
  const accounts = [];
  tx.nativeTransfers?.forEach((transfer) => {
    accounts.push(transfer.fromUserAccount, transfer.toUserAccount);
  });
  tx.tokenTransfers?.forEach((transfer) => {
    accounts.push(transfer.fromUserAccount, transfer.toUserAccount, transfer.mint);
  });
  tx.accountData?.forEach((account) => {
    accounts.push(account.account);
  });
  return accounts.filter(Boolean).map(String);
}

function looksLikeSolanaAddress(value = "") {
  return /^[1-9A-HJ-NP-Za-km-z]{16,64}$/.test(value);
}

function isLookalikeAddress(candidate = "", target = "", edgeLength = 4) {
  if (!looksLikeSolanaAddress(candidate) || !looksLikeSolanaAddress(target)) return false;
  if (candidate === target || candidate.length < edgeLength * 2 + 4 || target.length < edgeLength * 2 + 4) return false;
  return candidate.slice(0, edgeLength) === target.slice(0, edgeLength)
    && candidate.slice(-edgeLength) === target.slice(-edgeLength)
    && candidate.slice(edgeLength, -edgeLength) !== target.slice(edgeLength, -edgeLength);
}

function getTransferStats(tx, walletAddress) {
  let inbound = 0;
  let outbound = 0;
  const outboundRecipients = new Set();
  const walletPrefix = walletAddress.slice(0, 6);

  tx.nativeTransfers?.forEach((transfer) => {
    const amount = lamportsToSol(transfer.amount);
    if (String(transfer.toUserAccount || "").includes(walletPrefix)) inbound += amount;
    if (String(transfer.fromUserAccount || "").includes(walletPrefix)) {
      outbound += amount;
      if (transfer.toUserAccount) outboundRecipients.add(transfer.toUserAccount);
    }
  });

  tx.tokenTransfers?.forEach((transfer) => {
    const amount = Number(transfer.tokenAmount || 0);
    if (String(transfer.toUserAccount || "").includes(walletPrefix)) inbound += amount;
    if (String(transfer.fromUserAccount || "").includes(walletPrefix)) {
      outbound += amount;
      if (transfer.toUserAccount) outboundRecipients.add(transfer.toUserAccount);
    }
  });

  return { inbound, outbound, outboundRecipients };
}

function getProgram(tx) {
  return tx.source || tx.instructions?.[0]?.programId || tx.type || "UNKNOWN";
}

function isKnownGoodProgram(program = "") {
  const normalized = String(program).trim();
  const upper = normalized.toUpperCase().replaceAll(" ", "_").replaceAll("-", "_");
  return knownGoodProgramAliases.has(upper)
    || knownGoodProgramIds.has(normalized)
    || knownGoodProgramPrefixes.some((prefix) => normalized.startsWith(prefix));
}

function isRiskyProgram(program = "") {
  const normalized = String(program).trim();
  const upper = normalized.toUpperCase().replaceAll(" ", "_").replaceAll("-", "_");
  return knownRiskyPrograms.has(normalized) || knownRiskyPrograms.has(upper);
}

function isLikelyTraderTransaction(tx) {
  return isKnownGoodProgram(getProgram(tx)) || activeTraderProgramTypes.has(String(tx.type || "").toUpperCase());
}

function normalizeHeliusTransaction(tx) {
  return {
    type: tx.type || "UNKNOWN",
    signature: tx.signature,
    timestamp: tx.timestamp,
    nativeTransfers: tx.nativeTransfers || [],
    tokenTransfers: tx.tokenTransfers || [],
    source: tx.source || tx.instructions?.[0]?.programId || "UNKNOWN",
    fee: tx.fee,
    transactionError: tx.transactionError || null,
    accountData: tx.accountData || []
  };
}

async function parseJsonResponse(response, serviceName) {
  const contentType = response.headers.get("content-type") || "";
  const bodyText = await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error(`${serviceName} returned HTML instead of JSON. Start the demo with "python3 server.py" so the local API routes are available.`);
  }

  try {
    return bodyText ? JSON.parse(bodyText) : null;
  } catch (error) {
    throw new Error(`${serviceName} returned invalid JSON.`);
  }
}

async function fetchLiveTransactions(walletAddress, apiKey, limit) {
  const extractMessage = (payload, fallback) => {
    if (!payload) return fallback;
    return (typeof payload.error === "string" && payload.error)
      || payload.error?.message
      || payload.message
      || (typeof payload.detail === "string" && payload.detail)
      || payload.detail?.message
      || fallback;
  };

  if (!apiKey && location.protocol !== "file:") {
    const localResponse = await fetch("/api/helius/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, limit })
    });

    const localPayload = await parseJsonResponse(localResponse, "Local Helius proxy");
    if (!localResponse.ok) {
      throw new Error(extractMessage(localPayload, `Local Helius proxy returned ${localResponse.status}`));
    }
    if (!Array.isArray(localPayload)) {
      throw new Error(extractMessage(localPayload, "Local Helius proxy returned an unexpected response."));
    }
    return localPayload.map(normalizeHeliusTransaction);
  }

  if (!apiKey) {
    throw new Error("Live mode needs a Helius API key.");
  }

  // Use the documented Enhanced Transactions REST endpoint as the source of truth.
  const params = new URLSearchParams({
    "api-key": apiKey,
    "limit": String(limit),
    "sort-order": "desc"
  });

  const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${encodeURIComponent(walletAddress)}/transactions?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    let detail = `Helius returned ${response.status}.`;
    try {
      const errorBody = await response.clone().json();
      // Helius can return strings or nested objects under various keys.
      const upstreamMessage =
        (typeof errorBody?.error === "string" && errorBody.error)
        || errorBody?.error?.message
        || errorBody?.message
        || (typeof errorBody?.detail === "string" && errorBody.detail)
        || errorBody?.detail?.message
        || "";
      if (upstreamMessage) detail += ` ${String(upstreamMessage).slice(0, 240)}`;
    } catch { /* upstream wasn't JSON, ignore */ }
    if (response.status === 400) detail += " The wallet address is likely malformed or rejected by Helius.";
    if (response.status === 401 || response.status === 403) detail += " The Helius API key looks invalid or restricted.";
    if (response.status === 429) detail += " Rate limit hit; wait a moment and retry.";
    throw new Error(detail);
  }

  const payload = await parseJsonResponse(response, "Helius");

  if (!Array.isArray(payload)) {
    const fallbackMessage =
      (typeof payload?.error === "string" && payload.error)
      || payload?.error?.message
      || payload?.message
      || "Helius returned an unexpected response.";
    throw new Error(fallbackMessage);
  }

  return payload.map(normalizeHeliusTransaction);
}

async function fetchWalletFirstSeenTimestamp(walletAddress, apiKey) {
  if (!apiKey && location.protocol !== "file:") {
    const response = await fetch("/api/helius/first-seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress })
    });
    const payload = await parseJsonResponse(response, "Local wallet-age proxy");
    if (!response.ok) return null;
    return payload?.firstSeenTimestamp || null;
  }

  if (!apiKey) return null;

  let before;
  let oldest = null;

  for (let page = 0; page < 8; page += 1) {
    const options = { limit: 1000 };
    if (before) options.before = before;

    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `walletpulse-age-${page}`,
        method: "getSignaturesForAddress",
        params: [walletAddress, options]
      })
    });

    if (!response.ok) return null;
    const payload = await parseJsonResponse(response, "Wallet-age RPC");
    const signatures = payload?.result;
    if (!Array.isArray(signatures) || signatures.length === 0) break;

    const dated = signatures.filter((signature) => signature.blockTime);
    if (dated.length) oldest = dated[dated.length - 1].blockTime;
    before = signatures[signatures.length - 1]?.signature;
    if (signatures.length < options.limit) break;
  }

  return oldest;
}

function makeSignal(severity, title, detail, points) {
  return { severity, title, detail, points };
}

function getWalletAgeDays(transactions, firstSeenTimestamp = null) {
  const datedTransactions = transactions.filter((tx) => tx.timestamp);
  const oldestObservedTimestamp = datedTransactions.reduce((oldest, tx) => Math.min(oldest, tx.timestamp), Number.POSITIVE_INFINITY);
  const timestamp = firstSeenTimestamp || (Number.isFinite(oldestObservedTimestamp) ? oldestObservedTimestamp : null);
  return timestamp ? (Date.now() / 1000 - timestamp) / (24 * 60 * 60) : null;
}

function getLargeOutboundTransfers(transactions, walletAddress) {
  return transactions
    .filter((tx) => {
      const nativeOut = tx.nativeTransfers?.some((transfer) => {
        const fromWallet = String(transfer.fromUserAccount || "").includes(walletAddress.slice(0, 6));
        return fromWallet && lamportsToSol(transfer.amount) >= 1;
      });
      const tokenOut = tx.tokenTransfers?.some((transfer) => {
        const fromWallet = String(transfer.fromUserAccount || "").includes(walletAddress.slice(0, 6));
        return fromWallet && Number(transfer.tokenAmount || 0) >= 1000;
      });
      return nativeOut || tokenOut;
    })
    .filter((tx) => tx.timestamp)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function getLargestRapidOutboundCluster(transactions, walletAddress, windowSeconds = 45) {
  const outbound = getLargeOutboundTransfers(transactions, walletAddress);
  let largestCluster = [];

  outbound.forEach((tx, index) => {
    const cluster = outbound.slice(index).filter((candidate) => candidate.timestamp - tx.timestamp <= windowSeconds);
    if (cluster.length > largestCluster.length) largestCluster = cluster;
  });

  return largestCluster;
}

function findAddressPoisoningSignals(transactions, walletAddress) {
  const counterpartiesBySignature = transactions.map((tx) => ({
    tx,
    counterparty: getCounterparty(tx, walletAddress)
  })).filter(({ counterparty }) => looksLikeSolanaAddress(counterparty));

  const directLookalikes = counterpartiesBySignature.filter(({ counterparty }) => isLookalikeAddress(counterparty, walletAddress));
  const groups = new Map();

  counterpartiesBySignature.forEach(({ tx, counterparty }) => {
    const key = `${counterparty.slice(0, 4)}:${counterparty.slice(-4)}`;
    const existing = groups.get(key) || [];
    existing.push({ tx, counterparty });
    groups.set(key, existing);
  });

  const pairedLookalikes = Array.from(groups.values())
    .filter((group) => new Set(group.map(({ counterparty }) => counterparty)).size > 1)
    .flat();

  const combined = [...directLookalikes, ...pairedLookalikes];
  const unique = new Map();
  combined.forEach((item) => unique.set(`${item.tx.signature}:${item.counterparty}`, item));
  return Array.from(unique.values());
}

function findVanityTrustSuffixAccounts(transactions) {
  const systemProgramId = "11111111111111111111111111111111";
  const suspicious = [];

  transactions.forEach((tx) => {
    getTransactionAccounts(tx).forEach((account) => {
      if (account === systemProgramId || knownGoodProgramIds.has(account)) return;
      if (looksLikeSolanaAddress(account) && account.endsWith("11111")) {
        suspicious.push({ tx, account });
      }
    });
  });

  return suspicious;
}

function findRapidDispersion(transactions, walletAddress, windowSeconds = 10 * 60) {
  const dated = transactions
    .filter((tx) => tx.timestamp)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  let strongest = { inboundTx: null, outboundTxs: [], recipients: new Set() };

  dated.forEach((tx, index) => {
    const stats = getTransferStats(tx, walletAddress);
    if (stats.inbound <= 0) return;

    const outboundTxs = [];
    const recipients = new Set();
    dated.slice(index + 1).forEach((candidate) => {
      if (candidate.timestamp - tx.timestamp > windowSeconds) return;
      const candidateStats = getTransferStats(candidate, walletAddress);
      if (candidateStats.outbound <= 0) return;
      outboundTxs.push(candidate);
      candidateStats.outboundRecipients.forEach((recipient) => recipients.add(recipient));
    });

    if (recipients.size > strongest.recipients.size) {
      strongest = { inboundTx: tx, outboundTxs, recipients };
    }
  });

  return strongest.recipients.size >= 3 ? strongest : null;
}

function findSpokePattern(transactions, walletAddress) {
  const walletPrefix = walletAddress.slice(0, 6);
  const inboundSenders = new Set();
  const outboundDestinations = new Set();
  let inboundCount = 0;
  let outboundCount = 0;

  transactions.forEach((tx) => {
    (tx.nativeTransfers || []).forEach((transfer) => {
      const fromAcct = String(transfer.fromUserAccount || "");
      const toAcct = String(transfer.toUserAccount || "");
      if (toAcct.includes(walletPrefix) && fromAcct) {
        inboundSenders.add(fromAcct);
        inboundCount += 1;
      } else if (fromAcct.includes(walletPrefix) && toAcct) {
        outboundDestinations.add(toAcct);
        outboundCount += 1;
      }
    });
    (tx.tokenTransfers || []).forEach((transfer) => {
      const fromAcct = String(transfer.fromUserAccount || "");
      const toAcct = String(transfer.toUserAccount || "");
      if (toAcct.includes(walletPrefix) && fromAcct) {
        inboundSenders.add(fromAcct);
        inboundCount += 1;
      } else if (fromAcct.includes(walletPrefix) && toAcct) {
        outboundDestinations.add(toAcct);
        outboundCount += 1;
      }
    });
  });

  if (inboundSenders.size >= 15 && outboundDestinations.size <= 2 && outboundCount >= 3) {
    return {
      inboundSenders: inboundSenders.size,
      outboundDestinations: outboundDestinations.size,
      inboundCount,
      outboundCount,
    };
  }
  return null;
}

function analyzeTransactions(transactions, walletAddress, options = {}) {
  const signals = [];
  const failedCount = transactions.filter((tx) => tx.transactionError).length;
  const knownGoodProgramTxs = transactions.filter((tx) => isKnownGoodProgram(getProgram(tx)));
  const unknownProgramTxs = transactions.filter((tx) => !isKnownGoodProgram(getProgram(tx)));
  const riskyProgramTxs = transactions.filter((tx) => isRiskyProgram(getProgram(tx)));
  const tinyInbound = transactions.filter((tx) => {
    const transfer = tx.nativeTransfers?.[0];
    if (!transfer) return false;
    const toWallet = String(transfer.toUserAccount || "").includes(walletAddress.slice(0, 6));
    return toWallet && transfer.amount > 0 && transfer.amount <= 5000;
  });
  const counterparties = new Set(transactions.map((tx) => getCounterparty(tx, walletAddress)).filter(Boolean));
  const tokenTransfers = transactions.filter((tx) => tx.tokenTransfers?.length);
  const recentWindow = transactions.filter((tx) => tx.timestamp && Date.now() / 1000 - tx.timestamp < 24 * 60 * 60);
  const ageDays = getWalletAgeDays(transactions, options.firstSeenTimestamp);
  const activeTraderTxs = transactions.filter(isLikelyTraderTransaction);
  const unfamiliarCounterpartyTxs = transactions.filter((tx) => !isLikelyTraderTransaction(tx));
  const unfamiliarCounterparties = new Set(unfamiliarCounterpartyTxs.map((tx) => getCounterparty(tx, walletAddress)).filter(Boolean));
  const rapidOutboundCluster = getLargestRapidOutboundCluster(transactions, walletAddress);
  const addressPoisoningSignals = findAddressPoisoningSignals(transactions, walletAddress);
  const vanityTrustSuffixAccounts = findVanityTrustSuffixAccounts(transactions);
  const rapidDispersion = findRapidDispersion(transactions, walletAddress);
  const spokePattern = findSpokePattern(transactions, walletAddress);

  // Community blocklist hit overrides everything else with a high penalty.
  if (knownRiskyAddresses.has(walletAddress)) {
    signals.push(makeSignal(
      "high",
      "Address in community blocklist",
      "This wallet matches an address publicly flagged in security reports for phishing, asset theft, or drainer activity.",
      80
    ));
  }

  if (spokePattern) {
    signals.push(makeSignal(
      "high",
      "Drainer spoke pattern",
      `${spokePattern.inboundSenders} distinct senders funded this wallet but outflows go to only ${spokePattern.outboundDestinations} destination(s) - the classic 'collect-and-forward' shape used by drainer loot wallets.`,
      36
    ));
  }

  if (riskyProgramTxs.length) {
    signals.push(makeSignal(
      "high",
      "Known risky program interaction",
      `${riskyProgramTxs.length} transaction${riskyProgramTxs.length === 1 ? "" : "s"} touched a program on the local risk list.`,
      34
    ));
  }

  if (knownGoodProgramTxs.length) {
    signals.push(makeSignal(
      "low",
      "Known venue activity",
      `${knownGoodProgramTxs.length} transaction${knownGoodProgramTxs.length === 1 ? "" : "s"} matched established Solana programs and scored as 0 added risk.`,
      0
    ));
  }

  if (addressPoisoningSignals.length) {
    const poisoningDust = addressPoisoningSignals.filter(({ tx }) => {
      const stats = getTransferStats(tx, walletAddress);
      return stats.inbound > 0 && stats.inbound <= 0.00001;
    });
    signals.push(makeSignal(
      poisoningDust.length ? "high" : "medium",
      "Address poisoning lookalike",
      `${addressPoisoningSignals.length} counterparty address${addressPoisoningSignals.length === 1 ? "" : "es"} matched trusted-looking first and last characters but differed in the middle.`,
      poisoningDust.length ? 30 : 18
    ));
  }

  if (vanityTrustSuffixAccounts.length) {
    signals.push(makeSignal(
      "medium",
      "Suspicious vanity suffix",
      `${new Set(vanityTrustSuffixAccounts.map(({ account }) => account)).size} non-system address${vanityTrustSuffixAccounts.length === 1 ? "" : "es"} ended in 11111, a trust-looking vanity pattern that needs review.`,
      12
    ));
  }

  if (unknownProgramTxs.length >= 2 && unfamiliarCounterparties.size >= 4) {
    signals.push(makeSignal(
      "medium",
      "Unfamiliar program cluster",
      `${unknownProgramTxs.length} recent transactions used programs outside the known-good allowlist across ${unfamiliarCounterparties.size} counterparties.`,
      18
    ));
  } else if (unknownProgramTxs.length === 1) {
    signals.push(makeSignal("low", "Single unfamiliar program", "One transaction used a program outside the known-good allowlist; this is informational unless paired with other suspicious patterns.", 4));
  }

  if (tinyInbound.length >= 3) {
    signals.push(makeSignal(
      "high",
      "Dusting pattern",
      `${tinyInbound.length} tiny inbound SOL transfers may be wallet-tagging or spam.`,
      28
    ));
  } else if (tinyInbound.length > 0) {
    signals.push(makeSignal(
      "medium",
      "Small inbound transfers",
      `${tinyInbound.length} tiny inbound transfer${tinyInbound.length === 1 ? "" : "s"} found. Watch for spam tokens or phishing links.`,
      10
    ));
  }

  if (failedCount >= 3) {
    signals.push(makeSignal("medium", "Failed transaction cluster", `${failedCount} failed transactions can indicate probing or confused signing attempts.`, 16));
  } else if (failedCount > 0) {
    signals.push(makeSignal("low", "Some failed activity", `${failedCount} failed transaction found in the latest sample.`, 5));
  }

  if (counterparties.size > 12 && transactions.length <= 50 && unfamiliarCounterparties.size >= 6) {
    signals.push(makeSignal(
      "medium",
      "Unfamiliar counterparty spread",
      `${unfamiliarCounterparties.size} counterparties appeared outside the known trading/program context.`,
      15
    ));
  } else if (counterparties.size > 12 && activeTraderTxs.length >= transactions.length * 0.5) {
    signals.push(makeSignal(
      "low",
      "Active trader pattern",
      `${counterparties.size} counterparties appeared mostly through known venues or trading-style activity, so spread alone added no risk.`,
      0
    ));
  }

  if (rapidOutboundCluster.length >= 4) {
    signals.push(makeSignal(
      "high",
      "Rapid outbound drain pattern",
      `${rapidOutboundCluster.length} large outbound transfers landed within ${Math.round(rapidOutboundCluster.at(-1).timestamp - rapidOutboundCluster[0].timestamp)} seconds.`,
      36
    ));
  }

  if (rapidDispersion) {
    signals.push(makeSignal(
      "high",
      "Rapid dispersion pattern",
      `Funds arrived and were swept to ${rapidDispersion.recipients.size} recipients within 10 minutes, which resembles drainer or laundering behavior.`,
      30
    ));
  }

  if (tokenTransfers.length > 0) {
    signals.push(makeSignal("low", "Token-account activity included", `${tokenTransfers.length} transaction${tokenTransfers.length === 1 ? "" : "s"} included token transfers or swaps.`, 4));
  }

  // "Human signature" check: real users interact with diverse programs (DeFi, NFTs, swaps).
  if (transactions.length >= 25 && tokenTransfers.length === 0) {
    const uniquePrograms = new Set(transactions.map((tx) => getProgram(tx)));
    const systemOnly = Array.from(uniquePrograms).every((program) => {
      const upper = String(program || "").toUpperCase().replaceAll(" ", "_").replaceAll("-", "_");
      return upper === "SYSTEM_PROGRAM" || upper === "UNKNOWN" || upper === "TRANSFER" || program === "11111111111111111111111111111111";
    });
    if (systemOnly && uniquePrograms.size <= 2) {
      signals.push(makeSignal(
        "medium",
        "No DeFi or NFT footprint",
        `${transactions.length} transactions, all of them plain SOL transfers - no DEX, NFT, or DeFi interaction. Real users typically have a more diverse footprint.`,
        12
      ));
    }
  }

  if (recentWindow.length > 0) {
    signals.push(makeSignal("low", "Recent wallet activity", `${recentWindow.length} transaction${recentWindow.length === 1 ? "" : "s"} occurred in the last 24 hours.`, 3));
  }

  if (ageDays !== null && ageDays > 365) {
    signals.push(makeSignal(
      "low",
      "Established wallet age",
      `First seen ${Math.floor(ageDays)} days ago; age is a trust signal and added no risk.`,
      0
    ));
  } else if (ageDays !== null && ageDays < 7) {
    signals.push(makeSignal(
      "medium",
      "Very new wallet",
      `First seen about ${Math.max(1, Math.floor(ageDays))} day${Math.floor(ageDays) === 1 ? "" : "s"} ago, which deserves extra caution.`,
      14
    ));
  } else if (ageDays !== null && ageDays < 30 && transactions.length < 20) {
    signals.push(makeSignal("low", "Short wallet history", "The fetched wallet history is still young and shallow.", 6));
  }

  // Volume-to-age ratio: young wallet + high throughput = bot or fresh drainer.
  if (ageDays !== null && ageDays > 0 && transactions.length >= 30) {
    const txPerDay = transactions.length / Math.max(0.1, ageDays);
    if (ageDays < 2 && txPerDay > 50) {
      signals.push(makeSignal(
        "high",
        "Bot-like activity rate",
        `This wallet processed ${transactions.length} transactions in under ${Math.max(1, Math.floor(ageDays))} day(s) - far above human signing rates. Likely a bot or fresh drainer.`,
        28
      ));
    } else if (ageDays < 7 && txPerDay > 30) {
      signals.push(makeSignal(
        "medium",
        "High activity for a young wallet",
        `~${Math.floor(txPerDay)} transactions/day on a wallet only ${Math.floor(ageDays)} day(s) old is on the edge of bot-like behavior.`,
        14
      ));
    }
  }

  if (!signals.length) {
    signals.push(makeSignal("low", "No major risk pattern", "The scanned history did not match the current high-risk heuristics.", 2));
  }

  const score = clamp(signals.reduce((sum, signal) => sum + signal.points, 0), 0, 100);
  const verdict = score >= 65 ? "RED" : score >= 32 ? "YELLOW" : "GREEN";

  const summaryMap = {
    GREEN: "No severe scam pattern was found in the scanned history. The wallet still deserves normal pre-sign caution.",
    YELLOW: "This wallet has risk signals that deserve manual review before approving a transaction.",
    RED: "This wallet shows high-risk behavior. Avoid signing until each flagged transaction is understood."
  };

  const nextActionMap = {
    GREEN: "Proceed carefully and re-scan before any high-value approval.",
    YELLOW: "Pause signing, inspect counterparties, and verify any dApp URL out of band.",
    RED: "Do not sign. Move funds from exposed wallets only with a trusted clean device and fresh address."
  };

  return {
    verdict,
    score,
    summary: summaryMap[verdict],
    nextAction: nextActionMap[verdict],
    signals,
    transactions,
    walletAddress,
    walletAgeDays: ageDays
  };
}

function buildGuardianReasoning(report) {
  const topSignals = report.signals
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((signal) => signal.title.toLowerCase());

  if (report.verdict === "RED") {
    return `The risk engine produced a RED verdict because ${topSignals.join(", ")} appeared in the recent transaction window. The AI layer should explain these facts plainly instead of inventing extra accusations.`;
  }

  if (report.verdict === "YELLOW") {
    return `The wallet is not automatically malicious, but ${topSignals.join(", ")} make it risky enough to slow down. This is the exact zone where an explainable warning helps users avoid blind signing.`;
  }

  return `The scan found ordinary activity and only low-intensity signals such as ${topSignals.join(", ")}. The safest explanation is cautious but calm: no severe pattern in this window, still verify the next transaction request.`;
}

function buildAiPrompt(report) {
  const compactTransactions = report.transactions.slice(0, 20).map((tx) => ({
    type: tx.type,
    source: getProgram(tx),
    signature: tx.signature,
    timestamp: tx.timestamp,
    amount: formatAmount(tx),
    error: Boolean(tx.transactionError)
  }));

  return `You are WalletPulse Guardian, a Solana wallet security expert.

Use the deterministic risk engine below as the source of truth. Do not invent accusations. Explain the verdict to a non-technical wallet user in under 130 words.

Required output:
- Verdict: RED, YELLOW, or GREEN
- Summary
- Reasons
- Recommended action

Risk engine result:
${JSON.stringify({
    walletAddress: report.walletAddress,
    verdict: report.verdict,
    riskScore: report.score,
    walletAgeDays: report.walletAgeDays,
    signals: report.signals.map(({ severity, title, detail }) => ({ severity, title, detail })),
    transactions: compactTransactions
  }, null, 2)}`;
}

function extractOpenAiText(payload) {
  if (payload?.output_text) return payload.output_text;
  const outputTextParts = payload?.output
    ?.flatMap((item) => item.content || [])
    ?.filter((content) => content.type === "output_text" || content.type === "text")
    ?.map((content) => content.text)
    ?.filter(Boolean);
  if (outputTextParts?.length) return outputTextParts.join("\n").trim();

  const textParts = payload?.content
    ?.filter((content) => content.type === "text")
    ?.map((content) => content.text)
    ?.filter(Boolean);
  return textParts?.join("\n").trim() || "";
}

async function generateAiExplanation() {
  if (!state.lastReport) return;

  const apiKey = nodes.openaiKey.value.trim();
  const model = nodes.openaiModel.value.trim() || "gpt-5";

  if (!apiKey && location.protocol === "file:") {
    nodes.statusLine.textContent = "Add an OpenAI API key to run AI explain, or use Copy prompt as the manual fallback.";
    return;
  }

  try {
    nodes.statusLine.textContent = "Generating AI explanation from the deterministic verdict...";
    const useLocalProxy = location.protocol !== "file:";
    const response = await fetch(useLocalProxy ? "/api/openai/explain" : "https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(useLocalProxy && apiKey ? { "x-walletpulse-openai-key": apiKey } : {}),
        ...(!useLocalProxy && apiKey ? {
          "Authorization": `Bearer ${apiKey}`
        } : {})
      },
      body: JSON.stringify(useLocalProxy ? {
        model,
        prompt: buildAiPrompt(state.lastReport)
      } : {
        model,
        store: false,
        instructions: "You explain WalletPulse risk reports. The deterministic score is the source of truth. Do not add claims that are not in the report.",
        input: buildAiPrompt(state.lastReport)
      })
    });

    const payload = await parseJsonResponse(response, "OpenAI proxy");
    if (!response.ok) throw new Error(payload?.error?.message || `OpenAI returned ${response.status}`);

    const explanation = extractOpenAiText(payload);
    if (!explanation) throw new Error("OpenAI returned no text.");

    nodes.reasoningText.textContent = explanation;
    nodes.statusLine.textContent = useLocalProxy
      ? "OpenAI explanation generated through the local proxy."
      : "OpenAI explanation generated. Copy prompt remains optional.";
  } catch (error) {
    nodes.statusLine.textContent = `${error.message} Copy prompt is still available as a fallback.`;
  }
}

function renderReport(report, sourceLabel) {
  state.lastReport = report;
  const verdictClass = report.verdict.toLowerCase();

  nodes.verdictCard.className = `verdict-card ${verdictClass}`;
  nodes.verdictTitle.textContent = report.verdict;
  nodes.riskScore.textContent = report.score;
  nodes.riskSummary.textContent = report.summary;
  nodes.reasoningText.textContent = buildGuardianReasoning(report);
  nodes.nextAction.textContent = report.nextAction;
  nodes.signalCount.textContent = `${report.signals.length} signals`;
  nodes.dataSource.textContent = sourceLabel;
  nodes.transactionCount.textContent = `${report.transactions.length} transactions`;

  nodes.signalsList.replaceChildren();
  report.signals.forEach((signal) => {
    const item = nodes.signalTemplate.content.firstElementChild.cloneNode(true);
    item.classList.add(signal.severity);
    item.querySelector("strong").textContent = signal.title;
    item.querySelector("p").textContent = signal.detail;
    nodes.signalsList.append(item);
  });

  nodes.activityTable.replaceChildren();
  report.transactions.slice(0, 12).forEach((tx) => {
    const row = document.createElement("tr");
    const cells = [
      tx.type || "UNKNOWN",
      shorten(getCounterparty(tx, report.walletAddress)),
      formatAmount(tx),
      shorten(getProgram(tx)),
      tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : "unknown"
    ];
    cells.forEach((cellText, index) => {
      const cell = document.createElement("td");
      cell.textContent = cellText;
      if (index === 1 || index === 3) cell.className = "truncate";
      row.append(cell);
    });
    nodes.activityTable.append(row);
  });
}

async function runScan(event) {
  event?.preventDefault();
  const walletAddress = nodes.wallet.value.trim();
  const limit = clamp(Number(nodes.historyLimit.value) || 50, 10, 100);

  if (!walletAddress) {
    nodes.statusLine.textContent = "Paste a wallet address first.";
    return;
  }

  nodes.statusLine.textContent = state.mode === "live" ? "Fetching live Helius history..." : "Scanning sample transaction history...";

  try {
    const apiKey = nodes.heliusKey.value.trim();
    const [transactions, firstSeenTimestamp] = state.mode === "live"
      ? await Promise.all([
        fetchLiveTransactions(walletAddress, apiKey, limit),
        fetchWalletFirstSeenTimestamp(walletAddress, apiKey)
      ])
      : [sampleTransactions.slice(0, limit), null];

    const report = analyzeTransactions(transactions, walletAddress, { firstSeenTimestamp });
    renderReport(report, state.mode);
    nodes.statusLine.textContent = `Scan complete. ${report.verdict} verdict with ${report.score}/100 risk.`;
  } catch (error) {
    const report = analyzeTransactions(sampleTransactions, walletAddress);
    renderReport(report, "sample fallback");
    nodes.statusLine.textContent = `${error.message} Showing sample fallback so the demo still runs.`;
  }
}

async function copyPrompt() {
  if (!state.lastReport) return;
  const prompt = buildAiPrompt(state.lastReport);
  try {
    await navigator.clipboard.writeText(prompt);
    nodes.statusLine.textContent = "Guardian AI prompt copied.";
  } catch (error) {
    const promptWindow = window.open("", "walletpulse-prompt", "width=760,height=620");
    if (promptWindow) {
      promptWindow.document.write(`<pre style="white-space:pre-wrap;font:14px/1.5 monospace;padding:20px;">${prompt.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]))}</pre>`);
      promptWindow.document.close();
      nodes.statusLine.textContent = "Clipboard was blocked, so the prompt opened in a new window.";
    } else {
      nodes.statusLine.textContent = "Clipboard was blocked. Run through localhost for prompt copy support.";
    }
  }
}

function browserSpeak(text) {
  if (!("speechSynthesis" in window)) {
    nodes.statusLine.textContent = "Browser speech is not available here.";
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.94;
  utterance.pitch = 0.92;
  window.speechSynthesis.speak(utterance);
}

async function speakWarning() {
  if (!state.lastReport) return;
  const script = `${state.lastReport.verdict} warning. ${state.lastReport.summary} ${state.lastReport.nextAction}`;
  const apiKey = nodes.elevenKey.value.trim();
  const voiceId = nodes.voiceId.value.trim();

  if ((!apiKey || !voiceId) && location.protocol === "file:") {
    browserSpeak(script);
    nodes.statusLine.textContent = "Speaking with browser voice. Add ElevenLabs key for the polished demo voice.";
    return;
  }

  try {
    nodes.statusLine.textContent = "Generating ElevenLabs warning...";
    const response = await fetch(apiKey && voiceId ? `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}` : "/api/elevenlabs/speech", {
      method: "POST",
      headers: apiKey && voiceId ? {
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      } : {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(apiKey && voiceId ? {
        text: script,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.62,
          similarity_boost: 0.75,
          style: 0.18,
          use_speaker_boost: true
        }
      } : {
        text: script
      })
    });

    if (!response.ok) {
      let detail = `ElevenLabs returned ${response.status}`;
      // Try to read the upstream error JSON so we can surface the real reason.
      let upstreamMessage = "";
      let upstreamStatus = "";
      try {
        const errorBody = await response.clone().json();
        upstreamMessage = errorBody?.detail?.message || errorBody?.detail || errorBody?.message || errorBody?.error?.message || "";
        upstreamStatus = errorBody?.detail?.status || "";
      } catch {
        try { upstreamMessage = await response.clone().text(); } catch { /* ignore */ }
      }
      if (response.status === 401) {
        if (String(upstreamStatus).includes("detected_unusual_activity") || /unusual activity|free tier|proxy\/vpn/i.test(String(upstreamMessage))) {
          detail = "ElevenLabs returned 401 (detected_unusual_activity). Free Tier is blocked here, usually because of VPN/proxy/shared-IP. Use a paid ElevenLabs plan or a different network.";
        } else {
          detail = "ElevenLabs returned 401. The API key looks invalid or missing - check the xi-api-key value in your .env or the form.";
        }
      } else if (response.status === 402) {
        detail = "ElevenLabs returned 402. The account likely needs credits, quota, or billing enabled.";
      } else if (response.status === 422) {
        detail = `ElevenLabs returned 422. The voice ID or text payload is rejected: ${upstreamMessage || "unprocessable entity"}.`;
      } else if (response.status === 429) {
        detail = "ElevenLabs returned 429. Rate limit or concurrency cap hit; wait a moment and retry.";
      } else if (upstreamMessage) {
        detail = `${detail}: ${String(upstreamMessage).slice(0, 200)}`;
      }
      throw new Error(detail);
    }
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    await audio.play();
    nodes.statusLine.textContent = "ElevenLabs warning is playing.";
  } catch (error) {
    browserSpeak(script);
    nodes.statusLine.textContent = `${error.message} Falling back to browser voice.`;
  }
}

function drawPulse() {
  const canvas = nodes.canvas;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  state.animationTick += 0.008;

  context.clearRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#07100d");
  gradient.addColorStop(0.55, "#0f1b18");
  gradient.addColorStop(1, "#102124");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(183, 247, 207, 0.14)";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 48) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 44) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  for (let lane = 0; lane < 4; lane += 1) {
    context.beginPath();
    context.lineWidth = lane === 1 ? 3 : 2;
    context.strokeStyle = lane === 1 ? "rgba(34, 197, 94, 0.9)" : "rgba(56, 189, 248, 0.42)";
    for (let x = 0; x <= width; x += 8) {
      const wave = Math.sin(x * 0.018 + state.animationTick * 4 + lane) * (12 + lane * 3);
      const pulse = Math.sin(x * 0.055 - state.animationTick * 10) * 8;
      const y = height * (0.32 + lane * 0.16) + wave + pulse;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }

  requestAnimationFrame(drawPulse);
}

function setMode(mode, statusMessage = true) {
  state.mode = mode;
  document.querySelectorAll("[data-mode]").forEach((node) => node.classList.toggle("active", node.dataset.mode === mode));
  if (statusMessage) {
    nodes.statusLine.textContent = state.mode === "live"
      ? "Live mode selected. Add a Helius key, then scan."
      : "Sample mode selected. You can demo without network keys.";
  }
}

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

nodes.form.addEventListener("submit", runScan);
nodes.promptButton.addEventListener("click", copyPrompt);
nodes.aiButton.addEventListener("click", generateAiExplanation);
nodes.voiceButton.addEventListener("click", speakWarning);
if (nodes.simulateButton) {
  nodes.simulateButton.addEventListener("click", simulateTransaction);
}

function describeSolChange(change) {
  const direction = change.deltaSol > 0 ? "would gain" : "would lose";
  const amount = Math.abs(change.deltaSol).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  const who = change.isViewer ? "Signer" : shorten(change.address);
  return `${who} ${direction} ${amount} SOL`;
}

function describeTokenChange(change) {
  const direction = change.delta > 0 ? "would gain" : "would lose";
  const amount = Math.abs(change.delta).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  const who = change.isViewer ? "Signer" : shorten(change.owner || change.address || "an account");
  const mint = shorten(change.mint || "token");
  return `${who} ${direction} ${amount} of ${mint}`;
}

function renderSimulationFinding(item) {
  const node = nodes.signalTemplate.content.firstElementChild.cloneNode(true);
  node.classList.add(item.severity);
  node.querySelector("strong").textContent = item.title;
  node.querySelector("p").textContent = item.detail;
  return node;
}

function renderTxVerdict(result) {
  // Show the per-transaction verdict card with its own score, never merged with wallet history.
  const verdict = result.verdict || "GREEN";
  nodes.txVerdictCard.style.display = "block";
  nodes.txVerdictCard.className = `verdict-card ${verdict.toLowerCase()}`;
  // Re-apply the inline overrides that the className wipe just lost.
  nodes.txVerdictCard.style.marginTop = "0";
  nodes.txVerdictCard.style.marginBottom = "14px";
  nodes.txVerdictCard.style.padding = "18px";
  nodes.txVerdictTitle.textContent = verdict;
  nodes.txRiskScore.textContent = result.score != null ? result.score : "0";
  nodes.simulationSummary.textContent = result.summary || "";
}

function renderCombinedWarning(walletReport, simResult) {
  // Only show the combined warning when the two verdicts diverge or either is non-GREEN.
  if (!simResult || !walletReport) {
    nodes.combinedWarning.style.display = "none";
    return;
  }
  const wallet = walletReport.verdict || "GREEN";
  const tx = simResult.verdict || "GREEN";
  let message = "";

  if (wallet === "GREEN" && tx === "GREEN") {
    nodes.combinedWarning.style.display = "none";
    return;
  }

  if (wallet === "RED" && tx === "RED") {
    message = "Wallet is RED and this transaction is RED. Do not sign.";
  } else if (tx === "RED") {
    message = `Wallet is ${wallet}, but this transaction is RED. Do not sign even though the address looks ok.`;
  } else if (wallet === "RED") {
    message = `Wallet is RED, even though this specific transaction looks ${tx}. The address has a poor track record - sign with extreme caution.`;
  } else if (wallet === "YELLOW" && tx === "YELLOW") {
    message = "Both the wallet and this transaction have warning signals worth reviewing before you sign.";
  } else if (tx === "YELLOW") {
    message = `Wallet is GREEN, but this transaction is YELLOW. Review the simulation findings before signing.`;
  } else if (wallet === "YELLOW") {
    message = `Wallet is YELLOW, but this transaction looks GREEN. The transaction itself is fine; the address has a slightly elevated history risk.`;
  }

  // Pick the border color of the warning based on the more severe of the two.
  const severity = (wallet === "RED" || tx === "RED") ? "var(--red)" : "var(--yellow)";
  nodes.combinedWarning.style.borderColor = severity;
  nodes.combinedWarningText.textContent = message;
  nodes.combinedWarning.style.display = "block";
}

function renderSimulationResult(result) {
  nodes.simulationChanges.replaceChildren();

  // Render the per-transaction verdict card first.
  renderTxVerdict(result);

  // Optional v0/ALT note in a quiet caption.
  const meta = result.txMeta || {};
  const metaBits = [];
  if (meta.version) metaBits.push(`Tx version: ${meta.version}`);
  if (meta.numWritableSigners != null && meta.numWritableNonSigners != null) {
    const total = (meta.numWritableSigners || 0) + (meta.numWritableNonSigners || 0) + (meta.lookupTableAddressCount || 0);
    if (total) metaBits.push(`${total} writable account(s) touched`);
  }
  if (result.unitsConsumed) metaBits.push(`${Number(result.unitsConsumed).toLocaleString()} compute units`);
  let metaText = metaBits.join(" • ");
  if (meta.note) metaText = metaText ? `${metaText}. ${meta.note}` : meta.note;
  nodes.simulationMeta.textContent = metaText;

  // Build the findings list. Risk findings first, then balance/token deltas, then programs touched.
  const items = [];
  (result.findings || []).forEach((finding) => items.push(finding));

  const orderedSol = [...(result.solChanges || [])].sort((a, b) => Number(b.isViewer) - Number(a.isViewer) || Math.abs(b.deltaSol) - Math.abs(a.deltaSol));
  orderedSol.slice(0, 6).forEach((change) => {
    const severity = change.isViewer && change.deltaSol < -0.5 ? "high" : change.isViewer ? "medium" : "low";
    items.push({ severity, title: "SOL balance change", detail: describeSolChange(change) });
  });

  const orderedToken = [...(result.tokenChanges || [])].sort((a, b) => Number(b.isViewer) - Number(a.isViewer));
  orderedToken.slice(0, 6).forEach((change) => {
    const severity = change.isViewer && change.delta < 0 ? "high" : change.isViewer ? "medium" : "low";
    items.push({ severity, title: "Token balance change", detail: describeTokenChange(change) });
  });

  (result.programInvocations || []).slice(0, 6).forEach((program) => {
    items.push({ severity: "low", title: "Program invoked", detail: shorten(program) });
  });

  if (!items.length) {
    items.push({ severity: "low", title: "No detectable changes", detail: "Simulation succeeded but produced no balance or token deltas for tracked accounts." });
  }

  items.forEach((item) => nodes.simulationChanges.append(renderSimulationFinding(item)));

  // Surface the combined wallet+tx warning when the two diverge.
  renderCombinedWarning(state.lastReport, result);
}

async function simulateTransaction() {
  const encodedTx = nodes.simulationInput.value.trim();
  if (!encodedTx) {
    nodes.simulationStatus.textContent = "paste a base64 transaction";
    return;
  }
  if (location.protocol === "file:") {
    nodes.simulationStatus.textContent = "needs the local server";
    nodes.simulationSummary.textContent = "Transaction simulation needs python3 server.py running so the Helius RPC proxy is available.";
    return;
  }

  nodes.simulationStatus.textContent = "simulating...";
  nodes.simulationSummary.textContent = "Calling Helius simulateTransaction...";
  nodes.simulationChanges.replaceChildren();
  nodes.combinedWarning.style.display = "none";

  try {
    const response = await fetch("/api/helius/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction: encodedTx,
        walletAddress: nodes.wallet.value.trim() || null
      })
    });
    const payload = await parseJsonResponse(response, "Simulation");
    if (!response.ok) {
      throw new Error(payload?.error || `Simulation proxy returned ${response.status}`);
    }
    if (payload.ok === false) {
      nodes.simulationStatus.textContent = "RPC rejected";
      nodes.simulationSummary.textContent = payload.error || "Helius RPC rejected the simulation.";
      // Even on RPC rejection, surface the version note so users see we decoded the tx.
      const meta = payload.txMeta || {};
      if (meta.version) nodes.simulationMeta.textContent = `Tx version: ${meta.version}.`;
      return;
    }

    nodes.simulationStatus.textContent = `${payload.verdict || "GREEN"} • score ${payload.score || 0}`;
    state.lastSimulation = payload;
    renderSimulationResult(payload);
  } catch (error) {
    nodes.simulationStatus.textContent = "error";
    nodes.simulationSummary.textContent = `${error.message}`;
  }
}

const initialParams = new URLSearchParams(window.location.search);
const sharedAddress = initialParams.get("address");
if (sharedAddress) {
  nodes.wallet.value = sharedAddress;
  setMode("live", false);
}

renderReport(analyzeTransactions(sampleTransactions, nodes.wallet.value.trim()), "sample");
if (sharedAddress && location.protocol !== "file:") {
  runScan();
}
drawPulse();

// Non-blocking health probe so the status line surfaces which keys the server has loaded.
async function probeHealth() {
  if (location.protocol === "file:") return;
  try {
    const response = await fetch("/api/health");
    if (!response.ok) return;
    const payload = await response.json();
    const ready = [];
    const missing = [];
    (payload.services || []).forEach((service) => {
      (service.ok ? ready : missing).push(service.name);
    });
    const summary = [
      ready.length ? `Ready: ${ready.join(", ")}` : "",
      missing.length ? `Missing: ${missing.join(", ")}` : ""
    ].filter(Boolean).join(" | ");
    if (summary && nodes.statusLine.textContent.startsWith("Ready.")) {
      nodes.statusLine.textContent = summary + ".";
    }
  } catch { /* ignore */ }
}
probeHealth();