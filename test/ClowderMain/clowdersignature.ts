import { TypedDataDomain, TypedDataField } from "@ethersproject/abstract-signer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { keccak256, splitSignature, toUtf8Bytes } from "ethers/lib/utils";
import { SignatureUtils } from "../signature";
import { BuyOrderV1, BuyOrderV1Basic } from "./model";

const DOMAIN_TYPEHASH = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";

export class ClowderSignature {
  static getDomain(chainId: number, verifyingContract: string): TypedDataDomain {
    return {
      name: "Clowder",
      version: "0.1",
      chainId,
      verifyingContract,
    };
  }

  static getBuyOrderV1Types(): Record<string, Array<TypedDataField>> {
    return {
      BuyOrderV1: [
        { name: "signer", type: "address" },

        { name: "collection", type: "address" },
        { name: "contribution", type: "uint256" },
        { name: "buyPrice", type: "uint256" },
        { name: "buyPriceEndTime", type: "uint256" },
        { name: "buyNonce", type: "uint256" },

        { name: "sellPrice", type: "uint256" },
        { name: "sellPriceEndTime", type: "uint256" },
        { name: "sellNonce", type: "uint256" },
      ],
    };
  }

  static async signBuyOrder(
    buyOrderV1Basic: BuyOrderV1Basic,
    domain: TypedDataDomain,
    signer: SignerWithAddress) : Promise<BuyOrderV1> {
    if (signer.address !== buyOrderV1Basic.signer) {
      throw new Error("signer address does not match");
    }
    const types = ClowderSignature.getBuyOrderV1Types();
    SignatureUtils.validateObjectAgaintsTypes(types, buyOrderV1Basic);
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
    SignatureUtils.generateSignedDataHash(types);
  }

}