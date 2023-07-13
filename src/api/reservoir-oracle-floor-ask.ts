import { ZERO_ADDRESS } from "../constants/zero";
import { fetchWithRetry } from "../utils/fetch-utils";
import { getReservoirApiBase, getReservoirApiKey } from "./reservoir-constants";

export async function fetchOracleFloorAsk(
  collection: string,
  chainId: number,
) {

  const options = {
    method: 'GET', headers: {
      accept: '*/*', 'x-api-key':
        getReservoirApiKey(chainId)
    }
  };

  // https://docs.reservoir.tools/reference/getoraclecollectionsflooraskv6
  // https://github.com/reservoirprotocol/indexer/blob/main/packages/indexer/src/api/endpoints/oracle/get-collection-floor-ask/v6.ts
  // NOTE: if changing this also check that verifyReservoirPrice in solidity matches the function hash and parameters
  const url = getReservoirApiBase(chainId) + '/oracle/collections/floor-ask/v6?' +
    `kind=twap`
    + `&currency=${ZERO_ADDRESS}`
    + `&twapSeconds=86400` // 24 hours
    + `&collection=${collection}`
    // useNonFlaggedFloorAsk defaults to false
    ;

  console.log(`Fetching floor ask order for ${collection} on chain ${chainId}`);
  console.log(url);

  const startTime = Date.now();
  const res = await fetchWithRetry(url
    , options);
  const endTime = Date.now();
  console.log(`Fetched in ${endTime - startTime} ms`);

  if (res.status !== 200) {
    throw new Error(`Error fetching: ${res.status} - ${res.statusText}`);
  }
  const r = (await res.json()) as ReservoirOracleFloorAsk;

  return r;
}

export interface ReservoirOracleFloorAsk {
  price: number;
  message: {
    id: string;
    payload: string;
    timestamp: number;
    signature: string;
    chainId: string; // example: "137"
  };
  data?: string;
}