import { hexStripZeros, hexZeroPad, joinSignature, SignatureLike } from "@ethersproject/bytes";
import { generateMakerOrderTypedData, MakerOrder } from "@looksrare/sdk";
import { BigNumber, ContractReceipt } from "ethers";
import { getMarketplaceListingPriceFromExecutionPrice } from "../../../test/ClowderMain/utils";
import { SignatureUtils, VALID_SIGNATURE_BYTES } from "../../../test/signature";
import { ClowderMain } from "../../../typechain-types";
import { LooksRareSignature } from "../looksrare_signature";

export class LooksRareInteractions {

  static async getOrderSignatureToSendToLooksRare(
    chainId: number,
    marketplaceFees: BigNumber, // TODO: get from the calldata of the listing txn
    nonce: BigNumber,  // TODO: get from the calldata of the listing txn
    executionId: BigNumber,
    clowderMain: ClowderMain, // with provider
    txnReceipt: ContractReceipt,
  ) {
    const execution = await clowderMain.executions(executionId);
    const executionPrice = execution.sellPrice.add(execution.sellProtocolFee);
    const listingPrice = getMarketplaceListingPriceFromExecutionPrice(executionPrice, marketplaceFees);
    const block = await clowderMain.provider.getBlock(txnReceipt.blockNumber);


    const makerOrder = await LooksRareSignature.justCreateSellOrder({
      chainId,
      signerAddress: clowderMain.address,
      nonce,
      tokenAddress: execution.collection,
      tokenId: execution.tokenId,
      listingPrice,
      startTime: BigNumber.from(block.timestamp),
      endTime: BigNumber.from(execution.listingEndTime),
      marketplaceFee: marketplaceFees,
    });
    const { domain, value, type } = generateMakerOrderTypedData(makerOrder.signer, chainId, makerOrder);
    const trueHashes = await SignatureUtils.getDataHashToBeSigned(domain, type, value, clowderMain.provider);

    // bytes memory signature = abi.encodePacked(r, s, v); 
    const marketplaceId = 1;
    const signature: SignatureLike = {
      r: hexZeroPad(hexStripZeros(executionId.toHexString()), 32), // first 32 bytes must be the executionId
      s: hexZeroPad(hexStripZeros(BigNumber.from(marketplaceId).toHexString()), 32), // second 32 bytes must be the marketplaceId
      v: 0, // contract doesn't check this part anyway
    };

    // validating the signature on the contract
    const signatureBytes = joinSignature(signature);
    const str = await clowderMain.isValidSignature(trueHashes.hashToBeSigned, signatureBytes);
    if (str.toLowerCase() !== VALID_SIGNATURE_BYTES) {
      throw new Error("Invalid signature");
    }

    // building the order to send to looksrare
    const orderToSend = {
      ...makerOrder,
      signature: signatureBytes,
    };
    // convert all BigNumber type parameters in orderToSend to hex strings
    const orderToSendHex: MakerOrder = {
      ...orderToSend,
      price: BigNumber.from(orderToSend.price).toHexString(),
      tokenId: BigNumber.from(orderToSend.tokenId).toHexString(),
      amount: BigNumber.from(orderToSend.amount).toHexString(),
      startTime: BigNumber.from(orderToSend.startTime).toHexString(),
      endTime: BigNumber.from(orderToSend.endTime).toHexString(),
      nonce: BigNumber.from(orderToSend.nonce).toHexString(),
      minPercentageToAsk: BigNumber.from(orderToSend.minPercentageToAsk).toHexString(),
    };
    return orderToSendHex;
  }
}