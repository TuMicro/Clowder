// code mostly from the opensea-js sdk
const Web3 = require("web3");
import { ethers } from 'ethers';
import { _TypedDataEncoder } from 'ethers/lib/utils';
import { OpenSeaPort, Network } from 'opensea-js';
import { Asset, UnhashedOrder } from "opensea-js/lib/types";
import { TypedDataDomain } from "@ethersproject/abstract-signer";
import { getChainRpcUrl } from "../../hardhat.config";
import { OpenSeaConstants } from "../../test/constants/opensea";
import { SignatureUtils } from '../../test/signature';

export class OpenSeaSignature {

  static getNewSeaportClient(
    isMainnet = false, // if true API_KEY is required
  ) {
    const YOUR_API_KEY = process.env.OPENSEA_API_KEY ?? ""; // not required for rinkeby
    const provider = new Web3.providers.HttpProvider(getChainRpcUrl(isMainnet ? "mainnet" : "rinkeby"));
    const networkName = isMainnet ? Network.Main : Network.Rinkeby;
    const apiBaseUrl = isMainnet ? OpenSeaConstants.API_BASE_MAINNET : OpenSeaConstants.API_BASE_RINKEBY;
    return new OpenSeaPort(provider, {
      networkName,
      apiKey: YOUR_API_KEY,
      apiBaseUrl,
    });
  }

  static async justCreateSellOrder(seaport: OpenSeaPort, {
    asset,
    accountAddress,
    startAmount,
    endAmount,
    quantity = 1,
    listingTime,
    expirationTime,
    waitForHighestBid = false,
    englishAuctionReservePrice,
    paymentTokenAddress,
    extraBountyBasisPoints = 0,
    buyerAddress,
  }: {
    asset: Asset;
    accountAddress: string;
    startAmount: number;
    endAmount?: number;
    quantity?: number;
    listingTime?: number;
    expirationTime: number;
    waitForHighestBid?: boolean;
    englishAuctionReservePrice?: number;
    paymentTokenAddress?: string;
    extraBountyBasisPoints?: number;
    buyerAddress?: string;
  }) : Promise<UnhashedOrder> {
    const order = await seaport._makeSellOrder({
      asset,
      quantity,
      accountAddress,
      startAmount,
      endAmount,
      listingTime,
      expirationTime,
      waitForHighestBid,
      englishAuctionReservePrice,
      paymentTokenAddress: paymentTokenAddress || OpenSeaConstants.NULL_ADDRESS,
      extraBountyBasisPoints,
      buyerAddress: buyerAddress || OpenSeaConstants.NULL_ADDRESS,
      
    });
    return order;
  }

  static getDomain(isMainnet: boolean, verifyingContract: string): TypedDataDomain {
    return {
      name: OpenSeaConstants.EIP_712_WYVERN_DOMAIN_NAME,
      version: OpenSeaConstants.EIP_712_WYVERN_DOMAIN_VERSION,
      chainId: isMainnet ? 1 : 4,
      verifyingContract,
    };
  }

  static async getOrderHash(
    // order: UnhashedOrder & { nonce: number }, 
    order: any, // tested with the JSON of the order (order with nonce)
    provider: ethers.providers.Provider, 
    isMainnet: boolean) {
    const eip712Domain = OpenSeaSignature.getDomain(isMainnet, order.exchange);
    const onlyOrderTypes = {
      Order: OpenSeaConstants.EIP_712_ORDER_TYPES.Order,
    };
    return await SignatureUtils.getDataHashToBeSigned(eip712Domain, 
      onlyOrderTypes, 
      order,
      provider,
    );
  }
}