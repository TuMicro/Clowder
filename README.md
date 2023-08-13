Using node 16.13.2

Solhint works through vscode even without having it on dependencies. (tested with the Juan Blanco Solidity vscode extension)

Usage:
```
# Sometimes you may need to comment out the tasks on the hardhat.config.ts file first just to generate
# the typechain types the first time. Otherwise it will fail.
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

To also report gas:
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

npx hardhat --network goerli deploy

npx hardhat --network polygon deploy --report-gas

npx hardhat --network polygon deploy --report-gas --reset 

npx hardhat --network mainnet deploy --report-gas --reset 

npx hardhat --network base deploy --report-gas

npx hardhat --network optimism deploy --report-gas

```

Logs:
* Deployment address: 
  * 2: https://rinkeby.etherscan.io/address/0xd0b5231A774a593FF2644A26a606F30eE4E4EFC1
  * 3: https://rinkeby.etherscan.io/address/0x0B773FB8275d656c714123A9885C83A03C062DeA
  * 4: https://rinkeby.etherscan.io/address/0x85a49C39d3A9cfd4c2459EFA8eCe5389277E304c (for the looksrare team testing)
  * 5: https://rinkeby.etherscan.io/address/0x0012292bCfbD99fde00faE872668379E5F0090C5

  * 0: https://arbiscan.io/address/0xF032987Bd3E4397d5E0DeB9cC87187Bdd1fE55e9

  * 0: https://polygonscan.com/address/0x1ee3e77a522dfd7faf626373d1b1dcf5a29297bf
  * 1: https://polygonscan.com/address/0x17b50399918383edf842deca072430684ec1f9e7

* Rinkeby:
  * Owner/deployer: 0xC103d1b071AFA925714eE55b2F4869300C4331C4
  * User: 0xDE33b78e877e6B20b2Fe54BFA4dBc4C67A3c6CE3
  * Initial NFT holder: 0xB36210191d34d1D2B1531A900d5695E877d3DB4d

## Post-deployment tasks

Verification:

```
# verify source code (make sure to set the config on the respective network)
npx hardhat --network optimism etherscan-verify --solc-input
```

If linked libraries are not verified, try something like this: ([source](https://github.com/nomicfoundation/hardhat/tree/main/packages/hardhat-verify#usage))

```
npx hardhat verify --network mainnet 0x06eb6e36b8fe7b7f850bd3441b15046be6e85964 "0x6f6faa6ffc43d8d4ed140f3809a38d4773d35aa6" "0xAeB1D03929bF87F69888f381e73FBf75753d75AF" "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE"

npx hardhat verify --network base 0xd600a8a3aa8dc1921fb9917fc86f4f6180b1724d "0xa278e763c368ff1eb7a37a3c7300100c1f0c4b38" "0xAeB1D03929bF87F69888f381e73FBf75753d75AF" "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE"

npx hardhat verify --network optimism 0x203d231e2e7c0380971D58C4bf37E5Ac7F6B9D8c "0xf610bBC3DB935D35d54cEB53b6fDa0FB65c2F16b" "0xAeB1D03929bF87F69888f381e73FBf75753d75AF" "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE"

```

Some useful ones:

```

# see deployments
npx hardhat deployments --network rinkeby
# get execution information
npx hardhat get_execution --execution 0 --network rinkeby
# flatten solidity
npx hardhat flatten > flattened.sol

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

Show the gas price before deploying:

```
npx hardhat  get_gas_price --network base 
```


## Licensing

The primary license for the Core smart contracts of Clowder.club is the Business Source License 1.1 (`BUSL-1.1`), see [`LICENSE`](./LICENSE).

### Exceptions

- Some files are licensed under `MIT` (as indicated in its SPDX header).