import { TypedDataDomain, TypedDataField } from "@ethersproject/abstract-signer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { keccak256, splitSignature, toUtf8Bytes } from "ethers/lib/utils";

export class SignatureUtils {

  static generateSignedDataHash(types: Record<string, Array<TypedDataField>>) {
    for (const [name, fields] of Object.entries(types)) {
      const structType = name + "(" + fields
        .map(field => field.type + " " + field.name).join(",") + ")";
      console.log(structType);
      console.log(keccak256(toUtf8Bytes(structType)));
    }
  }

  static validateObjectAgaintsTypes(types: Record<string, Array<TypedDataField>>,
    buyOrderV1: { [key: string]: any }) {
    // validate the buyOrderV1 object
    for (const [name, fields] of Object.entries(types)) {
      // make sure each field is present on the buyOrderV1
      for (const field of fields) {
        if (!(field.name in buyOrderV1)) {
          throw new Error(`missing field ${field.name}`);
        }
      }
      // make sure there are no extra fields on the buyOrderV1
      for (const fieldName of Object.keys(buyOrderV1)) {
        if (!fields.find((field) => field.name === fieldName)) {
          throw new Error(`unexpected field ${fieldName}`);
        }
      }
    }
  }
}