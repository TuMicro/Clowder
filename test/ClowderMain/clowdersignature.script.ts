import { SignatureUtils } from "../signature";
import { ClowderSignature } from "./clowdersignature";

console.log("");
// print current date and time
console.log("Current date and time: " + new Date().toLocaleString());
console.log("Computing BuyOrderV1 type hash...");
const types = ClowderSignature.getBuyOrderV1Types();
SignatureUtils.generateSignedDataStructTypeHash(types);
console.log("");