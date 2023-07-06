import { BigNumber, BigNumberish, TypedDataDomain } from "ethers";
import { ethers, network } from "hardhat";
import { ETHER, MAX_UINT256 } from "../constants/ether";
import { getUnixTimestamp, ONE_DAY_IN_SECONDS } from "../constants/time";
import { ClowderSignature } from "./clowdersignature";
import { DeployOutputs, deployForTests } from "./deployclowdermain";
import { BuyOrderV1, BuyOrderV1Basic, SellOrderV1Basic } from "./model";
import { getBuyExecutionPriceFromPrice } from "./utils";
import { deployDelegate } from "./deploydelegate";
import { ERC721, ERC721__factory, SeaportInterface__factory, TraderClowderDelegateV1, TraderClowderDelegateV1__factory, XSplitMain__factory } from "../../typechain-types";
import { OpenSeaSeaportConstants } from "../constants/seaport";
import { ZERO_ADDRESS, ZERO_BYTES32 } from "../../src/constants/zero";
import { ReservoirOracleFloorAsk, fetchOracleFloorAsk } from "../../src/api/reservoir-oracle-floor-ask";
import { TraderClowderDelegateSignature } from "./delegatesignature";
import { getChainRpcUrl } from "../../hardhat.config";
import { impersonateAccount } from "../hardhat-util";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { SplitsClient } from '@0xsplits/splits-sdk'
import { SplitMain } from "@0xsplits/splits-sdk/dist/typechain/SplitMain/ethereum";
import { formatEther } from "ethers/lib/utils";

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

    // traderClowderDelegateV1 = await deployDelegate(
    //   clowderMain.address,
    //   executionId,
    //   "0xAeB1D03929bF87F69888f381e73FBf75753d75AF" // reservoir oracle signer address
    // );
    // TODO: get the delegate address
    const nonce = await ethers.provider.getTransactionCount(clowderMain.address);
    const traderDelegateAddress = ethers.utils.getContractAddress({
      from: clowderMain.address,
      nonce: nonce,
    });
    traderClowderDelegateV1 = TraderClowderDelegateV1__factory.connect(traderDelegateAddress,
      ethers.provider);

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

      delegate: ZERO_ADDRESS, // TODO: change when we move to minimal proxy
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
      [buyOrderSigned,], // should be all buy orders
      executionPrice,
      erc721TokenId,
      [],
    );

    traderDomain = TraderClowderDelegateSignature.getDomain(chainId, traderClowderDelegateV1.address);
  });

  it("Must list on Seaport", async () => {
    const { thirdParty,
      wethTokenContract, wethHolder,
      owner: owner2 } = deployOutputs;

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
        considerationAmount: ethPrice, //with other price should fail

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

    const initialSharesOfThirdParty = await traderClowderDelegateV1.balanceOf(thirdParty.address);
    const totalShares = await traderClowderDelegateV1.totalSupply();
    expect(initialSharesOfThirdParty.eq(totalShares)).to.be.true;
    console.log("totalShares", totalShares);

    // now thirdParty transfers ~x% of the shares to owner2
    await traderClowderDelegateV1.connect(thirdParty).transfer(owner2.address, initialSharesOfThirdParty.mul(2).div(3));
    const newSharesOfThirdParty = await traderClowderDelegateV1.balanceOf(thirdParty.address);
    console.log("newSharesOfThirdParty", newSharesOfThirdParty);

    const newSharesOwner2 = await traderClowderDelegateV1.balanceOf(owner2.address);
    console.log("newSharesOwner2", newSharesOwner2);

    await traderClowderDelegateV1.connect(thirdParty).distributeFunds(ZERO_ADDRESS,
      [thirdParty.address, owner2.address]); // fails if there arent all shareHolders, max: 500 shareHolders

    console.log("thirdParty.address:", thirdParty.address);
    console.log("owner2.address:", owner2.address);
    const splitId = await traderClowderDelegateV1.payoutSplit();

    console.log("splitId", splitId);

    // make sure they get the correct funds on their 0xsplit accounts    
    const ID = "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE";
    const xSplit = XSplitMain__factory.connect(ID,
      ethers.provider);

    const thirdPartyBalance = await xSplit.getETHBalance(thirdParty.address);
    console.log("thirdPartyBalance", formatEther(thirdPartyBalance));
    const owner2Balance = await xSplit.getETHBalance(owner2.address);
    console.log("owner2Balance", formatEther(owner2Balance));
    const sumBalances = owner2Balance.add(thirdPartyBalance);
    console.log("sumBalances", formatEther(sumBalances));

    const protocolFeeM = await traderClowderDelegateV1.protocolFeeFractionFromSelling();
    const feeClowder = ethPrice.sub(sumBalances);
    console.log("feeClowder", formatEther(feeClowder));
    const protocolFee = ethPrice.mul(protocolFeeM).div(1e6);
    expect(protocolFee.eq(feeClowder)).to.be.true;


    // TODO: test with 2 initial shareHolders, since the buy
    // hacer lo que está en beforeEach pero con 2 compradores, check ClowderMain.execution:206


    //// trying with splits SDK, not working:  

    // const splitsClient = new SplitsClient({
    //   chainId,
    //   provider: ethers.provider, // ethers provider (optional, required if using any of the SplitMain functions)
    //   //signer, // ethers signer (optional, required if using the SplitMain write functions)
    //   //includeEnsNames, // boolean, defaults to false. If true, will return ens names for split recipients (only for mainnet)
    //   // If you want to return ens names on chains other than mainnet, you can pass in a mainnet provider
    //   // here. Be aware though that the ens name may not necessarily resolve to the proper address on the
    //   // other chain for non EOAs (e.g. Gnosis Safe's)
    //   //ensProvider, // ethers provider (optional)
    // });    

    // const splitMetadata = await splitsClient.getSplitMetadata({
    //   splitId: splitId,
    // });
    // console.log("splitMetadata", splitMetadata);

    // const relatedSplits_60ca = await splitsClient.getRelatedSplits({
    //   address: '0x930E443a3B79c1c96EB1869c5bE9Bc6cE89960ca',
    // });
    // //console.log("relatedSplits_60ca", relatedSplits_60ca);
    // console.log("relatedSplits_60ca.receivingFrom[0]", relatedSplits_60ca.receivingFrom[0]);

    // const relatedSplits_B65e = await splitsClient.getRelatedSplits({
    //   address: '0x293F621079543b4ACd39Fab881cC494Ef0f6B65e',
    // });
    // console.log("relatedSplits_B65e.receivingFrom[0]", relatedSplits_B65e.receivingFrom[0]);

    // const owner2UserEarning = await splitsClient.getUserEarnings({
    //   userId: owner2.address,
    // });
    // console.log("owner2UserEarning", owner2UserEarning);    

  });

  it("Test distributeFunds with WETH", async () => {
    const { thirdParty,
      wethTokenContract, wethHolder,
      owner: owner2 } = deployOutputs;

    const initialSharesOfThirdParty = await traderClowderDelegateV1.balanceOf(thirdParty.address);

    // now thirdParty transfers ~x% of the shares to owner2
    await traderClowderDelegateV1.connect(thirdParty).transfer(owner2.address, initialSharesOfThirdParty.mul(2).div(3));
    const newSharesOfThirdParty = await traderClowderDelegateV1.balanceOf(thirdParty.address);
    console.log("newSharesOfThirdParty", newSharesOfThirdParty);

    const newSharesOwner2 = await traderClowderDelegateV1.balanceOf(owner2.address);
    console.log("newSharesOwner2", newSharesOwner2);

    // wethHolder transfers weth to traderClowderDelegateV1
    const wethTransfered = ETHER.mul(2);
    await wethTokenContract.connect(wethHolder).transfer(traderClowderDelegateV1.address, wethTransfered);
    await traderClowderDelegateV1.connect(thirdParty).distributeFunds(wethTokenContract.address,
      [thirdParty.address, owner2.address]);

    const ID = "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE";
    const xSplit = XSplitMain__factory.connect(ID,
      ethers.provider);

    const protocolFeeM = await traderClowderDelegateV1.protocolFeeFractionFromSelling();

    // check owner2 should have 2/3 and thirdParty 1/3 of the weth funds (minus the 1% fee)
    const thirdPartyWethBalance = await xSplit.getERC20Balance(thirdParty.address, wethTokenContract.address);
    console.log("thirdPartyWethBalance", formatEther(thirdPartyWethBalance));
    const owner2WethBalance = await xSplit.getERC20Balance(owner2.address, wethTokenContract.address);
    console.log("owner2WethBalance", formatEther(owner2WethBalance));
    const sumWethBalances = owner2WethBalance.add(thirdPartyWethBalance);
    console.log("sumWethBalances", formatEther(sumWethBalances));
    const wethFee = wethTransfered.sub(sumWethBalances);
    console.log("wethFee", formatEther(wethFee));

    const protocolWethFee = wethTransfered.mul(protocolFeeM).div(1e6);
    expect(protocolWethFee.eq(wethFee)).to.be.true;
  });

  it("test list on Seaport with 2 holders", async () => {
    const { thirdParty,
      wethTokenContract, wethHolder,
      owner: owner2 } = deployOutputs;

    const floorAsk = { "price": 69.95994, "message": { "id": "0x9f73c90de6d96d6fbb84e1de37e2246f622407358b888d421f8446866ffddd10", "payload": "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003cae3a6b00f2dd44b", "timestamp": 1686612534, "signature": "0xfb7fd18c35b266d47c2de25c9ed5b2a9a05a47cc0f7872274baf3d44814e7d7e72057fe0e409a80a365105b16d2e566dc64cebfe3e69b6a9f2a9d22956d74f911b" }, "data": "0x00000000000000000000000000000000000000000000000000000000000000209f73c90de6d96d6fbb84e1de37e2246f622407358b888d421f8446866ffddd100000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000006487aa3600000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003cae3a6b00f2dd44b0000000000000000000000000000000000000000000000000000000000000041fb7fd18c35b266d47c2de25c9ed5b2a9a05a47cc0f7872274baf3d44814e7d7e72057fe0e409a80a365105b16d2e566dc64cebfe3e69b6a9f2a9d22956d74f911b00000000000000000000000000000000000000000000000000000000000000" };

    const initialSharesOfThirdParty = await traderClowderDelegateV1.balanceOf(thirdParty.address);

    // now thirdParty transfers ~x% of the shares to owner2
    await traderClowderDelegateV1.connect(thirdParty).transfer(owner2.address, initialSharesOfThirdParty.mul(2).div(3));
    const newSharesOfThirdParty = await traderClowderDelegateV1.balanceOf(thirdParty.address);
    console.log("newSharesOfThirdParty", newSharesOfThirdParty);

    const newSharesOwner2 = await traderClowderDelegateV1.balanceOf(owner2.address);
    console.log("newSharesOwner2", newSharesOwner2);

    // thirdParty no debería poder listar
    const priceToList2 = ETHER.mul(70);
    const sellOrder2: SellOrderV1Basic = {
      signer: thirdParty.address,

      collection: erc721Contract.address,
      tokenId: BigNumber.from(erc721TokenId),
      minNetProceeds: priceToList2,
      endTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),
      nonce: BigNumber.from(0),

      feeRecipients: [], // in prod this would be the marketplace and/or royalties fees

      seaport: OpenSeaSeaportConstants.SEAPORT_ADDRESS_1_5,
      conduitController: OpenSeaSeaportConstants.CONDUIT_CONTROLLER,
      conduitKey: OpenSeaSeaportConstants.CONDUIT_KEY,
      zone: ZERO_ADDRESS, // in prod change this (OpenSea uses a custom one for ethereum)
    };

    const sellOrderSigned2 = await TraderClowderDelegateSignature.signSellOrder(sellOrder2,
      traderDomain,
      thirdParty,
    );
    await expect(traderClowderDelegateV1.connect(thirdParty).listOnSeaport(
      [sellOrderSigned2],
      floorAsk.message,
    )).to.be.revertedWith("Selling over fairPrice: consensus not reached");

    // owner2 debería poder listar a cualquier precio por encima del floorAsk
    const priceToList3 = ETHER.mul(80);
    const sellOrder3: SellOrderV1Basic = {
      signer: owner2.address,

      collection: erc721Contract.address,
      tokenId: BigNumber.from(erc721TokenId),
      minNetProceeds: priceToList3,
      endTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),
      nonce: BigNumber.from(0),

      feeRecipients: [], // in prod this would be the marketplace and/or royalties fees

      seaport: OpenSeaSeaportConstants.SEAPORT_ADDRESS_1_5,
      conduitController: OpenSeaSeaportConstants.CONDUIT_CONTROLLER,
      conduitKey: OpenSeaSeaportConstants.CONDUIT_KEY,
      zone: ZERO_ADDRESS, // in prod change this (OpenSea uses a custom one for ethereum)
    };

    const sellOrderSigned3 = await TraderClowderDelegateSignature.signSellOrder(sellOrder3,
      traderDomain,
      owner2,
    );
    const txnOwner3 = await traderClowderDelegateV1.connect(owner2).listOnSeaport(
      [sellOrderSigned3],
      floorAsk.message,
    );
    await expect(txnOwner3 != null).to.be.true;
  });
});

