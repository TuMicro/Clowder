// code mostly from the opensea-js sdk
import { OpenSeaPort } from "opensea-js";
import { Asset } from "opensea-js/lib/types";
import { getOrderHash } from "opensea-js/lib/utils/utils";
import { OpenSeaConstants } from "../constants/opensea";

export class OpenSeaSignature {
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