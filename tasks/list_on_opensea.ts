import { BigNumber, Wallet } from "ethers";
import { task } from "hardhat/config";
import { WETH_ADDRESS } from "../test/ClowderMain/addresses";
import { ClowderSignature } from "../test/ClowderMain/clowdersignature";
import { BuyOrderV1Basic } from "../test/ClowderMain/model";
import { getMarketplaceListingPriceFromExecutionPrice, getSellExecutionPriceFromPrice } from "../test/ClowderMain/utils";
import { ETHER } from "../test/constants/ether";
import { getUnixTimestamp, ONE_DAY_IN_SECONDS } from "../test/constants/time";
import { OpenSeaSignature } from "../src/external_order_signature/opensea_signature";
import { ClowderMain__factory, TestERC721__factory } from "../typechain-types";
import { BigNumber as BigNumberJs } from 'bignumber.js'
import { ECSignature } from "opensea-js/lib/types";
import { hexStripZeros, hexZeroPad } from "ethers/lib/utils";
import { sleep } from "../src/utils";
import { getOrderHash } from "opensea-js/lib/utils/utils";

// NOTE: this doesn't work!!! (as of 01/06/2022)
task("list_on_opensea", ""
  + "Make sure the accounts have enough ETH and the parameters are correct.")
  .setAction(async (taskArgs, hre) => {
    const { ethers, deployments, getNamedAccounts, getChainId } = hre;
    const chainId = Number(await getChainId());
    const { deployer } = await getNamedAccounts();
    const clowderDeployment = await deployments.get("ClowderMain");

    /* Parameters */

    // this ERC721 collection should be imported into OpenSea
    const userWallet = new Wallet(process.env.PK_USER ?? "", ethers.provider);
    const executionId = BigNumber.from(0);
    const marketplaceFees = BigNumber.from(250);

    /* Preparation */

    // getting seaport client
    const isMainnet = chainId === 1;
    const seaport = OpenSeaSignature.getNewSeaportClient(isMainnet);
    const thirdParty = userWallet;

    // getting contracts ready
    const clowderMain = ClowderMain__factory.connect(clowderDeployment.address, ethers.provider);
    const execution = await clowderMain.executions(executionId);
    const testERC721 = TestERC721__factory.connect(execution.collection, ethers.provider);

    // building the clowder sell order
    const buyOrder: BuyOrderV1Basic = {
      signer: thirdParty.address,
      collection: testERC721.address,
      executionId,
      contribution: BigNumber.from(0),

      buyPrice: ETHER.mul(40),
      buyNonce: BigNumber.from(0),
      buyPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),

      sellPrice: ETHER.mul(30),
      sellPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),
      sellNonce: BigNumber.from(0),
    };
    const eip712Domain = ClowderSignature.getDomain(chainId, clowderMain.address);
    const buyOrderSigned = await ClowderSignature.signBuyOrder(buyOrder,
      eip712Domain,
      thirdParty
    );
    const protocolSellingFeeFraction = await clowderMain.protocolFeeFractionFromSelling();
    const executionPrice = getSellExecutionPriceFromPrice(buyOrderSigned.sellPrice, protocolSellingFeeFraction);
    const signerOrderNonce = await seaport.getNonce(clowderMain.address);


    /* Execution */

    // storing the signature on the contract
    const txn = await clowderMain.connect(thirdParty)
      .listOnOpenSea([buyOrderSigned], executionPrice, marketplaceFees);

    // building the OpenSea sell (listing) order
    const txnReceipt = await txn.wait();
    const block = await ethers.provider.getBlock(txnReceipt.blockNumber);
    const listingPrice = getMarketplaceListingPriceFromExecutionPrice(executionPrice, marketplaceFees);
    const orderWithoutNonce = await OpenSeaSignature.justCreateSellOrder(seaport, {
      asset: {
        tokenId: execution.tokenId.toString(),
        tokenAddress: execution.collection,
      },
      accountAddress: clowderMain.address,
      startAmount: 1,// is replaced below anyway (basePrice)
      paymentTokenAddress: WETH_ADDRESS[chainId], // required when using WETH or other ERC20
      expirationTime: buyOrderSigned.sellPriceEndTime.toNumber(),
    });
    orderWithoutNonce.basePrice = new BigNumberJs(listingPrice.toHexString());
    orderWithoutNonce.listingTime = new BigNumberJs(block.timestamp);
    orderWithoutNonce.salt = new BigNumberJs(block.timestamp);
    // https://github.com/ProjectWyvern/wyvern-js/blob/7823dfdf5a272ebbc6a46e66d23563a9d6cc1be2/src/types.ts#L55
    // bytes memory signature = abi.encodePacked(r, s, v); // first 32 bytes must be the executionId
    const signature: ECSignature = {
      r: hexZeroPad(hexStripZeros(executionId.toHexString()), 32),
      s: hexZeroPad(hexStripZeros(BigNumber.from(0).toHexString()), 32), // second 32 bytes must be the marketplaceId
      v: 0,
    };
    const order = {
      ...orderWithoutNonce,
      nonce: signerOrderNonce.toNumber(),
    }
    const trueHashes = await OpenSeaSignature.getOrderHash(JSON.parse(JSON.stringify(order)),
      ethers.provider,
      isMainnet);
    const orderWithoutNonceHash = getOrderHash(orderWithoutNonce); // to mimic SDK behaviour
    const orderWithSignature = {
      ...order,
      hash: orderWithoutNonceHash, // to mimic SDK behaviour
      // hash: trueHashes.hashToBeSigned,
      ...signature,
    };

    // validating the signature on the contract
    const signatureBytes = ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32", "uint8"], [signature.r, signature.s, signature.v]);
    console.log(`orderWithoutNonceHash: ${orderWithoutNonceHash}`);
    console.log(`paramsHash: ${trueHashes.paramsHash}`);
    console.log(`hashToBeSigned: ${trueHashes.hashToBeSigned}`);
    console.log(`signatureBytes: ${signatureBytes}`);
    console.log(`nonce: ${signerOrderNonce.toString()}`);
    const str = await clowderMain.isValidSignature(trueHashes.hashToBeSigned, signatureBytes);
    console.log(`isValidSignature: ${str}`);
    console.log(``);
    console.log(orderWithSignature);
    console.log(``);
    console.log(JSON.stringify(orderWithSignature));
    console.log(``);

    console.log("Waiting for confirmation/node update (rinkeby is slow?)...");
    await sleep(5 * 1000);

    // sending the signature to OpenSea
    await seaport.validateAndPostOrder(orderWithSignature);


    console.log("Listing successful! 👌");
  });

