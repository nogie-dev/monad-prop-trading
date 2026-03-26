Run all Foundry tests and report results.

1. Run: `cd contracts && forge test -vvv 2>&1`
2. Report: total tests, passed, failed
3. If any test fails, analyze the failure reason and suggest a fix
4. If $ARGUMENTS is provided, run only matching tests:
   `cd contracts && forge test --match-test "$ARGUMENTS" -vvv 2>&1`
