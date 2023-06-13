import { TypedDataDomain, TypedDataField } from "@ethersproject/abstract-signer";
import { Wallet } from "ethers";
import { splitSignature } from "ethers/lib/utils";
import { SellOrderV1, SellOrderV1Basic } from "./model";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SignatureUtils } from "../signature";

export class TraderClowderDelegateSignature {
  static getDomain(chainId: number, verifyingContract: string): TypedDataDomain {
    return {
      name: "TraderClowderDelegate",
      version: "0.1",
      chainId,
      verifyingContract,
    };
  }


  static getSellOrderV1Types(): Record<string, Array<TypedDataField>> {

    return {
      SellOrderV1: [
        { name: "signer", type: "address" },

        { name: "collection", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "minNetProceeds", type: "uint256" },
        { name: "endTime", type: "uint256" },
        { name: "nonce", type: "uint256" },

        { name: "feeRecipients", type: "FeeRecipient[]" },

        { name: "seaport", type: "address" },
        { name: "conduitController", type: "address" },
        { name: "conduitKey", type: "bytes32" },
        { name: "zone", type: "address" },
      ],
      FeeRecipient: [
        { name: "amount", type: "uint256" },
        { name: "recipient", type: "address" },
      ],
    };
  }

  static async signSellOrder(
    sellOrderV1Basic: SellOrderV1Basic,
    domain: TypedDataDomain,
    signer: SignerWithAddress | Wallet): Promise<SellOrderV1> {
    if (signer.address !== sellOrderV1Basic.signer) {
      throw new Error("signer address does not match");
    }

    const types = TraderClowderDelegateSignature.getSellOrderV1Types();
    SignatureUtils.validateObjectAgaintsTypes(types, sellOrderV1Basic);

    const rawSignature = await signer._signTypedData(domain, types, sellOrderV1Basic);
    const signature = splitSignature(rawSignature);
    return {
      ...sellOrderV1Basic,
      v: signature.v,
      r: signature.r,
      s: signature.s,
    };

  }
}