Using node 16.13.2

Solhint works through vscode even without having it on dependencies. (tested with the Juan Blanco Solidity vscode extension)

Usage:
```
npx hardhat compile
npx hardhat test
```

## Notes

* If you change the Order structs don't forget to update its values on the test files and update the scheme hash in solidity. You can get the schemes hashes from the first lines of `npx hardhat test`. Otherwise tests will throw `'Signature: Invalid'`
* If adding new files to external_abis (or even when changing solidity code) run `npx hardhat typechain` to update the typechain types. If this fails to update types then temporary comment out problematic tasks on the `hardhat.config.ts` file.

## Deployment

Base command: 
```
npx hardhat --network <networkName> deploy [options and flags]
```

Use this first for testing:
```
npx hardhat --network hardhat deploy --report-gas
```

Live networks:
Make sure to change the addresses (mainnet vs rinkeby) in externalmarketplaces libraries in case including them in the deployment.
```
npx hardhat --network rinkeby deploy

npx hardhat --network optimism deploy

npx hardhat --network evmos deploy

# note that gas is very different in arbitrum
# so be careful, and I mean gas units
npx hardhat --network arbitrum deploy

```

Logs:
* Deployment address: 
  * 2: https://rinkeby.etherscan.io/address/0xd0b5231A774a593FF2644A26a606F30eE4E4EFC1
  * 3: https://rinkeby.etherscan.io/address/0x0B773FB8275d656c714123A9885C83A03C062DeA
  * 4: https://rinkeby.etherscan.io/address/0x85a49C39d3A9cfd4c2459EFA8eCe5389277E304c (for the looksrare team testing)
  * 5: https://rinkeby.etherscan.io/address/0x0012292bCfbD99fde00faE872668379E5F0090C5

  * 0: https://arbiscan.io/address/0xF032987Bd3E4397d5E0DeB9cC87187Bdd1fE55e9

* Rinkeby:
  * Owner/deployer: 0xC103d1b071AFA925714eE55b2F4869300C4331C4
  * User: 0xDE33b78e877e6B20b2Fe54BFA4dBc4C67A3c6CE3
  * Initial NFT holder: 0xB36210191d34d1D2B1531A900d5695E877d3DB4d

## Post-deployment tasks

Some useful ones:
```
# verify source code (make sure to set the config with forkForVerification)
npx hardhat --network rinkeby etherscan-verify --solc-input
# see deployments
npx hardhat deployments --network rinkeby
# get execution information
npx hardhat get_execution --execution 0 --network rinkeby
# flatten solidity
npx hardhat flatten > flattened.sol

# delegate the NFT
npx hardhat delegate_nft --execution 0xb0b6ec61a3a7aa38a57a5e36947c79ad4a1c950d7a240351dd5f556f1eada3e8 --destination 0xDDc40255d888Df0d43C2ebc7a809F9221B493339 --network evmos

# change the protocol fee fraction
npx hardhat change_protocol_fee_fraction --feefraction 0 --network evmos

```

### About the custom hardhat tasks implemented


Check all the tasks:
```
npx hardhat
```

Run some useful ones (careful):
```
# if it fails for not approving just try again: (make sure the ERC721holder has the NFT as set up in the task)
npx hardhat execute_buy --network rinkeby

npx hardhat list_on_opensea --network rinkeby

npx hardhat list_on_looksrare --network rinkeby

# make sure to use the order from the list_on_looksrare task:
npx hardhat validate_looksrare_signature --network rinkeby

# if it fails for not approving just try again: 
npx hardhat buy_on_looksrare --network rinkeby

```

## Utils

Showing the commits tree:
```
git log --oneline --graph --decorate --all
```
