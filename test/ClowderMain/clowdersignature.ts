import { TypedDataDomain, TypedDataField } from "@ethersproject/abstract-signer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { splitSignature } from "ethers/lib/utils";
import { SignatureUtils } from "../signature";
import { BuyOrderV1, BuyOrderV1Basic } from "./model";

const debug = false;

export class ClowderSignature {
  static getDomain(chainId: number, verifyingContract: string): TypedDataDomain {
    return {
      name: "Clowder",
      version: "0.2",
      chainId,
      verifyingContract,
    };
  }

  static getBuyOrderV1Types(): Record<string, Array<TypedDataField>> {
    return {
      BuyOrderV1: [
        { name: "signer", type: "address" },

        { name: "collection", type: "address" },
        { name: "executionId", type: "uint256" },
        { name: "contribution", type: "uint256" },

        { name: "buyPrice", type: "uint256" },
        { name: "buyPriceEndTime", type: "uint256" },
        { name: "buyNonce", type: "uint256" },

        { name: "delegate", type: "address" },
      ],
    };
  }

  static async signBuyOrder(
    buyOrderV1Basic: BuyOrderV1Basic,
    domain: TypedDataDomain,
    signer: SignerWithAddress | Wallet) : Promise<BuyOrderV1> {
    if (signer.address !== buyOrderV1Basic.signer) {
      throw new Error("signer address does not match");
    }
    const types = ClowderSignature.getBuyOrderV1Types();
    SignatureUtils.validateObjectAgaintsTypes(types, buyOrderV1Basic);
    
    if (debug) {
      console.log("showing signature input sent to provider:");
      console.log(JSON.stringify(domain));
      console.log(JSON.stringify(types));
      console.log(JSON.stringify(buyOrderV1Basic));
    }

    const rawSignature = await signer._signTypedData(domain, types, buyOrderV1Basic);
    const signature = splitSignature(rawSignature);
    return {
      ...buyOrderV1Basic,
      v: signature.v,
      r: signature.r,
      s: signature.s,
    }
  }


  static generateOrdersHashes() {
    const types = ClowderSignature.getBuyOrderV1Types();
    SignatureUtils.generateSignedDataStructHash(types);
  }

}