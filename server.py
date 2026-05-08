#!/usr/bin/env python3
import json
import mimetypes
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from socketserver import ThreadingTCPServer


ROOT = Path(__file__).resolve().parent


def load_env():
    env_path = ROOT / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def json_response(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Encoding, Accept-Encoding, x-walletpulse-openai-key")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def proxy_json(url, payload=None, headers=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url, data=data, headers=headers or {}, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            body = response.read()
            return response.status, dict(response.headers), body
    except urllib.error.HTTPError as error:
        return error.code, dict(error.headers), error.read()


def read_json(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return {}
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def base_url(handler):
    host = handler.headers.get("Host", f"localhost:{os.environ.get('PORT', '4173')}")
    forwarded_proto = handler.headers.get("X-Forwarded-Proto")
    proto = forwarded_proto or ("https" if os.environ.get("FORCE_HTTPS") == "1" else "http")
    return f"{proto}://{host}"


def clamp(value, minimum, maximum):
    return min(maximum, max(minimum, value))


def lamports_to_sol(lamports=0):
    return float(lamports or 0) / 1_000_000_000


def normalize_helius_transaction(tx):
    return {
        "type": tx.get("type") or "UNKNOWN",
        "signature": tx.get("signature"),
        "timestamp": tx.get("timestamp"),
        "nativeTransfers": tx.get("nativeTransfers") or [],
        "tokenTransfers": tx.get("tokenTransfers") or [],
        "source": tx.get("source") or (tx.get("instructions") or [{}])[0].get("programId") or "UNKNOWN",
        "fee": tx.get("fee"),
        "transactionError": tx.get("transactionError"),
        "accountData": tx.get("accountData") or [],
    }


def get_program(tx):
    return tx.get("source") or ((tx.get("instructions") or [{}])[0].get("programId")) or tx.get("type") or "UNKNOWN"


def get_counterparty(tx, wallet):
    wallet_prefix = wallet[:6]
    native = (tx.get("nativeTransfers") or [None])[0]
    if native:
        return native.get("toUserAccount") if wallet_prefix in str(native.get("fromUserAccount", "")) else native.get("fromUserAccount")

    token = (tx.get("tokenTransfers") or [None])[0]
    if token:
        return token.get("toUserAccount") if wallet_prefix in str(token.get("fromUserAccount", "")) else token.get("fromUserAccount")

    account_data = tx.get("accountData") or []
    return (account_data[0].get("account") if account_data else None) or tx.get("source") or "unknown"


def get_transaction_accounts(tx):
    accounts = []
    for transfer in tx.get("nativeTransfers") or []:
        accounts.extend([transfer.get("fromUserAccount"), transfer.get("toUserAccount")])
    for transfer in tx.get("tokenTransfers") or []:
        accounts.extend([transfer.get("fromUserAccount"), transfer.get("toUserAccount"), transfer.get("mint")])
    for account in tx.get("accountData") or []:
        accounts.append(account.get("account"))
    return [str(account) for account in accounts if account]


def looks_like_solana_address(value=""):
    return bool(re.match(r"^[1-9A-HJ-NP-Za-km-z]{16,64}$", str(value)))



def parse_transaction_message(base64_transaction):
    """Decode a base64 Solana transaction with the solders SDK.

    Returns a dict (never raises). Keys:
      version            -> "legacy" or "v0"
      staticKeys         -> list of base58 pubkey strings (the static account keys)
      numRequiredSignatures, numReadonlySigned, numReadonlyUnsigned -> message header
      numWritableSigners, numWritableNonSigners -> derived
      addressLookupTables -> list of {address, writableCount, readonlyCount}
      lookupTableWritableCount, lookupTableReadonlyCount -> totals across ALTs
      ok                 -> bool, False if decoding bailed
      error              -> string, present only when ok is False
    """
    import base64

    out = {
        "version": None,
        "staticKeys": [],
        "numRequiredSignatures": 0,
        "numReadonlySigned": 0,
        "numReadonlyUnsigned": 0,
        "numWritableSigners": 0,
        "numWritableNonSigners": 0,
        "addressLookupTables": [],
        "lookupTableWritableCount": 0,
        "lookupTableReadonlyCount": 0,
        "ok": False,
        "error": "",
    }

    try:
        from solders.transaction import VersionedTransaction
    except ImportError:
        out["error"] = "solders is not installed. Run: pip install solders"
        return out

    try:
        raw = base64.b64decode(base64_transaction, validate=False)
    except Exception:
        out["error"] = "Could not base64-decode the transaction."
        return out

    try:
        tx = VersionedTransaction.from_bytes(raw)
    except Exception as exc:
        out["error"] = f"Could not deserialize the transaction: {exc}"
        return out

    msg = tx.message
    header = msg.header

    # Version detection by message class. solders returns Message for legacy and MessageV0 for v0+.
    msg_class_name = type(msg).__name__
    if msg_class_name == "Message":
        out["version"] = "legacy"
    elif msg_class_name.startswith("MessageV"):
        # MessageV0 -> "v0"; future MessageV1 -> "v1", etc.
        out["version"] = "v" + msg_class_name[len("MessageV"):]
    else:
        out["version"] = msg_class_name.lower()

    out["numRequiredSignatures"] = header.num_required_signatures
    out["numReadonlySigned"] = header.num_readonly_signed_accounts
    out["numReadonlyUnsigned"] = header.num_readonly_unsigned_accounts
    out["numWritableSigners"] = max(0, header.num_required_signatures - header.num_readonly_signed_accounts)

    out["staticKeys"] = [str(key) for key in msg.account_keys]
    key_count = len(out["staticKeys"])
    out["numWritableNonSigners"] = max(0, key_count - header.num_required_signatures - header.num_readonly_unsigned_accounts)

    # ALTs are only present on v0+ messages.
    try:
        alts = msg.address_table_lookups
    except AttributeError:
        alts = []
    for alt in alts or []:
        writable = list(alt.writable_indexes)
        readonly = list(alt.readonly_indexes)
        out["addressLookupTables"].append({
            "address": str(alt.account_key),
            "writableCount": len(writable),
            "readonlyCount": len(readonly),
        })
        out["lookupTableWritableCount"] += len(writable)
        out["lookupTableReadonlyCount"] += len(readonly)

    out["ok"] = True
    return out


def parse_transaction_account_keys(base64_transaction):
    """Backwards-compatible helper that returns just the static account keys."""
    return parse_transaction_message(base64_transaction).get("staticKeys") or []


def is_lookalike_address(candidate="", target="", edge_length=4):
    candidate = str(candidate)
    target = str(target)
    if not looks_like_solana_address(candidate) or not looks_like_solana_address(target):
        return False
    if candidate == target or len(candidate) < edge_length * 2 + 4 or len(target) < edge_length * 2 + 4:
        return False
    return (
        candidate[:edge_length] == target[:edge_length]
        and candidate[-edge_length:] == target[-edge_length:]
        and candidate[edge_length:-edge_length] != target[edge_length:-edge_length]
    )


KNOWN_GOOD_PROGRAM_IDS = {
    "11111111111111111111111111111111",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
}
KNOWN_GOOD_ALIASES = {
    "SYSTEM_PROGRAM", "TOKEN_PROGRAM", "ASSOCIATED_TOKEN_PROGRAM", "JUPITER", "JUPITER_V6",
    "RAYDIUM", "RAYDIUM_AMM", "RAYDIUM_CLMM", "ORCA", "ORCA_WHIRLPOOLS",
    "PHOENIX", "MAGIC_EDEN", "TENSOR", "PHANTOM", "PUMP_FUN", "OKX", "OKX_DEX",
    "DRIFT", "MANGO",
}
KNOWN_RISKY_PROGRAMS = {"UNVERIFIED_PROGRAM", "RiskyVault111", "FakeAirdropRouter", "MixerBridge"}
ACTIVE_TRADER_TYPES = {"SWAP", "NFT_SALE", "NFT_LISTING", "NFT_BID", "NFT_CANCEL_LISTING", "COMPRESSED_NFT_MINT"}


def normalize_program_name(program):
    return str(program or "").strip().upper().replace(" ", "_").replace("-", "_")


def is_known_good_program(program):
    program = str(program or "").strip()
    return (
        normalize_program_name(program) in KNOWN_GOOD_ALIASES
        or program in KNOWN_GOOD_PROGRAM_IDS
        or any(program.startswith(prefix) for prefix in ("JUP6Lk", "whirLb", "CAMMCz", "675kPX", "6EF8rr"))
    )


def is_likely_trader_transaction(tx):
    return is_known_good_program(get_program(tx)) or str(tx.get("type", "")).upper() in ACTIVE_TRADER_TYPES


def transfer_stats(tx, wallet):
    inbound = 0
    outbound = 0
    recipients = set()
    wallet_prefix = wallet[:6]
    for transfer in tx.get("nativeTransfers") or []:
        amount = lamports_to_sol(transfer.get("amount", 0))
        if wallet_prefix in str(transfer.get("toUserAccount", "")):
            inbound += amount
        if wallet_prefix in str(transfer.get("fromUserAccount", "")):
            outbound += amount
            if transfer.get("toUserAccount"):
                recipients.add(transfer["toUserAccount"])
    for transfer in tx.get("tokenTransfers") or []:
        amount = float(transfer.get("tokenAmount") or 0)
        if wallet_prefix in str(transfer.get("toUserAccount", "")):
            inbound += amount
        if wallet_prefix in str(transfer.get("fromUserAccount", "")):
            outbound += amount
            if transfer.get("toUserAccount"):
                recipients.add(transfer["toUserAccount"])
    return {"inbound": inbound, "outbound": outbound, "recipients": recipients}


def make_signal(severity, title, detail, points):
    return {"severity": severity, "title": title, "detail": detail, "points": points}


def find_address_poisoning(transactions, wallet):
    items = []
    groups = {}
    for tx in transactions:
        counterparty = get_counterparty(tx, wallet)
        if not looks_like_solana_address(counterparty):
            continue
        if is_lookalike_address(counterparty, wallet):
            items.append({"tx": tx, "counterparty": counterparty})
        key = f"{counterparty[:4]}:{counterparty[-4:]}"
        groups.setdefault(key, []).append({"tx": tx, "counterparty": counterparty})
    for group in groups.values():
        if len({item["counterparty"] for item in group}) > 1:
            items.extend(group)
    unique = {}
    for item in items:
        unique[f"{item['tx'].get('signature')}:{item['counterparty']}"] = item
    return list(unique.values())


def find_rapid_outbound_cluster(transactions, wallet, window_seconds=45):
    outbound = []
    for tx in transactions:
        stats = transfer_stats(tx, wallet)
        if tx.get("timestamp") and stats["outbound"] >= 1:
            outbound.append(tx)
    outbound.sort(key=lambda tx: tx["timestamp"])
    largest = []
    for index, tx in enumerate(outbound):
        cluster = [candidate for candidate in outbound[index:] if candidate["timestamp"] - tx["timestamp"] <= window_seconds]
        if len(cluster) > len(largest):
            largest = cluster
    return largest


def find_rapid_dispersion(transactions, wallet, window_seconds=600):
    dated = sorted([tx for tx in transactions if tx.get("timestamp")], key=lambda tx: tx["timestamp"])
    strongest = {"recipients": set(), "outboundTxs": []}
    for index, tx in enumerate(dated):
        if transfer_stats(tx, wallet)["inbound"] <= 0:
            continue
        recipients = set()
        outbound_txs = []
        for candidate in dated[index + 1:]:
            if candidate["timestamp"] - tx["timestamp"] > window_seconds:
                continue
            stats = transfer_stats(candidate, wallet)
            if stats["outbound"] > 0:
                outbound_txs.append(candidate)
                recipients.update(stats["recipients"])
        if len(recipients) > len(strongest["recipients"]):
            strongest = {"recipients": recipients, "outboundTxs": outbound_txs}
    return strongest if len(strongest["recipients"]) >= 3 else None


def analyze_wallet(transactions, wallet, first_seen_timestamp=None):
    signals = []
    now = time.time()
    failed_count = sum(1 for tx in transactions if tx.get("transactionError"))
    known_good = [tx for tx in transactions if is_known_good_program(get_program(tx))]
    unknown = [tx for tx in transactions if not is_known_good_program(get_program(tx))]
    risky = [tx for tx in transactions if get_program(tx) in KNOWN_RISKY_PROGRAMS or normalize_program_name(get_program(tx)) in KNOWN_RISKY_PROGRAMS]
    token_transfers = [tx for tx in transactions if tx.get("tokenTransfers")]
    recent = [tx for tx in transactions if tx.get("timestamp") and now - tx["timestamp"] < 24 * 60 * 60]
    counterparties = {get_counterparty(tx, wallet) for tx in transactions if get_counterparty(tx, wallet)}
    unfamiliar_txs = [tx for tx in transactions if not is_likely_trader_transaction(tx)]
    unfamiliar_counterparties = {get_counterparty(tx, wallet) for tx in unfamiliar_txs if get_counterparty(tx, wallet)}
    tiny_inbound = [
        tx for tx in transactions
        if any(wallet[:6] in str(t.get("toUserAccount", "")) and 0 < int(t.get("amount", 0)) <= 5000 for t in tx.get("nativeTransfers") or [])
    ]
    oldest_observed = min([tx["timestamp"] for tx in transactions if tx.get("timestamp")] or [0])
    age_days = (now - (first_seen_timestamp or oldest_observed)) / (24 * 60 * 60) if (first_seen_timestamp or oldest_observed) else None
    poisoning = find_address_poisoning(transactions, wallet)
    vanity_suffix = [
        account for tx in transactions for account in get_transaction_accounts(tx)
        if account != "11111111111111111111111111111111" and account not in KNOWN_GOOD_PROGRAM_IDS and looks_like_solana_address(account) and account.endswith("11111")
    ]
    rapid_cluster = find_rapid_outbound_cluster(transactions, wallet)
    dispersion = find_rapid_dispersion(transactions, wallet)

    if risky:
        signals.append(make_signal("high", "Known risky program interaction", f"{len(risky)} transaction(s) touched a program on the local risk list.", 34))
    if known_good:
        signals.append(make_signal("low", "Known venue activity", f"{len(known_good)} transaction(s) matched established Solana programs and scored as 0 added risk.", 0))
    if poisoning:
        poisoning_dust = [item for item in poisoning if 0 < transfer_stats(item["tx"], wallet)["inbound"] <= 0.00001]
        signals.append(make_signal(
            "high" if poisoning_dust else "medium",
            "Address poisoning lookalike",
            f"{len(poisoning)} counterparty address(es) matched trusted-looking first and last characters but differed in the middle.",
            30 if poisoning_dust else 18,
        ))
    if vanity_suffix:
        signals.append(make_signal("medium", "Suspicious vanity suffix", f"{len(set(vanity_suffix))} non-system address(es) ended in 11111.", 12))
    if len(unknown) >= 2 and len(unfamiliar_counterparties) >= 4:
        signals.append(make_signal("medium", "Unfamiliar program cluster", f"{len(unknown)} recent transactions used programs outside the known-good allowlist.", 18))
    elif len(unknown) == 1:
        signals.append(make_signal("low", "Single unfamiliar program", "One transaction used a program outside the known-good allowlist.", 4))
    if len(tiny_inbound) >= 3:
        signals.append(make_signal("high", "Dusting pattern", f"{len(tiny_inbound)} tiny inbound SOL transfers may be wallet-tagging or spam.", 28))
    elif tiny_inbound:
        signals.append(make_signal("medium", "Small inbound transfers", f"{len(tiny_inbound)} tiny inbound transfer(s) found.", 10))
    if failed_count >= 3:
        signals.append(make_signal("medium", "Failed transaction cluster", f"{failed_count} failed transactions can indicate probing.", 16))
    elif failed_count:
        signals.append(make_signal("low", "Some failed activity", f"{failed_count} failed transaction found.", 5))
    if len(counterparties) > 12 and len(transactions) <= 50 and len(unfamiliar_counterparties) >= 6:
        signals.append(make_signal("medium", "Unfamiliar counterparty spread", f"{len(unfamiliar_counterparties)} counterparties appeared outside known trading context.", 15))
    if len(rapid_cluster) >= 4:
        signals.append(make_signal("high", "Rapid outbound drain pattern", f"{len(rapid_cluster)} large outbound transfers landed within seconds.", 36))
    if dispersion:
        signals.append(make_signal("high", "Rapid dispersion pattern", f"Funds arrived and were swept to {len(dispersion['recipients'])} recipients within 10 minutes.", 30))
    if token_transfers:
        signals.append(make_signal("low", "Token-account activity included", f"{len(token_transfers)} transaction(s) included token transfers or swaps.", 4))
    if recent:
        signals.append(make_signal("low", "Recent wallet activity", f"{len(recent)} transaction(s) occurred in the last 24 hours.", 3))
    if age_days is not None and age_days > 365:
        signals.append(make_signal("low", "Established wallet age", f"First seen {int(age_days)} days ago; age added no risk.", 0))
    elif age_days is not None and age_days < 7:
        signals.append(make_signal("medium", "Very new wallet", f"First seen about {max(1, int(age_days))} day(s) ago.", 14))
    if not signals:
        signals.append(make_signal("low", "No major risk pattern", "The scanned history did not match the current high-risk heuristics.", 2))

    score = clamp(sum(signal["points"] for signal in signals), 0, 100)
    verdict = "RED" if score >= 65 else "YELLOW" if score >= 32 else "GREEN"
    summary = {
        "GREEN": "No severe scam pattern was found in the scanned history.",
        "YELLOW": "This wallet has risk signals that deserve manual review.",
        "RED": "This wallet shows high-risk behavior. Avoid signing until each flagged transaction is understood.",
    }[verdict]
    return {"verdict": verdict, "score": score, "summary": summary, "signals": signals, "walletAddress": wallet}


class WalletPulseHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def is_blocked_static_path(self):
        requested_path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path).lstrip("/")
        blocked_names = {".env", "server.py"}
        return any(part.startswith(".") for part in Path(requested_path).parts) or requested_path in blocked_names

    def send_head(self):
        if self.is_blocked_static_path():
            self.send_error(404)
            return None
        return super().send_head()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/actions.json":
            return self.handle_actions_json()
        if parsed.path == "/api/actions/scan":
            return self.handle_blink_scan()
        if parsed.path == "/api/guardian/icon.svg":
            return self.handle_guardian_icon()
        if parsed.path == "/api/health":
            return self.handle_health()
        if parsed.path == "/guardian":
            self.path = "/index.html"
            return super().do_GET()
        if parsed.path.startswith("/api/"):
            return json_response(self, 404, {"error": "Unknown API route."})
        return super().do_GET()

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/actions.json" or parsed.path == "/api/actions/scan":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Encoding, Accept-Encoding, x-walletpulse-openai-key")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.end_headers()
            return
        if parsed.path == "/api/guardian/icon.svg":
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            return
        if parsed.path == "/guardian":
            self.path = "/index.html"
            return super().do_HEAD()
        return super().do_HEAD()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Encoding, Accept-Encoding, x-walletpulse-openai-key")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/helius/transactions":
            return self.handle_helius_transactions()
        if self.path == "/api/helius/first-seen":
            return self.handle_helius_first_seen()
        if self.path == "/api/helius/simulate":
            return self.handle_simulate_transaction()
        if self.path == "/api/openai/explain":
            return self.handle_openai_explain()
        if self.path == "/api/elevenlabs/speech":
            return self.handle_elevenlabs_speech()
        if self.path.startswith("/api/actions/scan"):
            return json_response(self, 400, {"message": "WalletPulse scan is read-only in this prototype. Open the full report for details."})
        return json_response(self, 404, {"error": "Unknown API route."})

    def handle_actions_json(self):
        return json_response(self, 200, {
            "rules": [
                {
                    "pathPattern": "/guardian",
                    "apiPath": "/api/actions/scan"
                },
                {
                    "pathPattern": "/api/actions/**",
                    "apiPath": "/api/actions/**"
                }
            ]
        })

    def handle_health(self):
        services = [
            {"name": "Helius", "ok": bool(os.environ.get("HELIUS_API_KEY"))},
            {"name": "OpenAI", "ok": bool(os.environ.get("OPENAI_API_KEY"))},
            {
                "name": "ElevenLabs",
                "ok": bool(os.environ.get("ELEVENLABS_API_KEY") and os.environ.get("ELEVENLABS_VOICE_ID")),
            },
        ]
        return json_response(self, 200, {"ok": True, "services": services})

    def handle_guardian_icon(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        verdict = (query.get("verdict", ["GREEN"])[0] or "GREEN").upper()
        color = {"GREEN": "#22c55e", "YELLOW": "#f6c343", "RED": "#ef4444"}.get(verdict, "#38bdf8")
        label = verdict if verdict in {"GREEN", "YELLOW", "RED"} else "SCAN"
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="72" fill="#0b0f10"/>
  <path d="M256 58l154 58v114c0 98-62 185-154 224-92-39-154-126-154-224V116l154-58z" fill="{color}" opacity=".18" stroke="{color}" stroke-width="22"/>
  <text x="256" y="246" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="800" fill="#f3f7f4">WP</text>
  <text x="256" y="318" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="800" fill="{color}">{label}</text>
</svg>""".encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "image/svg+xml")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(svg)))
        self.end_headers()
        self.wfile.write(svg)

    def fetch_wallet_transactions(self, wallet, limit=50):
        api_key = os.environ.get("HELIUS_API_KEY")
        if not api_key:
            raise RuntimeError("HELIUS_API_KEY is missing in .env.")

        params = urllib.parse.urlencode({
            "api-key": api_key,
            "limit": str(max(10, min(int(limit), 100))),
            "sort-order": "desc",
            "token-accounts": "balanceChanged"
        })
        url = f"https://api-mainnet.helius-rpc.com/v0/addresses/{urllib.parse.quote(wallet)}/transactions?{params}"
        status, _, body = proxy_json(url)
        if status >= 400:
            raise RuntimeError(f"Helius returned {status}.")
        payload = json.loads(body.decode("utf-8"))
        if not isinstance(payload, list):
            raise RuntimeError("Helius returned an unexpected response.")
        return [normalize_helius_transaction(tx) for tx in payload]

    def fetch_first_seen_timestamp(self, wallet):
        api_key = os.environ.get("HELIUS_API_KEY")
        if not api_key:
            return None
        before = None
        oldest = None
        for page in range(4):
            options = {"limit": 1000}
            if before:
                options["before"] = before
            rpc_payload = {
                "jsonrpc": "2.0",
                "id": f"walletpulse-blink-age-{page}",
                "method": "getSignaturesForAddress",
                "params": [wallet, options],
            }
            status, _, body = proxy_json(
                f"https://mainnet.helius-rpc.com/?api-key={urllib.parse.quote(api_key)}",
                rpc_payload,
                {"Content-Type": "application/json"},
            )
            if status >= 400:
                return None
            signatures = json.loads(body.decode("utf-8")).get("result") or []
            if not signatures:
                break
            dated = [signature for signature in signatures if signature.get("blockTime")]
            if dated:
                oldest = dated[-1]["blockTime"]
            before = signatures[-1].get("signature")
            if len(signatures) < options["limit"]:
                break
        return oldest

    def handle_blink_scan(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        wallet = (query.get("address", [""])[0] or "").strip()
        origin = base_url(self)

        if not wallet:
            return json_response(self, 200, {
                "type": "action",
                "icon": f"{origin}/api/guardian/icon.svg?verdict=SCAN",
                "title": "WalletPulse Guardian",
                "description": "Paste a Solana address to get an explainable GREEN, YELLOW, or RED wallet-risk verdict.",
                "label": "Scan Address",
                "links": {
                    "actions": [
                        {
                            "label": "Scan Address",
                            "href": f"{origin}/api/actions/scan?address={{address}}",
                            "parameters": [
                                {
                                    "name": "address",
                                    "label": "Solana address",
                                    "placeholder": "Paste address here"
                                }
                            ]
                        }
                    ]
                }
            })

        if not looks_like_solana_address(wallet):
            return json_response(self, 200, {
                "type": "action",
                "icon": f"{origin}/api/guardian/icon.svg?verdict=YELLOW",
                "title": "WalletPulse Guardian: Invalid Address",
                "description": "The address provided does not look like a base58 Solana address. Paste a valid wallet address.",
                "label": "Try Again",
                "error": {"message": "Invalid Solana address."},
                "links": {
                    "actions": [
                        {
                            "label": "Scan Address",
                            "href": f"{origin}/api/actions/scan?address={{address}}",
                            "parameters": [
                                {
                                    "name": "address",
                                    "label": "Solana address",
                                    "placeholder": "Paste address here"
                                }
                            ]
                        }
                    ]
                }
            })

        try:
            transactions = self.fetch_wallet_transactions(wallet, 50)
            first_seen = self.fetch_first_seen_timestamp(wallet)
            report = analyze_wallet(transactions, wallet, first_seen)
        except Exception as error:
            return json_response(self, 200, {
                "type": "action",
                "icon": f"{origin}/api/guardian/icon.svg?verdict=YELLOW",
                "title": "WalletPulse Guardian: Scan Unavailable",
                "description": f"Could not fetch a live scan for {wallet[:6]}...{wallet[-6:]}. {error}",
                "label": "Open Report",
                "error": {"message": "Live scan unavailable. Open WalletPulse to retry."},
                "links": {
                    "actions": [
                        {
                            "label": "Retry Scan",
                            "href": f"{origin}/api/actions/scan?address={urllib.parse.quote(wallet)}"
                        }
                    ]
                }
            })

        top_titles = ", ".join(signal["title"] for signal in sorted(report["signals"], key=lambda signal: signal["points"], reverse=True)[:3])
        return json_response(self, 200, {
            "type": "action",
            "icon": f"{origin}/api/guardian/icon.svg?verdict={report['verdict']}",
            "title": f"WalletPulse Verdict: {report['verdict']} ({report['score']}/100)",
            "description": f"Analysis for {wallet[:6]}...{wallet[-6:]}: {report['summary']} Signals: {top_titles or 'No major risk pattern'}.",
            "label": "View Report",
            "links": {
                "actions": [
                    {
                        "label": "Rescan Address",
                        "href": f"{origin}/api/actions/scan?address={urllib.parse.quote(wallet)}"
                    },
                    {
                        "label": "Scan Another",
                        "href": f"{origin}/api/actions/scan?address={{address}}",
                        "parameters": [
                            {
                                "name": "address",
                                "label": "Solana address",
                                "placeholder": "Paste address here"
                            }
                        ]
                    }
                ]
            }
        })

    def handle_helius_transactions(self):
        api_key = os.environ.get("HELIUS_API_KEY")
        if not api_key:
            return json_response(self, 500, {"error": "HELIUS_API_KEY is missing in .env."})

        payload = read_json(self)
        wallet = payload.get("walletAddress", "").strip()
        try:
            limit = int(payload.get("limit", 50))
        except (TypeError, ValueError):
            limit = 50
        if not wallet:
            return json_response(self, 400, {"error": "walletAddress is required."})
        if not looks_like_solana_address(wallet):
            return json_response(self, 400, {"error": "walletAddress does not look like a base58 Solana address."})

        params = urllib.parse.urlencode({
            "api-key": api_key,
            "limit": str(max(10, min(limit, 100))),
            "sort-order": "desc"
        })
        url = f"https://api-mainnet.helius-rpc.com/v0/addresses/{urllib.parse.quote(wallet)}/transactions?{params}"
        status, _, body = proxy_json(url)
        # Forward the upstream JSON unchanged so the browser sees the real Helius error.
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_helius_first_seen(self):
        api_key = os.environ.get("HELIUS_API_KEY")
        if not api_key:
            return json_response(self, 500, {"error": "HELIUS_API_KEY is missing in .env."})

        payload = read_json(self)
        wallet = payload.get("walletAddress", "").strip()
        if not wallet:
            return json_response(self, 400, {"error": "walletAddress is required."})
        if not looks_like_solana_address(wallet):
            return json_response(self, 400, {"error": "walletAddress does not look like a base58 Solana address."})

        before = None
        oldest = None
        for page in range(8):
            options = {"limit": 1000}
            if before:
                options["before"] = before
            rpc_payload = {
                "jsonrpc": "2.0",
                "id": f"walletpulse-age-{page}",
                "method": "getSignaturesForAddress",
                "params": [wallet, options],
            }
            status, _, body = proxy_json(
                f"https://mainnet.helius-rpc.com/?api-key={urllib.parse.quote(api_key)}",
                rpc_payload,
                {"Content-Type": "application/json"},
            )
            if status >= 400:
                return json_response(self, status, {"error": "Unable to fetch wallet age."})
            signatures = json.loads(body.decode("utf-8")).get("result") or []
            if not signatures:
                break
            dated = [signature for signature in signatures if signature.get("blockTime")]
            if dated:
                oldest = dated[-1]["blockTime"]
            before = signatures[-1].get("signature")
            if len(signatures) < options["limit"]:
                break

        return json_response(self, 200, {"firstSeenTimestamp": oldest})

    def handle_simulate_transaction(self):
        """Run a Solana simulateTransaction and translate the result into wallet-impact terms.

        Returns its own deterministic score and verdict, completely separate from wallet history.
        """
        api_key = os.environ.get("HELIUS_API_KEY")
        if not api_key:
            return json_response(self, 500, {"error": "HELIUS_API_KEY is missing in .env. The simulation endpoint uses Helius RPC."})

        payload = read_json(self)
        encoded_tx = (payload.get("transaction") or "").strip()
        viewer_wallet = (payload.get("walletAddress") or "").strip() or None
        if not encoded_tx:
            return json_response(self, 400, {"error": "transaction (base64) is required."})

        encoded_tx = "".join(encoded_tx.split())
        if len(encoded_tx) > 8192:
            return json_response(self, 400, {"error": "Transaction is too large to simulate from this endpoint."})

        decoded = parse_transaction_message(encoded_tx)
        if not decoded.get("staticKeys"):
            return json_response(self, 400, {
                "error": decoded.get("error") or "Could not decode the transaction. Paste a base64-encoded Solana transaction.",
            })

        account_keys = decoded["staticKeys"]
        rpc_payload = {
            "jsonrpc": "2.0",
            "id": "walletpulse-simulate",
            "method": "simulateTransaction",
            "params": [
                encoded_tx,
                {
                    "encoding": "base64",
                    "commitment": "confirmed",
                    "replaceRecentBlockhash": True,
                    "sigVerify": False,
                    "innerInstructions": True,
                    "accounts": {
                        "encoding": "base64",
                        "addresses": account_keys[:30],
                    },
                },
            ],
        }
        status, _, body = proxy_json(
            f"https://mainnet.helius-rpc.com/?api-key={urllib.parse.quote(api_key)}",
            rpc_payload,
            {"Content-Type": "application/json"},
        )
        if status >= 400:
            return json_response(self, status, {"error": f"Helius RPC returned {status}."})

        try:
            rpc_response = json.loads(body.decode("utf-8"))
        except Exception:
            return json_response(self, 500, {"error": "Helius RPC returned invalid JSON."})

        if rpc_response.get("error"):
            err = rpc_response["error"]
            return json_response(self, 200, {
                "ok": False,
                "error": err.get("message") if isinstance(err, dict) else str(err),
                "accountKeys": account_keys,
                "txMeta": {
                    "version": decoded.get("version"),
                    "addressLookupTableCount": len(decoded.get("addressLookupTables") or []),
                    "lookupTableAddressCount": (decoded.get("lookupTableWritableCount") or 0) + (decoded.get("lookupTableReadonlyCount") or 0),
                },
            })

        value = (rpc_response.get("result") or {}).get("value") or {}
        pre_balances = value.get("preBalances") or []
        post_balances = value.get("postBalances") or []
        pre_token = value.get("preTokenBalances") or []
        post_token = value.get("postTokenBalances") or []
        logs = value.get("logs") or []
        sim_error = value.get("err")
        units_consumed = value.get("unitsConsumed") or 0
        post_accounts = value.get("accounts") or []

        # SOL balance changes per static key.
        sol_changes = []
        for index, key in enumerate(account_keys):
            if index >= len(pre_balances) or index >= len(post_balances):
                break
            delta_lamports = (post_balances[index] or 0) - (pre_balances[index] or 0)
            if delta_lamports == 0:
                continue
            sol_changes.append({
                "address": key,
                "deltaLamports": delta_lamports,
                "deltaSol": delta_lamports / 1_000_000_000,
                "isViewer": bool(viewer_wallet) and key == viewer_wallet,
            })

        # Token-balance changes keyed by (account_index, mint).
        def token_key(entry):
            return (entry.get("accountIndex"), entry.get("mint"))

        token_pre_map = {token_key(entry): entry for entry in pre_token}
        token_post_map = {token_key(entry): entry for entry in post_token}
        token_changes = []
        for key, post in token_post_map.items():
            pre = token_pre_map.get(key)
            pre_amount = float(((pre or {}).get("uiTokenAmount") or {}).get("uiAmountString") or 0)
            post_amount = float((post.get("uiTokenAmount") or {}).get("uiAmountString") or 0)
            delta = post_amount - pre_amount
            if abs(delta) < 1e-9:
                continue
            account_index = key[0]
            owner = post.get("owner")
            address = account_keys[account_index] if isinstance(account_index, int) and account_index < len(account_keys) else None
            token_changes.append({
                "mint": key[1],
                "owner": owner,
                "address": address,
                "preAmount": pre_amount,
                "postAmount": post_amount,
                "delta": delta,
                "isViewer": bool(viewer_wallet) and (owner == viewer_wallet or address == viewer_wallet),
            })
        for key, pre in token_pre_map.items():
            if key in token_post_map:
                continue
            pre_amount = float((pre.get("uiTokenAmount") or {}).get("uiAmountString") or 0)
            if pre_amount == 0:
                continue
            account_index = key[0]
            address = account_keys[account_index] if isinstance(account_index, int) and account_index < len(account_keys) else None
            token_changes.append({
                "mint": key[1],
                "owner": pre.get("owner"),
                "address": address,
                "preAmount": pre_amount,
                "postAmount": 0,
                "delta": -pre_amount,
                "isViewer": bool(viewer_wallet) and (pre.get("owner") == viewer_wallet or address == viewer_wallet),
            })

        # Programs invoked at the top level (invoke [1]).
        program_invocations = []
        seen_programs = set()
        for line in logs:
            if isinstance(line, str) and line.startswith("Program ") and " invoke [1]" in line:
                program_id = line.split(" ", 2)[1]
                if program_id and program_id not in seen_programs:
                    seen_programs.add(program_id)
                    program_invocations.append(program_id)

        # Authority / approval / ownership-change detection from log messages.
        # SPL Token logs use `Program log: Instruction: <Name>` patterns.
        approval_events = []
        revoke_events = []
        authority_events = []
        assign_events = []
        for line in logs:
            if not isinstance(line, str):
                continue
            text = line
            if "Instruction: Approve" in text or "Instruction: ApproveChecked" in text:
                approval_events.append(text)
            elif "Instruction: Revoke" in text:
                revoke_events.append(text)
            elif "Instruction: SetAuthority" in text:
                authority_events.append(text)
            elif "Instruction: Assign" in text or "Instruction: AssignWithSeed" in text:
                assign_events.append(text)

        # Account-ownership changes (program owner of an account flipped during simulation).
        ownership_changes = []
        for index, post_account in enumerate(post_accounts):
            if not post_account or index >= len(account_keys):
                continue
            new_owner = post_account.get("owner")
            address = account_keys[index]
            if new_owner and address and new_owner != address and new_owner != "11111111111111111111111111111111":
                # We don't have the pre-owner from simulateTransaction.accounts, but a non-default owner
                # combined with an Assign event in the logs is the signal worth surfacing.
                ownership_changes.append({"address": address, "newOwner": new_owner})

        # ----- Simulation findings (each carries weighted points; total clamped to 0..100) -----
        sim_findings = []

        viewer_sol_change = next((c for c in sol_changes if c["isViewer"]), None)
        if viewer_sol_change and viewer_sol_change["deltaSol"] < -0.5:
            sim_findings.append({
                "severity": "high",
                "title": "Signer would lose SOL",
                "detail": f"Simulation shows the signer balance dropping by {abs(viewer_sol_change['deltaSol']):.4f} SOL.",
                "points": 32,
            })
        elif viewer_sol_change and viewer_sol_change["deltaSol"] < -0.001:
            sim_findings.append({
                "severity": "low",
                "title": "Small SOL outflow",
                "detail": f"Signer balance would decrease by {abs(viewer_sol_change['deltaSol']):.6f} SOL.",
                "points": 4,
            })

        viewer_token_losses = [c for c in token_changes if c["isViewer"] and c["delta"] < 0]
        viewer_token_loss_total = sum(c["delta"] for c in viewer_token_losses)
        if viewer_token_loss_total < -0.0001:
            sim_findings.append({
                "severity": "high",
                "title": "Signer would lose tokens",
                "detail": f"Token balances drop by a total of {abs(viewer_token_loss_total):.4f} units across {len(viewer_token_losses)} mint(s).",
                "points": 28,
            })

        if approval_events:
            sim_findings.append({
                "severity": "high",
                "title": "Token approval / delegate",
                "detail": f"{len(approval_events)} Approve instruction(s) in this transaction would grant a third party authority to move the signer's tokens. This is the classic drainer pattern.",
                "points": 34,
            })

        if authority_events:
            sim_findings.append({
                "severity": "high",
                "title": "SetAuthority change",
                "detail": f"{len(authority_events)} SetAuthority instruction(s) would transfer ownership of an account or mint to another address.",
                "points": 30,
            })

        if assign_events or ownership_changes:
            count = len(assign_events) or len(ownership_changes)
            sim_findings.append({
                "severity": "high",
                "title": "Account ownership change",
                "detail": f"{count} account(s) would be reassigned to a different program owner. This can hand control of an account to an unfamiliar program.",
                "points": 22,
            })

        if revoke_events:
            sim_findings.append({
                "severity": "low",
                "title": "Authority revoked",
                "detail": f"{len(revoke_events)} Revoke instruction(s) cancel an existing delegate. Usually safe; informational.",
                "points": 0,
            })

        unfamiliar_programs = [program for program in program_invocations if program not in KNOWN_GOOD_PROGRAM_IDS]
        if unfamiliar_programs:
            sim_findings.append({
                "severity": "medium",
                "title": "Unfamiliar program invoked",
                "detail": f"{len(unfamiliar_programs)} program(s) outside the known-good allowlist: {', '.join(unfamiliar_programs[:3])}.",
                "points": 14,
            })

        # Many writable accounts: drainers often touch many writable accounts at once.
        total_writable = (decoded.get("numWritableSigners") or 0) + (decoded.get("numWritableNonSigners") or 0) + (decoded.get("lookupTableWritableCount") or 0)
        if total_writable >= 8:
            sim_findings.append({
                "severity": "medium",
                "title": "Many writable accounts",
                "detail": f"This transaction would write to {total_writable} accounts, which is unusually broad for a single signature.",
                "points": 12,
            })
        elif total_writable >= 5:
            sim_findings.append({
                "severity": "low",
                "title": "Moderate write footprint",
                "detail": f"{total_writable} writable accounts is on the higher side for a typical transfer or swap.",
                "points": 4,
            })

        if units_consumed and units_consumed > 500_000:
            sim_findings.append({
                "severity": "low",
                "title": "High compute usage",
                "detail": f"Simulation consumed {units_consumed:,} compute units, well above a normal transfer or swap.",
                "points": 4,
            })

        if sim_error:
            sim_findings.append({
                "severity": "medium",
                "title": "Simulation reverted",
                "detail": "The transaction failed in simulation. Signing it on-chain would also fail or behave unexpectedly.",
                "points": 10,
            })

        # Empty case: succeeded but no signal.
        if not sim_findings:
            sim_findings.append({
                "severity": "low",
                "title": "No risky simulation signal",
                "detail": "Simulation completed without matching any of the current high-risk heuristics. Still verify the dApp source.",
                "points": 0,
            })

        sim_score = max(0, min(100, sum(item.get("points", 0) for item in sim_findings)))
        sim_verdict = "RED" if sim_score >= 65 else "YELLOW" if sim_score >= 32 else "GREEN"
        sim_summary_map = {
            "GREEN": "No high-risk pattern in the simulation. Still verify the dApp before signing.",
            "YELLOW": "This transaction has signals worth reviewing before you sign.",
            "RED": "Do not sign. The simulation shows behavior consistent with drainer or unauthorized-access patterns.",
        }

        # Friendly note when v0 lookup tables likely contributed extra accounts that weren't decoded statically.
        lookup_note = ""
        alt_total = (decoded.get("lookupTableWritableCount") or 0) + (decoded.get("lookupTableReadonlyCount") or 0)
        if alt_total:
            lookup_note = (
                f"This is a v0 transaction. {alt_total} additional address(es) were resolved server-side "
                f"through {len(decoded.get('addressLookupTables') or [])} address lookup table(s); "
                "balance changes for those addresses are still included in the simulation."
            )

        return json_response(self, 200, {
            "ok": True,
            "accountKeys": account_keys,
            "solChanges": sol_changes,
            "tokenChanges": token_changes,
            "programInvocations": program_invocations,
            "approvalEvents": len(approval_events),
            "authorityEvents": len(authority_events),
            "assignEvents": len(assign_events) + len(ownership_changes),
            "revokeEvents": len(revoke_events),
            "writableCount": total_writable,
            "logs": logs[:40],
            "unitsConsumed": units_consumed,
            "simulationError": sim_error,
            "findings": sim_findings,
            "score": sim_score,
            "verdict": sim_verdict,
            "summary": sim_summary_map[sim_verdict],
            "txMeta": {
                "version": decoded.get("version"),
                "addressLookupTableCount": len(decoded.get("addressLookupTables") or []),
                "lookupTableAddressCount": alt_total,
                "note": lookup_note,
                "numWritableSigners": decoded.get("numWritableSigners") or 0,
                "numWritableNonSigners": decoded.get("numWritableNonSigners") or 0,
            },
        })

    def handle_openai_explain(self):
        api_key = self.headers.get("x-walletpulse-openai-key") or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return json_response(self, 500, {"error": "OPENAI_API_KEY is missing in .env."})

        payload = read_json(self)
        status, _, body = proxy_json(
            "https://api.openai.com/v1/responses",
            {
                "model": payload.get("model") or os.environ.get("OPENAI_MODEL", "gpt-5"),
                "store": False,
                "instructions": "You explain WalletPulse risk reports. The deterministic score is the source of truth. Do not add claims that are not in the report.",
                "input": payload.get("prompt", ""),
            },
            {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
        )
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_elevenlabs_speech(self):
        api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
        voice_id = os.environ.get("ELEVENLABS_VOICE_ID")
        if not api_key or not voice_id:
            return json_response(self, 500, {"error": "ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID is missing in .env."})

        payload = read_json(self)
        status, headers, body = proxy_json(
            f"https://api.elevenlabs.io/v1/text-to-speech/{urllib.parse.quote(voice_id)}",
            {
                "text": payload.get("text", ""),
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": 0.62,
                    "similarity_boost": 0.75,
                    "style": 0.18,
                    "use_speaker_boost": True,
                },
            },
            {
                "Content-Type": "application/json",
                "xi-api-key": api_key,
                "Accept": "audio/mpeg",
            },
        )
        # On error ElevenLabs returns JSON, not audio. Forward the upstream content-type
        # so the browser can parse the real status (e.g. detected_unusual_activity).
        upstream_content_type = headers.get("Content-Type") or headers.get("content-type") or ("audio/mpeg" if status < 400 else "application/json")
        self.send_response(status)
        self.send_header("Content-Type", upstream_content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class ReusableThreadingTCPServer(ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    load_env()
    mimetypes.add_type("text/javascript", ".js")
    port = int(os.environ.get("PORT", "4173"))
    with ReusableThreadingTCPServer(("", port), WalletPulseHandler) as httpd:
        print(f"WalletPulse running at http://localhost:{port}")
        httpd.serve_forever()
