// reference: https://docs.uniswap.org/contracts/v3/reference/deployments
export const WETH_ADDRESS_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const WETH_ADDRESS_RINKEBY = "0xc778417E063141139Fce010982780140Aa0cD5Ab";
export const WETH_ADDRESS_ARBITRUM = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
export const WETH_ADDRESS_GOERLI = "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6";
export const WETH_ADDRESS_BASE = "0x4200000000000000000000000000000000000006"; // from https://discord.com/channels/1067165013397213286/1103756907249942569/1131146773595947008
const WETH_ADDRESS_OPTIMISM = "0x4200000000000000000000000000000000000006";
const WETH_ADDRESS_ZORA = "0x4200000000000000000000000000000000000006";
export const WMATIC_ADDRESS_POLYGON = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";
export const WEVMOS_ADDRESS_EVMOS = "0xd4949664cd82660aae99bedc034a0dea8a0bd517";
export const OPENSEA_ADDRESS_RINKEBY = "0xdD54D660178B28f6033a953b0E55073cFA7e3744";

export const readToDeployChainIds = [1, 137, 8453, 10, 7777777] as const;

export type ReadyToDeploy = (typeof readToDeployChainIds)[number];

export function isOfTypeReadyToDeploy(chainId: number): chainId is ReadyToDeploy {
  return (readToDeployChainIds as readonly number[]).includes(chainId);
}

export const WETH_ADDRESS: Record<ReadyToDeploy, string> = {
  1: WETH_ADDRESS_MAINNET,
  // 4: WETH_ADDRESS_RINKEBY,
  // 42161: WETH_ADDRESS_ARBITRUM,
  // 9001: WEVMOS_ADDRESS_EVMOS,
  // 5: WETH_ADDRESS_GOERLI,
  137: WMATIC_ADDRESS_POLYGON,
  8453: WETH_ADDRESS_BASE,
  10: WETH_ADDRESS_OPTIMISM,
  7777777: WETH_ADDRESS_ZORA,
};

// from https://docs.0xsplits.xyz/core/split#addresses
export const SPLITMAIN_ADDRESS: Record<ReadyToDeploy, string> = {
  1: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
  137: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
  8453: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",// based on https://discord.com/channels/902948861285371994/918293946084511795/1129534938505560205
  10: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
  7777777: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
}

// from https://docs.reservoir.tools/reference/getoraclecollectionsflooraskv6
// and https://docs.reservoir.tools/reference/supported-chains
export const RESERVOIR_ORACLE_VERIFIER_ADDRESS: Record<ReadyToDeploy, string> = {
  1: "0xAeB1D03929bF87F69888f381e73FBf75753d75AF",
  137: "0xAeB1D03929bF87F69888f381e73FBf75753d75AF",
  8453: "0xAeB1D03929bF87F69888f381e73FBf75753d75AF",
  10: "0xAeB1D03929bF87F69888f381e73FBf75753d75AF",
  7777777: "0xAeB1D03929bF87F69888f381e73FBf75753d75AF",
}