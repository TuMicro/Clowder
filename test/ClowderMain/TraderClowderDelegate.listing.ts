import { BigNumber, BigNumberish, TypedDataDomain } from "ethers";
import { ethers, network } from "hardhat";
import { ETHER, MAX_UINT256 } from "../constants/ether";
import { getUnixTimestamp, ONE_DAY_IN_SECONDS } from "../constants/time";
import { ClowderSignature } from "./clowdersignature";
import { DeployOutputs, deployForTests } from "./deployclowdermain";
import { BuyOrderV1, BuyOrderV1Basic, SellOrderV1Basic } from "./model";
import { getBuyExecutionPriceFromPrice } from "./utils";
import { deployDelegate } from "./deploydelegate";
import { ERC721, ERC721__factory, SeaportInterface__factory, TraderClowderDelegateV1 } from "../../typechain-types";
import { OpenSeaSeaportConstants } from "../constants/seaport";
import { ZERO_ADDRESS, ZERO_BYTES32 } from "../../src/constants/zero";
import { ReservoirOracleFloorAsk, fetchOracleFloorAsk } from "../../src/api/reservoir-oracle-floor-ask";
import { TraderClowderDelegateSignature } from "./delegatesignature";
import { getChainRpcUrl } from "../../hardhat.config";
import { impersonateAccount } from "../hardhat-util";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

