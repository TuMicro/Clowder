// import { BigNumber, Wallet } from "ethers";
// import { task } from "hardhat/config";
// import { ClowderSignature } from "../test/ClowderMain/clowdersignature";
// import { BuyOrderV1Basic } from "../test/ClowderMain/model";
// import { getSellExecutionPriceFromPrice } from "../test/ClowderMain/utils";
// import { ETHER } from "../test/constants/ether";
// import { getUnixTimestamp, ONE_DAY_IN_SECONDS } from "../test/constants/time";
// import { ClowderMain__factory, TestERC721__factory } from "../typechain-types";
// import { LooksRareApiClient } from "../src/external_order_signature/api/looksrare_api";
// import { generateMakerOrderTypedData } from "@looksrare/sdk";
// import { SignatureUtils, VALID_SIGNATURE_BYTES } from "../test/signature";
// import { LooksRareInteractions } from "../src/external_order_signature/interactions/LooksRareInteractions";
// import { parseEther } from "ethers/lib/utils";

// task("list_on_looksrare", ""
//   + "Make sure the accounts have enough ETH and the parameters are correct.")
//   .setAction(async (taskArgs, hre) => {
//     const { ethers, deployments, getChainId } = hre;
//     const chainId = Number(await getChainId());
//     const clowderDeployment = await deployments.get("ClowderMain");

//     /* Parameters */

//     // this ERC721 collection should be imported/recognized by the marketplace
//     const userWallet = new Wallet(process.env.PK_USER ?? "", ethers.provider);
//     const executionId = BigNumber.from(0);
//     const marketplaceFees = BigNumber.from(200); // TODO: get from API or blockchain (https://github.com/LooksRare/looksrare-sdk/blob/master/doc/guide.md#how-to-retrieve-the-fees)

//     /* Preparation */

//     // getting looksrare client
//     const thirdParty = userWallet;
//     const lrc = new LooksRareApiClient(chainId);

//     // getting contracts ready
//     const clowderMain = ClowderMain__factory.connect(clowderDeployment.address, ethers.provider);
//     const execution = await clowderMain.executions(executionId);
//     const testERC721 = TestERC721__factory.connect(execution.collection, ethers.provider);

//     // building the clowder sell order
//     const buyOrder: BuyOrderV1Basic = {
//       signer: thirdParty.address,
//       collection: testERC721.address,
//       executionId,
//       contribution: BigNumber.from(0),

//       buyPrice: ETHER.mul(40),
//       buyNonce: BigNumber.from(0),
//       buyPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),

//       sellPrice: parseEther("0.01"),
//       sellPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),
//       sellNonce: BigNumber.from(0),
//     };
//     const eip712Domain = ClowderSignature.getDomain(chainId, clowderMain.address);
//     const buyOrderSigned = await ClowderSignature.signBuyOrder(buyOrder,
//       eip712Domain,
//       thirdParty
//     );
//     const protocolSellingFeeFraction = await clowderMain.protocolFeeFractionFromSelling();
//     const executionPrice = getSellExecutionPriceFromPrice(buyOrderSigned.sellPrice, protocolSellingFeeFraction);
//     let nonce = await lrc.getUserNonce(clowderMain.address); // Fetch from the api
//     if (nonce.data == null) { // retrying
//       nonce = await lrc.getUserNonce(clowderMain.address);
//       if (nonce.data == null) {
//         throw new Error("Could not get nonce from looksrare");
//       }
//     }

//     /* Execution */

//     // storing the signature on the contract
//     const txn = await clowderMain.connect(thirdParty)
//       .listOnLooksRare([buyOrderSigned], executionPrice, marketplaceFees, nonce.data);

//     // building the sell (listing) order
//     const txnReceipt = await txn.wait();
//     const orderPostBody = await LooksRareInteractions.getOrderSignatureToSendToLooksRare(
//       chainId,
//       marketplaceFees,
//       BigNumber.from(nonce.data),
//       executionId,
//       clowderMain,
//       txnReceipt,
//     );
//     console.log(orderPostBody);
//     console.log(JSON.stringify(orderPostBody));

//     // TODO: finish sending the order (https://looksrare.github.io/api-docs/#/Orders/OrderController.createOrder)

//     // console.log("Waiting for confirmation/node update (rinkeby is slow?)...");
//     // await sleep(5 * 1000);

//     // // sending the signature to the marketplace
//     // await lrc.sendOrder(orderPostBody);


//     // console.log("Listing successful! 👌");
//   });



// task("validate_looksrare_signature", "")
//   .setAction(async (taskArgs, hre) => {
//     const { ethers, deployments, getChainId } = hre;
//     const chainId = Number(await getChainId());
//     const clowderDeployment = await deployments.get("ClowderMain");

//     // getting contracts ready
//     const clowderMain = ClowderMain__factory.connect(clowderDeployment.address, ethers.provider);

//     // parameters:
//     // const makerOrder = { "isOrderAsk": true, "signer": "0x85a49C39d3A9cfd4c2459EFA8eCe5389277E304c", "collection": "0x0381916e8172d96cdDC682490B522E4f539f85D6", "price": "0x01ad1f17947239313e", "tokenId": "0x1c21", "amount": "0x01", "strategy": "0x732319A3590E4fA838C111826f9584a9A2fDEa1a", "currency": "0xc778417E063141139Fce010982780140Aa0cD5Ab", "nonce": "0x00", "startTime": "0x6298f1a8", "endTime": "0x629a4318", "minPercentageToAsk": "0x2648", "params": [], "signature": "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011b" };
//     const makerOrder = {"isOrderAsk":true,"signer":"0x0012292bCfbD99fde00faE872668379E5F0090C5","collection":"0x0381916e8172d96cdDC682490B522E4f539f85D6","price":"0x01ad1f17947239313e","tokenId":"0x09bb","amount":"0x01","strategy":"0x732319A3590E4fA838C111826f9584a9A2fDEa1a","currency":"0xc778417E063141139Fce010982780140Aa0cD5Ab","nonce":"0x00","startTime":"0x62990d24","endTime":"0x629a5e93","minPercentageToAsk":"0x2648","params":[],"signature":"0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011b"};
    
//     // validating:
//     const { domain, value, type } = generateMakerOrderTypedData(makerOrder.signer, chainId, makerOrder);
//     const trueHashes = await SignatureUtils.getDataHashToBeSigned(domain, type, value, clowderMain.provider);
//     const str = await clowderMain.isValidSignature(trueHashes.hashToBeSigned, makerOrder.signature);

//     if (str.toLowerCase() !== VALID_SIGNATURE_BYTES) {
//       console.log("Invalid signature! ❌");
//     } else {
//       console.log("Valid signature! ✌️");
//     }

//   });