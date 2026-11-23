# QuestRegistry (CosmWasm)

Records XP and claimed quests on Safrochain and computes levels on-chain.

**Status: not compiled or tested yet.** This contract was written alongside the V1 but the environment that generated
the repository had no Rust toolchain. Run the tests first:

```bash
cd contracts/quest-registry
rustup target add wasm32-unknown-unknown
cargo test
# optimised build for deployment
docker run --rm -v "$(pwd)":/code cosmwasm/optimizer:latest
```

Messages: `award_batch` (oracle only, up to 100 awards, one claim per player and quest), `update_oracle` (admin only).
Queries: `config`, `player`, `claimed`. See `docs/V1-SCOPE.md` for how it connects to the API (oracle service, batched awards).
