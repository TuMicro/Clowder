import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle"; // required for tests to work using ethers
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-deploy";

// tasks
import "./tasks/execute_buy";
import "./tasks/deployments";
import "./tasks/list_on_opensea";
import "./tasks/get_execution";
import "./tasks/list_on_looksrare";
import "./tasks/buy_on_looksrare";

const infuraApiKey: string | undefined = process.env.INFURA_API_KEY;
if (!infuraApiKey) {
  throw new Error("Please set your INFURA_API_KEY in a .env file");
}

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
};

export function getVerificationConfig(chain: keyof typeof chainIds): null | {
  apiKey : string,
  apiBaseUrl: string,
} {
  if (chain === "rinkeby") {
    return {
      apiKey : process.env.ETHERSCAN_API_KEY ?? "",
      apiBaseUrl: "https://api-rinkeby.etherscan.io",
    }
  }
  if (chain === "mainnet") {
    return {
      apiKey : process.env.ETHERSCAN_API_KEY ?? "",
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
    default:
      jsonRpcUrl = "https://" + chain + ".infura.io/v3/" + infuraApiKey;
  }
  return jsonRpcUrl;
}

const forkForTesting: keyof typeof chainIds = 'rinkeby';
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
  },
  // hardhat-deploy config:
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
      1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
      4: '0xC103d1b071AFA925714eE55b2F4869300C4331C4', // but for rinkeby it will be a specific address, also for any chain with this id
      "goerli": '0x84b9514E013710b9dD0811c9Fe46b837a4A0d8E0', //it can also specify a specific netwotk name (specified in hardhat.config.js)
    },
  },

  typechain: {
    externalArtifacts: ['./external_abis/**/*.json'],
  },

  verify : {
    etherscan : verificationConfig,
  }
};

export default config;