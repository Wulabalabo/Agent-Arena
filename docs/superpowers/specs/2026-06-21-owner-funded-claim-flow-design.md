# Owner-Funded Claim Flow Design

## Goal

Make Agent pairing codes non-enumerable and make the post-claim owner funding step clear without changing custody boundaries.

## Scope

- Generate random URL-safe registration codes instead of readable sequential `PAIR-####` codes.
- Keep claim URLs path-based at `/agent-arena/claim/:registrationCode`.
- Keep raw registration codes out of ledger and registry records; existing registration-code hashes remain the persisted audit value.
- After claim finalization, show a short funding prompt for the new trading wallet.
- Funding is owner-funded and owner-signed. The platform and Agent runtime do not transfer owner funds.

## Claim UI

After the runtime credential is revealed, the claim panel shows:

- The trading wallet address.
- A short instruction to fund the wallet with `1 SUI` and `10 DUSDC`, with a clear note that this step is optional.
- A `Fund wallet` button that asks the connected owner wallet to sign a transfer of `1 SUI` and `10 DUSDC` to the new trading wallet.
- A fallback note that the owner can fund the same trading wallet later from another Sui wallet.

The funding action does not block runtime credential display. It must stay owner-signed and must not expose owner or platform private keys to the Agent runtime.

## Testing

- Backend test proves pairing codes are random-format and not the old sequential `PAIR-####` shape.
- Frontend test proves claim success renders the funding prompt and button, and that the button opens an owner wallet transaction transferring `1 SUI` and `10 DUSDC` to the trading wallet address.
