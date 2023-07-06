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


export interface FeeRecipient {
  readonly amount: BigNumber; // amount
  readonly recipient: string; // recipient address
}

export interface SellOrderV1Basic {
  readonly signer : string; // order signer

  // sell order parameters
  readonly collection: string; // collection address
  readonly tokenId: BigNumber; // tokenId
  readonly minNetProceeds: BigNumber; // minimum net proceeds
  readonly endTime: BigNumber; // order expiration time
  readonly nonce: BigNumber; // for differentiating orders (it is not possible to re-use the nonce)

  // additional fee recipients (marketplace and/or royalties, ...)
  readonly feeRecipients: FeeRecipient[];

  // Seaport protocol addresses
  readonly seaport: string; // contract address
  readonly conduitController: string; // conduit address
  readonly conduitKey: string; // conduit key
  readonly zone: string; // zone address

}

export interface SellOrderV1 extends SellOrderV1Basic {
  readonly v : number;
  readonly r : string;
  readonly s : string;
}

export enum AssetType {
  // 0: ETH on mainnet, MATIC on polygon, etc.
  NATIVE = 0,
  ERC20 = 1,
  ERC721 = 2,
  ERC1155 = 3
}

export interface TransferOrderV1Basic {
  readonly signer : string; // order signer

  readonly assetType: AssetType;
  readonly token: string;
  readonly tokenId: BigNumber;
  readonly recipient: string;

  readonly nonce: BigNumber;
}

export interface TransferOrderV1 extends TransferOrderV1Basic {
  readonly v : number;
  readonly r : string;
  readonly s : string;
}