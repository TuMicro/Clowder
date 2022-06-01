// code mostly from the opensea-js sdk
const Web3 = require("web3");
import { OpenSeaPort, Network } from 'opensea-js';
import { Asset } from "opensea-js/lib/types";
import { getOrderHash } from "opensea-js/lib/utils/utils";
import { getChainRpcUrl } from "../../hardhat.config";
import { OpenSeaConstants } from "../constants/opensea";

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
  }) {
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
    const hashedOrder = {
      ...order,
      hash: getOrderHash(order),
    };
    return hashedOrder;
  }
}