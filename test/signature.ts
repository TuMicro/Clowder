import { TypedDataDomain, TypedDataField } from "@ethersproject/abstract-signer";
import { ethers } from "ethers";
import { getTypeHash } from "eip-712";
import { _TypedDataEncoder } from "ethers/lib/utils";

export const VALID_SIGNATURE_BYTES = "0x1626ba7e";
export class SignatureUtils {

  /**
   * This is an implementation of encodeType from https://eips.ethereum.org/EIPS/eip-712#definition-of-encodetype
   * @param types 
   */
  static generateSignedDataStructTypeHash(types: Record<string, Array<TypedDataField>>) {
    const typesArray = Object.entries(types);
    if (typesArray.length < 1) {
      throw new Error("types must have at least one entry");
    }
    for (const [name, fields] of typesArray) {
      console.log("Type name: " + name);
      console.log(Buffer.from(getTypeHash({
        domain: {},
        types,
        primaryType: '',
        message: {},
      }, name)).toString('hex'));
    }
  }

  static async getDataHashToBeSigned(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, any>,
    provider: ethers.providers.Provider,
  ) {
    // Populate any ENS names
    const populated = await _TypedDataEncoder.resolveNames(domain, types, value, async (name: string) => {
      const resolved = await provider.resolveName(name);
      if (resolved == null) {
        throw new Error(`Could not resolve name ${name}`);
      }
      return resolved;
    });

    const paramsHash = _TypedDataEncoder.from(types).hash(value);
    const hashToBeSigned = _TypedDataEncoder.hash(populated.domain, types, populated.value);
    return {
      hashToBeSigned,
      paramsHash,
    }
  }

  /**
   * We assume the first type is the struct we want to validate against, 
   * the rest is ignored.
   * @param types 
   * @param buyOrderV1 
   */
  static validateObjectAgaintsTypes(types: Record<string, Array<TypedDataField>>,
    buyOrderV1: { [key: string]: any }) {
    const typesArray = Object.entries(types);
    if (typesArray.length < 1) {
      throw new Error("types must have at least one entry");
    }
    const [name, fields] = typesArray[0];
    // make sure each field is present
    for (const field of fields) {
      if (!(field.name in buyOrderV1)) {
        throw new Error(`missing field ${field.name}`);
      }
    }
    // make sure there are no extra fields
    for (const fieldName of Object.keys(buyOrderV1)) {
      if (!fields.find((field) => field.name === fieldName)) {
        throw new Error(`unexpected field ${fieldName}`);
      }
    }
  }
}