describe("Delegate", () => {

  let deployOutputs: DeployOutputs;
  let buyOrderSigned: BuyOrderV1;
  let traderClowderDelegateV1: TraderClowderDelegateV1;
  let erc721Contract: ERC721;
  let nftOwner: SignerWithAddress;
  let erc721TokenId: BigNumberish;
  let traderDomain: TypedDataDomain;
  let chainId: number;

  // execution parameters that should be accepted
  const executionId = BigNumber.from(0);

  beforeEach(async () => {

    // get hre and change network to mainnet
    await network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: getChainRpcUrl("polygon-mainnet"),
          blockNumber: 43843572,
        },
        // chainId: 137, // this doesn't work
      }],
    });

    // NOTE: no matter what jsonRpcUrl you set above
    // the chainId is still the same as set in the hardhat.config.js file

    const nn = await ethers.provider.getNetwork();
    if (nn.chainId !== 137) {
      throw new Error("Wrong network, make sure to fork polygon mainnet in the hardhat.config.js file also");
    }
    chainId = nn.chainId;

    deployOutputs = await deployForTests();
    const { clowderMain, thirdParty, eip712Domain, feeFraction,
      wethTokenContract, wethHolder,
      owner } = deployOutputs;

    traderClowderDelegateV1 = await deployDelegate(
      clowderMain.address,
      executionId,
      "0xAeB1D03929bF87F69888f381e73FBf75753d75AF" // reservoir oracle signer address
    );

    nftOwner = await impersonateAccount("0x45A2235b9027eaB23FfcF759c893763F0019cBff");
    erc721Contract = ERC721__factory.connect("0x220fa5ccc9404802ed6db0935eb4feefc27c937e",
      ethers.provider);
    erc721TokenId = BigNumber.from(4131);

    // print the current block number
    console.log(`Current block number: ${await ethers.provider.getBlockNumber()}`);

    const contribution = ETHER.mul(10);

    // getting the WETH
    await wethTokenContract.connect(thirdParty).deposit({
      value: contribution
    });

    const buyPrice = ETHER.mul(40);
    const buyOrder: BuyOrderV1Basic = {
      signer: thirdParty.address,
      collection: erc721Contract.address,
      executionId,
      contribution,

      buyPrice,
      buyNonce: BigNumber.from(0),
      buyPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),

      delegate: traderClowderDelegateV1.address,
    };
    buyOrderSigned = await ClowderSignature.signBuyOrder(buyOrder,
      eip712Domain,
      thirdParty
    );

    // approve the clowder contract to spend thirdParty's WETH (contribution)
    await wethTokenContract.connect(thirdParty).approve(
      clowderMain.address,
      MAX_UINT256
    );

    // approve the clowder contract to move nft holder's nfts
    await erc721Contract.connect(nftOwner).setApprovalForAll(
      clowderMain.address,
      true,
    );
    const executionPrice = getBuyExecutionPriceFromPrice(contribution, feeFraction);
    await clowderMain.connect(nftOwner).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      erc721TokenId,
      [],
    );

    traderDomain = TraderClowderDelegateSignature.getDomain(chainId, traderClowderDelegateV1.address);
  });

  it("Must list on Seaport", async () => {
    const { thirdParty,
      wethTokenContract, wethHolder,
      owner } = deployOutputs;

    // build and sign the order
    const sellOrder: SellOrderV1Basic = {
      signer: thirdParty.address,

      collection: erc721Contract.address,
      tokenId: BigNumber.from(erc721TokenId),
      minNetProceeds: ETHER.mul(30),
      endTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),
      nonce: BigNumber.from(0),

      feeRecipients: [], // in prod this would be the marketplace and/or royalties fees

      seaport: OpenSeaSeaportConstants.SEAPORT_ADDRESS_1_5,
      conduitController: OpenSeaSeaportConstants.CONDUIT_CONTROLLER,
      conduitKey: OpenSeaSeaportConstants.CONDUIT_KEY,
      zone: ZERO_ADDRESS, // in prod change this (OpenSea uses a custom one for ethereum)
    };

    // get reservoir signed floor ask price
    const refreshFloorAsk = false;
    let floorAsk: ReservoirOracleFloorAsk;
    if (refreshFloorAsk) {
      floorAsk = await fetchOracleFloorAsk(sellOrder.collection, chainId);
      console.log(floorAsk);
      console.log(JSON.stringify(floorAsk));
    }
    // now frozen to:
    floorAsk = { "price": 69.95994, "message": { "id": "0x9f73c90de6d96d6fbb84e1de37e2246f622407358b888d421f8446866ffddd10", "payload": "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003cae3a6b00f2dd44b", "timestamp": 1686612534, "signature": "0xfb7fd18c35b266d47c2de25c9ed5b2a9a05a47cc0f7872274baf3d44814e7d7e72057fe0e409a80a365105b16d2e566dc64cebfe3e69b6a9f2a9d22956d74f911b" }, "data": "0x00000000000000000000000000000000000000000000000000000000000000209f73c90de6d96d6fbb84e1de37e2246f622407358b888d421f8446866ffddd100000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000006487aa3600000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003cae3a6b00f2dd44b0000000000000000000000000000000000000000000000000000000000000041fb7fd18c35b266d47c2de25c9ed5b2a9a05a47cc0f7872274baf3d44814e7d7e72057fe0e409a80a365105b16d2e566dc64cebfe3e69b6a9f2a9d22956d74f911b00000000000000000000000000000000000000000000000000000000000000" };

    // sign the sell order and list on OpenSea
    const sellOrderSigned = await TraderClowderDelegateSignature.signSellOrder(sellOrder,
      traderDomain,
      thirdParty,
    );
    const txn = await traderClowderDelegateV1.connect(thirdParty).listOnSeaport(
      [sellOrderSigned],
      floorAsk.message,
    );
    const listingReceipt = await txn.wait();
    // get block timestamp of listingReceipt.blockHash
    const block = await ethers.provider.getBlock(listingReceipt.blockHash);
    const blockTimestamp = block.timestamp;

    // make sure we can buy the NFT on seaport
    const seaport = SeaportInterface__factory.connect(sellOrder.seaport,
      ethers.provider);
    const ethPrice = ETHER.mul(30);
    // helpful for an error I was having: https://openchain.xyz/signatures?query=0xa61be9f0
    const seaportBuyTxn = await seaport.connect(wethHolder).fulfillBasicOrder(
      {
        basicOrderType: 0, // ETH_TO_ERC721_FULL_OPEN

        considerationToken: ZERO_ADDRESS,
        considerationIdentifier: 0,
        considerationAmount: ethPrice,

        offerer: traderClowderDelegateV1.address,
        offerToken: erc721Contract.address,
        offerIdentifier: BigNumber.from(erc721TokenId),
        offerAmount: 1,

        startTime: blockTimestamp,
        endTime: sellOrder.endTime,

        zone: sellOrder.zone,
        zoneHash: ZERO_BYTES32,

        salt: BigNumber.from(0),

        offererConduitKey: sellOrder.conduitKey,
        fulfillerConduitKey: sellOrder.conduitKey,

        totalOriginalAdditionalRecipients: 0,

        additionalRecipients: [],

        signature: [],
      }, {
      value: ethPrice,
    }
    );

    // make sure wethHolder has the NFT
    const ownerOf = await erc721Contract.ownerOf(erc721TokenId);
    expect(ownerOf).to.equal(wethHolder.address);

  });
});