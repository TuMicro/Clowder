import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle"; // required for tests to work using ethers
import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import "hardhat-gas-reporter";

const infuraApiKey: string | undefined = process.env.INFURA_API_KEY;
if (!infuraApiKey) {
  throw new Error("Please set your INFURA_API_KEY in a .env file");
}

const chainIds = {
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

function getChainRpcUrl(chain: keyof typeof chainIds): string {
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


// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  // Your type-safe config goes here
  solidity: {
    version: "0.8.13",
    // settings: { // did work
    //   optimizer: {
    //     enabled: true,
    //     runs: 4294967295,
    //   }
    // },
  },
  // defaultNetwork: "hardhat", // default is hardhat
  networks: {
    hardhat: {
      forking: {
        url: getChainRpcUrl("mainnet"),
      },
    },
  },
};

export default config;