import { BigNumber } from "ethers";

export interface BuyOrderV1Basic {
  readonly signer : string; // order signer

  // buy order parameters
  readonly collection: string; // collection address
  readonly executionId: BigNumber; // collection address
  readonly contribution: BigNumber; // WETH contribution
  readonly buyPrice: BigNumber; // buy WETH price
  readonly buyPriceEndTime: BigNumber; // order expiration time
  readonly buyNonce: BigNumber; // for differentiating orders (it is not possible to re-use the nonce)
  
  readonly delegate : string; // delegate address
}

export interface BuyOrderV1 extends BuyOrderV1Basic {
  readonly v : number;
  readonly r : string;
  readonly s : string;
}