describe.only("Delegate with two buyers", () => {

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
    const { clowderMain, thirdParty: thirdParty_1, eip712Domain, feeFraction,
      wethTokenContract, wethHolder,
      owner: thirdParty_2 } = deployOutputs;

    // traderClowderDelegateV1 = await deployDelegate(
    //   clowderMain.address,
    //   executionId,
    //   "0xAeB1D03929bF87F69888f381e73FBf75753d75AF" // reservoir oracle signer address
    // );
    // TODO: get the delegate address
    const nonce = await ethers.provider.getTransactionCount(clowderMain.address);
    const traderDelegateAddress = ethers.utils.getContractAddress({
      from: clowderMain.address,
      nonce: nonce,
    });
    traderClowderDelegateV1 = TraderClowderDelegateV1__factory.connect(traderDelegateAddress,
      ethers.provider);

    nftOwner = await impersonateAccount("0x45A2235b9027eaB23FfcF759c893763F0019cBff");
    erc721Contract = ERC721__factory.connect("0x220fa5ccc9404802ed6db0935eb4feefc27c937e",
      ethers.provider);
    erc721TokenId = BigNumber.from(4131);

    // print the current block number
    console.log(`Current block number: ${await ethers.provider.getBlockNumber()}`);

    const signers = [thirdParty_1, thirdParty_2];
    const buyPrice = ETHER.mul(40);
    const contribution = ETHER.mul(30);

    const signedOrders = await Promise.all(signers.map(async (signer) => {
      // getting the WETH
      await wethTokenContract.connect(signer).deposit({
        value: contribution
      });

      const order = {
        signer: signer.address,
        collection: erc721Contract.address,
        executionId,
        contribution,

        buyPrice,
        buyNonce: BigNumber.from(0),
        buyPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),

        delegate: ZERO_ADDRESS,
      };
      const orderSigned = await ClowderSignature.signBuyOrder(order,
        eip712Domain,
        signer,
      );

      // approve the clowder contract to spend thirdParty's WETH
      await wethTokenContract.connect(signer).approve(
        clowderMain.address,
        MAX_UINT256
      );

      return orderSigned;
    }));

    // approve the clowder contract to move nft holder's nfts
    await erc721Contract.connect(nftOwner).setApprovalForAll(
      clowderMain.address,
      true,
    );

    // when reviewing this code I don't understand why I added 1 here on the first place
    //const buyExecutionPrice = orderBuyPrice.mul(10_000).div(feeFraction.add(10_000)).add(1);

    const executionPrice = getBuyExecutionPriceFromPrice(buyPrice, feeFraction);
    await clowderMain.connect(nftOwner).executeOnPassiveBuyOrders(
      signedOrders, // should be all buy orders
      executionPrice,
      erc721TokenId,
      [],
    );

    traderDomain = TraderClowderDelegateSignature.getDomain(chainId, traderClowderDelegateV1.address);
  });

  it("Must list on Seaport", async () => {
    const { thirdParty: thirdParty_1,
      wethTokenContract, wethHolder,
      owner: thirdParty_2 } = deployOutputs;

    const initialSharesOfThirdParty_1 = await traderClowderDelegateV1.balanceOf(thirdParty_1.address);
    console.log("initialSharesOfThirdParty_1:", initialSharesOfThirdParty_1);
    const initialSharesOfThirdParty_2 = await traderClowderDelegateV1.balanceOf(thirdParty_2.address);
    console.log("initialSharesOfThirdParty_2:", initialSharesOfThirdParty_2);
    const totalShares = await traderClowderDelegateV1.totalSupply();
    expect((initialSharesOfThirdParty_1.add(initialSharesOfThirdParty_2)).eq(totalShares)).to.be.true;
    console.log("totalShares", totalShares);

    // build and sign the order
    const sellOrder_1: SellOrderV1Basic = {
      signer: thirdParty_1.address,

      collection: erc721Contract.address,
      tokenId: BigNumber.from(erc721TokenId),
      minNetProceeds: ETHER.mul(60),
      endTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),
      nonce: BigNumber.from(0),

      feeRecipients: [], // in prod this would be the marketplace and/or royalties fees

      seaport: OpenSeaSeaportConstants.SEAPORT_ADDRESS_1_5,
      conduitController: OpenSeaSeaportConstants.CONDUIT_CONTROLLER,
      conduitKey: OpenSeaSeaportConstants.CONDUIT_KEY,
      zone: ZERO_ADDRESS, // in prod change this (OpenSea uses a custom one for ethereum)
    };

    const sellOrder_2: SellOrderV1Basic = {
      signer: thirdParty_2.address,

      collection: erc721Contract.address,
      tokenId: BigNumber.from(erc721TokenId),
      minNetProceeds: ETHER.mul(70),
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
      floorAsk = await fetchOracleFloorAsk(sellOrder_1.collection, chainId);
      console.log(floorAsk);
      console.log(JSON.stringify(floorAsk));
    }
    // now frozen to:
    floorAsk = { "price": 69.95994, "message": { "id": "0x9f73c90de6d96d6fbb84e1de37e2246f622407358b888d421f8446866ffddd10", "payload": "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003cae3a6b00f2dd44b", "timestamp": 1686612534, "signature": "0xfb7fd18c35b266d47c2de25c9ed5b2a9a05a47cc0f7872274baf3d44814e7d7e72057fe0e409a80a365105b16d2e566dc64cebfe3e69b6a9f2a9d22956d74f911b" }, "data": "0x00000000000000000000000000000000000000000000000000000000000000209f73c90de6d96d6fbb84e1de37e2246f622407358b888d421f8446866ffddd100000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000006487aa3600000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003cae3a6b00f2dd44b0000000000000000000000000000000000000000000000000000000000000041fb7fd18c35b266d47c2de25c9ed5b2a9a05a47cc0f7872274baf3d44814e7d7e72057fe0e409a80a365105b16d2e566dc64cebfe3e69b6a9f2a9d22956d74f911b00000000000000000000000000000000000000000000000000000000000000" };

    // sign the sell order and list on OpenSea
    const sellOrderSigned_1 = await TraderClowderDelegateSignature.signSellOrder(sellOrder_1,
      traderDomain,
      thirdParty_1,
    );
    const sellOrderSigned_2 = await TraderClowderDelegateSignature.signSellOrder(sellOrder_2,
      traderDomain,
      thirdParty_2,
    );
    const txn = await traderClowderDelegateV1.connect(thirdParty_1).listOnSeaport(
      [sellOrderSigned_1, sellOrderSigned_2],
      floorAsk.message,
    );

    await expect(txn != null).to.be.true;

    const listingReceipt = await txn.wait();

    // console.log("txn: ", txn);

    // get block timestamp of listingReceipt.blockHash
    const block = await ethers.provider.getBlock(listingReceipt.blockHash);
    const blockTimestamp = block.timestamp;

    // make sure we can buy the NFT on seaport
    const seaport = SeaportInterface__factory.connect(sellOrder_1.seaport,
      ethers.provider);
    const ethPrice = ETHER.mul(70);
    // helpful for an error I was having: https://openchain.xyz/signatures?query=0xa61be9f0

    //const wethHolderBalance = await wethTokenContract.balanceOf(wethHolder.address);
    //console.log("wethHolderBalanceBefore:", wethHolderBalance);

    const seaportBuyTxn = await seaport.connect(wethHolder).fulfillBasicOrder(
      {
        basicOrderType: 0, // ETH_TO_ERC721_FULL_OPEN

        considerationToken: ZERO_ADDRESS,
        considerationIdentifier: 0,
        considerationAmount: ethPrice, //with other price should fail

        offerer: traderClowderDelegateV1.address,
        offerToken: erc721Contract.address,
        offerIdentifier: BigNumber.from(erc721TokenId),
        offerAmount: 1,

        startTime: blockTimestamp,
        endTime: sellOrder_1.endTime,

        zone: sellOrder_1.zone,
        zoneHash: ZERO_BYTES32,

        salt: BigNumber.from(0),

        offererConduitKey: sellOrder_1.conduitKey,
        fulfillerConduitKey: sellOrder_1.conduitKey,

        totalOriginalAdditionalRecipients: 0,

        additionalRecipients: [],

        signature: [],
      }, {
      value: ethPrice,
    }
    );

    //const wethHolderBalanceAfter = await wethTokenContract.balanceOf(wethHolder.address);
    //console.log("wethHolderBalanceAfter:", wethHolderBalanceAfter);

    // make sure wethHolder has the NFT
    const ownerOf = await erc721Contract.ownerOf(erc721TokenId);
    expect(ownerOf).to.equal(wethHolder.address);
    console.log("ownerOf:", ownerOf);

    /*// now thirdParty transfers ~x% of the shares to owner2
    await traderClowderDelegateV1.connect(thirdParty_1).transfer(thirdParty_2.address, initialSharesOfThirdParty_1.mul(2).div(3));
    const newSharesOfThirdParty = await traderClowderDelegateV1.balanceOf(thirdParty_1.address);
    console.log("newSharesOfThirdParty", newSharesOfThirdParty);

    const newSharesOwner2 = await traderClowderDelegateV1.balanceOf(thirdParty_2.address);
    console.log("newSharesOwner2", newSharesOwner2);*/

    await traderClowderDelegateV1.connect(thirdParty_1).distributeFunds(ZERO_ADDRESS,
      [thirdParty_1.address, thirdParty_2.address]); // fails if there arent all shareHolders, max: 500 shareHolders

    console.log("thirdParty.address:", thirdParty_1.address);
    console.log("owner2.address:", thirdParty_2.address);
    const splitId = await traderClowderDelegateV1.payoutSplit();

    console.log("splitId", splitId);

    // make sure they get the correct funds on their 0xsplit accounts    
    const ID = "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE";
    const xSplit = XSplitMain__factory.connect(ID,
      ethers.provider);

    const thirdPartyBalance = await xSplit.getETHBalance(thirdParty_1.address);
    console.log("thirdPartyBalance", formatEther(thirdPartyBalance));
    const owner2Balance = await xSplit.getETHBalance(thirdParty_2.address);
    console.log("owner2Balance", formatEther(owner2Balance));
    const sumBalances = owner2Balance.add(thirdPartyBalance);
    console.log("sumBalances", formatEther(sumBalances));

    const protocolFeeM = await traderClowderDelegateV1.protocolFeeFractionFromSelling();
    const feeClowder = ethPrice.sub(sumBalances);
    console.log("feeClowder", formatEther(feeClowder));
    const protocolFee = ethPrice.mul(protocolFeeM).div(1e6);
    expect(protocolFee.eq(feeClowder)).to.be.true;

  });
});