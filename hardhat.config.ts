import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle"; // required for tests to work using ethers
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-deploy";

// tasks
// import "./tasks/execute_buy";
// import "./tasks/deployments";
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
};

export function getVerificationConfig(chain: keyof typeof chainIds): null | {
  apiKey: string,
  apiBaseUrl: string,
} {
  if (chain === "rinkeby") {
    return {
      apiKey: process.env.ETHERSCAN_API_KEY ?? "",
      apiBaseUrl: "https://api-rinkeby.etherscan.io",
    }
  }
  if (chain === "mainnet") {
    return {
      apiKey: process.env.ETHERSCAN_API_KEY ?? "",
      apiBaseUrl: "https://api.etherscan.io",
    }
  }
  return null;
}

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
    default:
      if (!infuraApiKey) {
        throw new Error("Please set INFURA_API_KEY in your env vars or set a jsonRpcUrl in hardhat.config.ts");
      }
      jsonRpcUrl = "https://" + chain + ".infura.io/v3/" + infuraApiKey;
  }
  return jsonRpcUrl;
}

const forkForTesting: keyof typeof chainIds = 'mainnet';
const forkForVerification: keyof typeof chainIds = 'rinkeby';

const verificationConfig = getVerificationConfig(forkForVerification);
if (verificationConfig === null) {
  throw new Error(`No verification config found for ${forkForVerification}`);
}

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
      }
    },
  },
  // defaultNetwork: "hardhat", // default is hardhat
  networks: {
    hardhat: {
      forking: {
        url: getChainRpcUrl(forkForTesting),
      },
      chainId: chainIds[forkForTesting],
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
      accounts: [process.env.PK_RINKEBY_DEPLOYER ?? ""],
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
      1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
      4: '0xC103d1b071AFA925714eE55b2F4869300C4331C4', // but for rinkeby it will be a specific address, also for any chain with this id
      10: '0xC103d1b071AFA925714eE55b2F4869300C4331C4', // optimism deployer
    },
  },

  typechain: {
    externalArtifacts: ['./external_abis/**/*.json'],
  },

  verify: {
    etherscan: verificationConfig,
  }
};

export default config;