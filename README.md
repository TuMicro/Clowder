Using node 16.13.2

Solhint works through vscode even without having it on dependencies. (tested with the Juan Blanco Solidity vscode extension)

Usage:
```
npx hardhat compile
npx hardhat test
```

## Notes

* If you change the Order structs don't forget to update its values on the test files and update the scheme hash in solidity. You can get the schemes hashes from the first lines of `npx hardhat test`. Otherwise tests will throw `'Signature: Invalid'`
* If adding new files to external_abis run `npx hardhat typechain` to update the typechain types.

## Deployment

Base and testing command:
```
npx hardhat --network <networkName> deploy [options and flags]

npx hardhat --network hardhat deploy
```

Live networks:
Make sure to change the address in the MarketplaceSignatureUtil.sol
```
npx hardhat --network rinkeby deploy
```

Logs:
* Deployment address: https://rinkeby.etherscan.io/address/0xd0b5231A774a593FF2644A26a606F30eE4E4EFC1
* Rinkeby:
  * Owner/deployer: 0xC103d1b071AFA925714eE55b2F4869300C4331C4
  * User: 0xDE33b78e877e6B20b2Fe54BFA4dBc4C67A3c6CE3
  * Initial NFT holder: 0xB36210191d34d1D2B1531A900d5695E877d3DB4d

## Post-deployment tasks

Check all the tasks running:
```
npx hardhat
```

Some useful ones:
```
# see deployments
npx hardhat deployments --network rinkeby
```


Other useful ones (careful):
```
npx hardhat execute_buy --network rinkeby
npx hardhat list_on_opensea --network rinkeby

```