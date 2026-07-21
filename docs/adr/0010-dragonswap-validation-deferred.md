# DragonSwap swap validation deferred

For DApps named `dragonswap` with `hasSwap` contracts, `validateSwapTransaction` currently returns true without decoding calldata (unlike Capybara). Full DragonSwap path validation is deferred pending a stable ABI/spec; leave behavior unchanged for now and revisit later. Silent pass is an accepted known gap until then—not a silent “fix” in this pass.
