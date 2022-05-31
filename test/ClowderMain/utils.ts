import { BigNumber } from "ethers";

export function getSellExecutionPriceFromPrice(price: BigNumber, feeFraction: BigNumber) {
  return price.mul(10_000).div(BigNumber.from(10_000)
    .sub(feeFraction)).add(1); // we add 1 for rounding error
}

export function getBuyExecutionPriceFromPrice(price: BigNumber, feeFraction: BigNumber) {
  return price.mul(10_000).div(feeFraction.add(10_000));
}