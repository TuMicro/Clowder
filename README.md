Using node 16.13.2

Solhint works through vscode even without having it on dependencies. (tested with the Juan Blanco Solidity vscode extension)

Usage:
```
npx hardhat compile
npx hardhat test
```

## Deployment notes

Before deployment don't forget to:
* Run the order hash generation scripts (signature.ts) and paste the output in the solidity order libraries.
