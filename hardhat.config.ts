import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle"; // required for tests to work using ethers
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-deploy";
import "@nomicfoundation/hardhat-verify"; // for verification of contract with linked libraries

import { GWEI } from "./test/constants/ether";

// tasks
// import "./tasks/execute_buy";
import "./tasks/deployments";
import "./tasks/get_gas_price";
import { ONE_HOUR_IN_SECONDS } from "./test/constants/time";
// import "./tasks/list_on_opensea";
// import "./tasks/get_execution";
// import "./tasks/list_on_looksrare";
// import "./tasks/buy_on_looksrare";
// import "./tasks/delegate_nft";
// import "./tasks/change_protocol_fee_fraction";


const infuraApiKey: string | undefined = process.env.INFURA_API_KEY;

export const chainIds = {
  "arbitrum-mainnet": 42161,
  avalanche: 43114,
  bsc: 56,
  hardhat: 31337,
  mainnet: 1,
  "optimism-mainnet": 10,
  "polygon-mainnet": 137,
  "polygon-mumbai": 80001,
  rinkeby: 4,
  evmos: 9001,
  goerli: 5,
  "base": 8453,
  "zora": 7777777,
};

export function getChainRpcUrl(chain: keyof typeof chainIds): string {
  let jsonRpcUrl: string;
  switch (chain) {
    case "avalanche":
      jsonRpcUrl = "https://api.avax.network/ext/bc/C/rpc";
      break;
    case "bsc":
      jsonRpcUrl = "https://bsc-dataseed1.binance.org";
      break;
    case "evmos":
      jsonRpcUrl = "https://eth.bd.evmos.org:8545";
      break;
    case "base":
      jsonRpcUrl = "https://necessary-cool-panorama.base-mainnet.discover.quiknode.pro/" + process.env.QUICKNODE_API_KEY;
      break;
    case 'zora':
      jsonRpcUrl = "https://rpc.zora.energy/";
      break;
    default:
      if (!infuraApiKey) {
        throw new Error("Please set INFURA_API_KEY in your env vars or set a jsonRpcUrl in hardhat.config.ts");
      }
      jsonRpcUrl = "https://" + chain + ".infura.io/v3/" + infuraApiKey;
  }
  return jsonRpcUrl;
}

const forkForTesting: keyof typeof chainIds = 'polygon-mainnet';

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  // Your type-safe config goes here
  solidity: {
    version: "0.8.13",
    settings: { // did work
      optimizer: {
        enabled: true,
        runs: 200,
        // runs: 4294967295,
      },
      viaIR: true, // to avoid stack too deep errors
    },
  },
  mocha: {
    timeout: 60 * 1000 * 10, // 10 minutes
  },
  // defaultNetwork: "hardhat", // default is hardhat
  networks: {
    hardhat: {
      forking: {
        url: getChainRpcUrl(forkForTesting),
      },
      chainId: chainIds[forkForTesting],
    },
    mainnet: {
      url: getChainRpcUrl('mainnet'),
      accounts: [process.env.PK_MAINNET_DEPLOYER ?? ""],
      gasPrice: 15 * GWEI.toNumber(),
      verify: {
        etherscan: {
          apiKey: process.env.MAINNET_ETHERSCAN_API_KEY ?? "",
          apiUrl: "https://api.etherscan.io/",
        },
      }
    },
    polygon: {
      url: getChainRpcUrl('polygon-mainnet'),
      accounts: [process.env.PK_MAINNET_DEPLOYER ?? ""],
      gasPrice: 200 * GWEI.toNumber(),
      verify: {
        etherscan: {
          apiKey: process.env.POLYGONSCAN_API_KEY ?? "",
          apiUrl: "https://api.polygonscan.com/",
        },
      },
    },
    base: {
      url: getChainRpcUrl('base'),
      accounts: [process.env.PK_MAINNET_DEPLOYER ?? ""],
      gasPrice: 100000050 + 10, // this doesnt actually entirely limit the gas, check https://github.com/ethereum-optimism/optimism-tutorial/tree/main/sdk-estimate-gas
      verify: {
        etherscan: {
          apiKey: process.env.BASESCAN_API_KEY ?? "",
          apiUrl: "https://api.basescan.org/",
        },
      },
    },
    zora: {
      url: getChainRpcUrl('zora'),
      accounts: [process.env.PK_MAINNET_DEPLOYER ?? ""],
    },
    rinkeby: {
      url: getChainRpcUrl('rinkeby'),
      accounts: [process.env.PK_RINKEBY_DEPLOYER ?? ""],
    },
    goerli: {
      url: getChainRpcUrl('goerli'),
      accounts: [process.env.PK_RINKEBY_DEPLOYER ?? ""],
    },
    optimism: {
      url: getChainRpcUrl('optimism-mainnet'),
      accounts: [process.env.PK_MAINNET_DEPLOYER ?? ""],
      verify: {
        etherscan: {
          apiKey: process.env.OPTIMISM_ETHERSCAN_API_KEY ?? "",
          apiUrl: "https://api-optimistic.etherscan.io/",
        },
      },
    },
    arbitrum: {
      url: getChainRpcUrl('arbitrum-mainnet'),
      accounts: [process.env.PK_RINKEBY_DEPLOYER ?? ""],
    },
    evmos: {
      url: getChainRpcUrl('evmos'),
      accounts: [process.env.PK_RINKEBY_DEPLOYER ?? ""],
    }
  },
  // hardhat-deploy config:
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
      1: '0x346a7F06100A606eEA152f2281847Fa80f841894',
      137: '0x346a7F06100A606eEA152f2281847Fa80f841894',
      4: '0xC103d1b071AFA925714eE55b2F4869300C4331C4', // but for rinkeby it will be a specific address, also for any chain with this id
      10: '0x346a7F06100A606eEA152f2281847Fa80f841894', // optimism deployer
      8453: '0x346a7F06100A606eEA152f2281847Fa80f841894',
    },
  },

  typechain: {
    externalArtifacts: ['./external_abis/**/*.json'],
  },

  etherscan: {
    apiKey: {
      mainnet: process.env.MAINNET_ETHERSCAN_API_KEY ?? "",
      polygon: process.env.POLYGONSCAN_API_KEY ?? "",
      base: process.env.BASESCAN_API_KEY ?? "",
      optimisticEthereum: process.env.OPTIMISM_ETHERSCAN_API_KEY ?? "",
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      }
    ]
  },

};

export default config;