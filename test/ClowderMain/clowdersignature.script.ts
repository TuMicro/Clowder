import { ClowderSignature } from "./clowdersignature";

console.log("");
// print current date and time
console.log("Current date and time: " + new Date().toLocaleString());
console.log("Computing order hashes...");
ClowderSignature.generateOrdersHashes();
console.log("");