task("get_order_hashes", "")
  .setAction(async (taskArgs, hre) => {
    const { ethers, deployments, getChainId } = hre;
    const clowderDeployment = await deployments.get("ClowderMain");

    const chainId = Number(await getChainId());

    // getting seaport client
    const isMainnet = chainId === 1;
    const seaport = OpenSeaSignature.getNewSeaportClient(isMainnet);

    // getting the opensea order from the ouput of list_on_opensea
    const orderWithSignature = { "exchange": "0xdd54d660178b28f6033a953b0e55073cfa7e3744", "maker": "0x0b773fb8275d656c714123a9885c83a03c062dea", "taker": "0x0000000000000000000000000000000000000000", "quantity": "1", "makerRelayerFee": "250", "takerRelayerFee": "0", "makerProtocolFee": "0", "takerProtocolFee": "0", "makerReferrerFee": "0", "waitingForBestCounterOrder": false, "feeMethod": 1, "feeRecipient": "0x5b3256965e7c3cf26e11fcaf296dfc8807c01073", "side": 1, "saleKind": 0, "target": "0x45b594792a5cdc008d0de1c1d69faa3d16b3ddc1", "howToCall": 1, "calldata": "0xfb16a5950000000000000000000000000b773fb8275d656c714123a9885c83a03c062dea00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000381916e8172d96cddc682490b522e4f539f85d60000000000000000000000000000000000000000000000000000000000000e26000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000000", "replacementPattern": "0x000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", "staticTarget": "0x0000000000000000000000000000000000000000", "staticExtradata": "0x", "paymentToken": "0xc778417e063141139fce010982780140aa0cd5ab", "basePrice": "31080031080031080032", "extra": "0", "listingTime": "1654101216", "expirationTime": "1654187606", "salt": "1654101216", "metadata": { "asset": { "id": "3622", "address": "0x0381916e8172d96cddc682490b522e4f539f85d6" }, "schema": "ERC721" }, "hash": "0xc50e483fd0c1226cfe8f4400536cdc50790ac60ea8076ad975a52c40587281ca", "r": "0x0000000000000000000000000000000000000000000000000000000000000000", "s": "0x0000000000000000000000000000000000000000000000000000000000000000", "v": 0, "nonce": 0 };
    const trueHashes = await OpenSeaSignature.getOrderHash(orderWithSignature, ethers.provider, isMainnet);

    console.log(trueHashes);
    console.log(JSON.stringify(trueHashes));

    // TODO: parse orderWithSignature(JSON) to something readable by the seaport endpoint
    // await seaport.validateAndPostOrder(orderWithSignature);
  });




