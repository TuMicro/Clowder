import { SignatureUtils } from "../signature";
import { TraderClowderDelegateSignature } from "./delegatesignature";

console.log("");
// print current date and time
console.log("Current date and time: " + new Date().toLocaleString());
console.log("Computing SellOrderV1 type hash...");
const types = TraderClowderDelegateSignature.getSellOrderV1Types();
SignatureUtils.generateSignedDataStructTypeHash(types);
console.log("");