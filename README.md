# WalletPulse Guardian

> Pre-sign wallet risk for Solana. Rules decide. AI explains.

WalletPulse Guardian is an explainable Solana wallet-risk scanner. It fetches recent wallet activity, scores deterministic security signals, and turns the result into a clear `GREEN`, `YELLOW`, or `RED` verdict before a user signs or trusts an address — and before they sign a transaction, it can simulate that transaction and surface what would actually happen.

**Live demo:** https://https://wallet-pulse-guardian.vercel.app/
**Validation:** Tested against 5 wallet addresses publicly reported on ChainAbuse — 4 returned RED, 1 returned YELLOW.

## Two independent verdicts

WalletPulse runs **two separate risk engines** that never get merged into one number:

1. **Wallet history verdict** — scores the address based on its on-chain behavior
2. **Transaction simulation verdict** — scores the specific transaction you're about to sign

When the two diverge, a combined warning fires: *"Wallet is GREEN, but this transaction is RED. Do not sign."*

## Features

### Wallet history scanning
- Live Solana history via Helius
- Deterministic risk score (0–100) with explainable signals
- Community blocklist of publicly-reported scam addresses
- Drainer spoke-pattern detection (many senders → few destinations)
- Bot-like activity rate (high throughput on young wallets)
- Address-poisoning lookalike detection
- Suspicious vanity suffix (non-system addresses ending in `11111`)
- Dusting and small unsolicited inbound transfers
- Rapid outbound drain cluster detection
- Rapid dispersion (funds arrive and are swept to many recipients)
- "No DeFi or NFT footprint" check (system-only wallets)
- Wallet age and volume-to-age ratio
- Known-good program context for Jupiter, Raydium, Orca, Magic Eden, Tensor, Pump.fun, Drift, Mango, OKX

### Pre-sign transaction simulation
Paste any base64 transaction → WalletPulse runs Solana's `simulateTransaction` and surfaces:
- SOL loss/gain for the signer
- Token loss/gain for the signer
- Token approval / delegate (the classic drainer pattern)
- SetAuthority changes
- Account ownership changes
- Unfamiliar programs invoked
- Writable-account spread (drainers touch many accounts)
- High compute usage
- Simulation revert detection

### AI and voice
- OpenAI explains the verdict in plain language, but the model never invents the score
- ElevenLabs Generate Speech turns each verdict into a spoken warning
- Browser speech fallback when ElevenLabs is unavailable

### Sharing
- Solana Actions / Blinks endpoint for shareable verdict cards on X
- Read-only by design — a security preview should never ask you to sign

## Demo flow

1. Open WalletPulse
2. Paste a Solana wallet address
3. Choose `Sample data` or `Live Helius`
4. Run the scan — see verdict, score, signals, recent activity, recommended action
5. Optionally: simulate a transaction in the bottom panel for a separate transaction-level verdict
6. Optionally: generate AI explanation or voice warning

## Setup

Install Python dependencies (only `solders` is required):

```bash
pip install -r requirements.txt
```

Create a local `.env` file in the project root:

```bash
HELIUS_API_KEY=your_helius_key_here
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
PORT=4173
```

Start the local server:

```bash
python3 server.py
```

Open `http://localhost:4173`.

You can open `index.html` directly for sample-only mode. Live Helius scans, OpenAI, ElevenLabs voice, Blink endpoints, and pre-sign transaction simulation require `server.py`.

Visit `/api/health` to see which keys the server has loaded.

## Environment variables

| Variable | Purpose |
|---|---|
| `HELIUS_API_KEY` | Live wallet history fetching, transaction simulation, wallet-age analysis |
| `OPENAI_API_KEY` | Optional. Used only for the AI explanation polish |
| `OPENAI_MODEL` | Defaults to `gpt-5` when `OPENAI_API_KEY` is present |
| `ELEVENLABS_API_KEY` | Text-to-speech warnings |
| `ELEVENLABS_VOICE_ID` | Defaults to `21m00Tcm4TlvDq8ikWAM` |
| `PORT` | Defaults to `4173`. Render injects its own. |

Keep `.env` local. Do not publish real API keys.

## Architecture
index.html         UI shell
styles.css         Responsive styling
app.js             Frontend state, risk engine (mirror of server engine for sample mode), simulation UI, AI/voice handlers
server.py          Python proxy + canonical risk engine, transaction simulation handler, OpenAI/ElevenLabs proxies, and Solana Actions endpoint
requirements.txt   solders (Solana primitives for transaction decoding)

The most technically novel piece of code is `handle_simulate_transaction` in `server.py` — it decodes a base64 Solana transaction, calls Helius `simulateTransaction`, and translates the response into wallet-impact terms with its own deterministic risk score.

## Risk engine

WalletPulse uses additive risk signals with severity labels and point values. Each scan or simulation produces a list of signals; their points are summed and clamped to `0–100`.

| Verdict | Score range |
|---|---|
| GREEN | 0–31 |
| YELLOW | 32–64 |
| RED | 65–100 |

Every signal carries a severity label, a human-readable detail string, and a weighted point value. The scoring is deterministic — same input always produces the same verdict — and every flag traces back to a specific function in `server.py`.

## Solana Actions / Blinks

WalletPulse exposes a read-only Action for verdict previews:
GET /actions.json
GET /api/actions/scan?address={SOLANA_ADDRESS}
GET /api/guardian/icon.svg?verdict=RED
GET /guardian?address={SOLANA_ADDRESS}

Flow:

1. A user shares a WalletPulse link such as `/guardian?address=...`
2. A Blink-aware client reads `/actions.json` to discover the Action API path
3. The client calls `/api/actions/scan?address=...`
4. WalletPulse runs the risk engine and returns Action metadata JSON
5. The client renders a card with the verdict, score, icon, summary, and scan buttons
6. If the user opens the full report, `/guardian?address=...` loads the app and auto-scans

This prototype is read-only by design. A signable "report" or "blocklist" Action would require an on-chain registry program — that's roadmap.

## Partner integrations

- **Helius** — Live Solana wallet activity, historical signatures, RPC for `simulateTransaction`
- **OpenAI** — Optional verdict explanation (deterministic score is the source of truth)
- **ElevenLabs** — Spoken warnings via Generate Speech
- **Solana Actions / Blinks** — Shareable interactive verdict cards
- **solders** — Solana primitives library used to decode transactions for simulation

## Notes

- ElevenLabs `401` usually means one of two things. (1) The `xi-api-key` header is missing or wrong — check `ELEVENLABS_API_KEY` in `.env`. (2) The response body contains `{"detail":{"status":"detected_unusual_activity",...}}`, which means ElevenLabs Free Tier is blocked from this network because of VPN/proxy/shared-IP. The fix is a paid ElevenLabs plan or a different network. WalletPulse surfaces the real upstream reason in the status line and falls back to browser speech in either case.
- ElevenLabs `402` means the account needs credits, quota, or billing enabled.
- This is a hackathon prototype, not a final security product. Users should still verify suspicious dApps, transaction details, and wallet prompts manually.

## Roadmap

- On-chain reputation registry for community-sourced risk reports (would unlock signable blocklist Actions)
- Chrome extension that intercepts wallet sign prompts and overlays the verdict pre-approval
- Helius webhook streaming for live risk updates mid-session
- Funding-source analysis (flag wallets first funded by suspected feeder/mixer addresses)
- First-window vs. last-window divergence detection (catches wallets that "warm up" before draining)