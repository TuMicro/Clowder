export function getReservoirApiKey(chainId: number) {
  switch (chainId) {
    case 137:
      return process.env.RESERVOIR_API_KEY_POLYGON ?? "";
    case 1:
      return process.env.RESERVOIR_API_KEY_ETHEREUM ?? "";
    default:
      throw new Error("Unknown chain");
  }
}

const ethereumApiBase = "https://api.reservoir.tools";
const polygonApiBase = "https://api-polygon.reservoir.tools";

export function getReservoirApiBase(chainId: number): string {
  switch (chainId) {
    case 1:
      return ethereumApiBase;
    case 137:
      return polygonApiBase;
  }
  throw new Error(`Unknown chain`);
}
