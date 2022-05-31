Using node 16.13.2

Solhint works through vscode even without having it on dependencies. (tested with the Juan Blanco Solidity vscode extension)

Usage:
```
npx hardhat compile
npx hardhat test
```

## Notes

* If you change the Order structs don't forget to update its values on the test files and update the scheme hash in solidity. You can get the schemes hashes from the first lines of `npx hardhat test`. Otherwise tests will throw `'Signature: Invalid'`


## Deployment

Base and testing command:
```
npx hardhat --network <networkName> deploy [options and flags]

npx hardhat --network hardhat deploy
```

Live networks:

```
npx hardhat --network rinkeby deploy
```

Logs:
* First deployment address: https://rinkeby.etherscan.io/address/0x93dd6331b9ef9a3987b2ab2e5bf2ea7f3ea65fe3