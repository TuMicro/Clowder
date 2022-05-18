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
  
  // sell order parameters (it you don't want to 
  // set this out you can set a very high price
  // or an expired time)
  readonly sellPrice: BigNumber; // sell WETH price 
  readonly sellPriceEndTime: BigNumber; // sell order expiration time
  readonly sellNonce: BigNumber;
}

export interface BuyOrderV1 extends BuyOrderV1Basic {
  readonly v : number;
  readonly r : string;
  readonly s : string;
}