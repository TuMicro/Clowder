import { expect } from "chai";
import { BigNumber } from "ethers";
import { deployForTests, DeployOutputs } from "./deploy";
import { ClowderSignature } from "./clowdersignature";
import { ETHER, MAX_UINT256 } from "../constants/ether";
import { getUnixTimestamp, ONE_DAY_IN_SECONDS } from "../constants/time";
import { BuyOrderV1, BuyOrderV1Basic } from "./model";
import { formatEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

describe("Execution functions", () => {
  let deployOutputs: DeployOutputs;
  let buyOrder: BuyOrderV1Basic;
  let buyOrderSigned: BuyOrderV1;

  // execution parameters that should be accepted
  let executionPrice: BigNumber;
  let protocolFee: BigNumber;
  let price: BigNumber;
  const executionId = BigNumber.from(0);

  beforeEach(async () => {
    deployOutputs = await deployForTests();
    const { clowderMain, thirdParty, eip712Domain, feeFraction,
      testERC721, testERC721Holder, wethTokenContract, wethHolder } = deployOutputs;

    executionPrice = ETHER.mul(10);
    protocolFee = executionPrice.mul(feeFraction).div(10_000);
    price = executionPrice.add(protocolFee);


    const contribution = price;

    // getting the WETH
    await wethTokenContract.connect(thirdParty).deposit({
      value: contribution
    });

    const buyPrice = ETHER.mul(40);
    buyOrder = {
      signer: thirdParty.address,
      collection: testERC721.address,
      executionId,
      contribution,

      buyPrice,
      buyNonce: BigNumber.from(0),
      buyPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),

      sellPrice: ETHER.mul(30),
      sellPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),
      sellNonce: BigNumber.from(0),
    };
    buyOrderSigned = await ClowderSignature.signBuyOrder(buyOrder,
      eip712Domain,
      thirdParty
    );

    // approve the clowder contract to spend thirdParty's WETH
    await wethTokenContract.connect(thirdParty).approve(
      clowderMain.address,
      MAX_UINT256
    );

    // approve the clowder contract to move nft holder's nfts
    await testERC721.connect(testERC721Holder).setApprovalForAll(
      clowderMain.address,
      true,
    );

    // approve the clowder contract to spend wethHolder's WETH
    await wethTokenContract.connect(wethHolder).approve(
      clowderMain.address,
      MAX_UINT256
    );
  });

  it("Must respect the order buyPrice", async () => {
    const { clowderMain, thirdParty, nonOwner, feeFraction,
      testERC721TokenId } = deployOutputs;

    const initialNonceState = await clowderMain.isUsedBuyNonce(thirdParty.address, 0);
    expect(initialNonceState).to.equal(false);

    // testing price rejection
    const buyPrice = buyOrder.buyPrice;
    const something = BigNumber.from(10); // 10 wei
    const bigEnoughExecutionPrice = buyPrice.mul(10_000).div(feeFraction.add(10_000)).add(something);
    const bigEnoughWholePrice = bigEnoughExecutionPrice.mul(feeFraction.add(10_000)).div(10_000);
    expect(bigEnoughWholePrice.gt(buyPrice)).to.be.true;
    await expect(clowderMain.connect(nonOwner).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      bigEnoughExecutionPrice, // price is bigger than the 40 eth price specified in the buy order
      1)).to.be.revertedWith("Order can't accept price");

    // testing nonce rejection
    await expect(clowderMain.connect(nonOwner).executeOnPassiveBuyOrders(
      [buyOrderSigned, buyOrderSigned], // using the same nonce twice
      executionPrice,
      1)).to.be.revertedWith("Order nonce is unusable");

    // testing price acceptance (with a non owner of the NFT), transfer
    // error means prices were accepted by the contract
    await expect(clowderMain.connect(nonOwner).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      testERC721TokenId)).to.be.revertedWith('ERC721: transfer from incorrect owner');

  });

  it("Must reject a cancelled buy order", async () => {
    const { clowderMain, thirdParty,
      testERC721Holder, testERC721TokenId } = deployOutputs;

    const buyOrders = [buyOrderSigned]; // signed by thirdParty
    const txn1 = await clowderMain.connect(thirdParty).cancelBuyOrders(buyOrders.map(o => o.buyNonce));
    const txnReceipt1 = await txn1.wait();
    // print gas costs:
    console.log("gas costs 1 (there was change from false to true): " + txnReceipt1.gasUsed.toString());

    const txn2 = await clowderMain.connect(thirdParty).cancelBuyOrders(buyOrders.map(o => o.buyNonce));
    const txnReceipt2 = await txn2.wait();
    // print gas costs:
    console.log("gas costs 2 (no change from false to true): " + txnReceipt2.gasUsed.toString());

    await expect(clowderMain.connect(testERC721Holder).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      testERC721TokenId
    )).to.be.revertedWith("Order nonce is unusable");
  });

  it("Must transfer the NFT and required amounts. Must be able to sell", async () => {
    const { clowderMain, feeReceiver, owner,
      testERC721, testERC721Holder, testERC721TokenId, wethTokenContract,
      wethHolder, eip712Domain, thirdParty } = deployOutputs;

    const nftBalanceBefore = await testERC721.balanceOf(clowderMain.address);
    const buyerWethBalanceBefore = await wethTokenContract.balanceOf(buyOrder.signer);
    const sellerWethBalanceBefore = await wethTokenContract.balanceOf(testERC721Holder.address);
    const feeReceiverBalanceBefore = await wethTokenContract.balanceOf(feeReceiver.address);
    await clowderMain.connect(testERC721Holder).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      testERC721TokenId
    );
    const nftBalanceAfter = await testERC721.balanceOf(clowderMain.address);
    const buyerWethBalanceAfter = await wethTokenContract.balanceOf(buyOrder.signer);
    const sellerWethBalanceAfter = await wethTokenContract.balanceOf(testERC721Holder.address);
    const feeReceiverBalanceAfter = await wethTokenContract.balanceOf(feeReceiver.address);

    // protocol fees
    expect(feeReceiverBalanceAfter.sub(feeReceiverBalanceBefore).eq(protocolFee)).to.be.true;
    // nft transfer
    expect(nftBalanceAfter.sub(nftBalanceBefore).eq(1)).to.be.true;
    // buyer WETH transfer
    const buyerContribution = buyerWethBalanceBefore.sub(buyerWethBalanceAfter);
    expect(buyerContribution.eq(price)).to.be.true;
    // seller WETH transfer
    expect(sellerWethBalanceAfter.sub(sellerWethBalanceBefore).eq(executionPrice)).to.be.true;
    // real contribution stored on contract
    const realContribution = await clowderMain.realContributions(buyOrder.signer, buyOrder.executionId);
    expect(realContribution.eq(buyerContribution)).to.be.true;

    // testing executionId rejection
    await expect(clowderMain.connect(testERC721Holder).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      testERC721TokenId
    )).to.be.revertedWith("Execute: Id already executed");


    // testing sell order expired rejection
    const buyOrderExpired: BuyOrderV1Basic = {
      ...buyOrder,
      sellPriceEndTime: getUnixTimestamp().sub(ONE_DAY_IN_SECONDS),
    };
    const buyOrderExpiredSigned = await ClowderSignature.signBuyOrder(
      buyOrderExpired,
      eip712Domain,
      thirdParty
    );
    await expect(clowderMain.connect(wethHolder).executeOnPassiveSellOrders(
      [buyOrderExpiredSigned],
      buyOrder.sellPrice.mul(2),
    )).to.be.revertedWith('Order expired');

    // testing sell order multiple votes from 
    // same owner rejection
    await expect(clowderMain.connect(wethHolder).executeOnPassiveSellOrders(
      [buyOrderSigned, buyOrderSigned],
      buyOrder.sellPrice.mul(2),
    )).to.be.revertedWith("Signer already voted");

    // testing sell order price rejection
    await expect(clowderMain.connect(wethHolder).executeOnPassiveSellOrders(
      [buyOrderSigned],
      BigNumber.from(0),
    )).to.be.revertedWith("Order can't accept price");

    // testing order collection rejection
    const buyOrderOtherCollection: BuyOrderV1Basic = {
      ...buyOrder,
      collection: "0x0000000000000000000000000000000000000001",
    };
    const buyOrderOtherCollectionSigned = await ClowderSignature.signBuyOrder(
      buyOrderOtherCollection,
      eip712Domain,
      thirdParty
    );
    await expect(clowderMain.connect(wethHolder).executeOnPassiveSellOrders(
      [buyOrderOtherCollectionSigned],
      buyOrder.sellPrice.mul(2),
    )).to.be.revertedWith("Order collection mismatch");

    // Must be able to sell
    const protocolSellingFeeFraction = BigNumber.from(10); // out of 10_000
    await clowderMain.connect(owner).changeProtocolFeeFractionFromSelling(protocolSellingFeeFraction);
    const acceptedSellPrice = buyOrder.sellPrice;
    const sellExecutionPrice = acceptedSellPrice.mul(10_000).div(BigNumber.from(10_000)
      .sub(protocolSellingFeeFraction)).add(1); // we add 1 for rounding error
    const sellProtocolFee = sellExecutionPrice.mul(protocolSellingFeeFraction).div(10_000);
    const actualSellPrice = sellExecutionPrice.sub(sellProtocolFee);
    const protocolFeeRecieverBalanceBefore = await wethTokenContract.balanceOf(feeReceiver.address);
    // testing calculations:
    expect(actualSellPrice.gte(acceptedSellPrice)).to.be.true;
    expect(actualSellPrice.sub(acceptedSellPrice).lt(10)).to.be.true; // less than 10wei difference
    // executing the sell
    await clowderMain.connect(wethHolder).executeOnPassiveSellOrders([buyOrderSigned], sellExecutionPrice);
    // making sure the new NFT owner is the wethHolder
    expect(await testERC721.ownerOf(testERC721TokenId)).to.eq(wethHolder.address);
    // the original buyer claims the WETH
    await clowderMain.connect(thirdParty).claimProceeds([buyOrderSigned.executionId], thirdParty.address);
    // making sure the original buyer receives the correct amount of proceeds (WETH)
    const buyerWethBalanceAfterSelling = await wethTokenContract.balanceOf(buyOrder.signer);
    const groupBuyerProceeds = buyerWethBalanceAfterSelling.sub(buyerWethBalanceAfter);
    const groupBuyerProceedsExpected = realContribution.mul(actualSellPrice).div(price);
    expect(groupBuyerProceeds.eq(groupBuyerProceedsExpected)).to.be.true;
    // making sure the fee receiver receives the correct amount WETH
    const protocolFeeRecieverBalanceAfter = await wethTokenContract.balanceOf(feeReceiver.address);
    expect(protocolFeeRecieverBalanceAfter.sub(protocolFeeRecieverBalanceBefore).eq(
      sellExecutionPrice.mul(protocolSellingFeeFraction).div(10_000))).to.be.true;

    // testing rejection when reusing the executionId
    await expect(clowderMain.connect(wethHolder).executeOnPassiveSellOrders(
      [buyOrderSigned], sellExecutionPrice
    )).to.be.revertedWith("Execution already sold");
  });

  it("Must allow sole owner to claim the NFT", async () => {
    const { clowderMain, nonOwner,
      testERC721, testERC721Holder, testERC721TokenId, thirdParty } = deployOutputs;

    await clowderMain.connect(testERC721Holder).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      testERC721TokenId
    );

    await clowderMain.connect(thirdParty).claimNft(buyOrder.executionId, nonOwner.address);
    expect(await testERC721.ownerOf(testERC721TokenId)).to.eq(nonOwner.address);

    // testing executionId rejection
    await expect(clowderMain.connect(testERC721Holder).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      testERC721TokenId
    )).to.be.revertedWith("Execute: Id already executed");
    await expect(clowderMain.connect(thirdParty).claimNft(buyOrder.executionId, nonOwner.address)
    ).to.be.revertedWith("ClaimNft: Execution already sold");

  });

  it("Must allow multiple buyers to claim the NFT", async () => {
    for (let n_buyers = 1; n_buyers <= 10; n_buyers++) {
      const { clowderMain, feeFraction,
        testERC721, testERC721Holder, testERC721TokenId, wethTokenContract,
        wethHolder, eip712Domain, owner } = await deployForTests();

      // approve the clowder contract to move nft holder's nfts
      await testERC721.connect(testERC721Holder).setApprovalForAll(
        clowderMain.address,
        true,
      );

      const signers = (await ethers.getSigners()).slice(0, n_buyers);
      const orderBuyPrice = ETHER.mul(10);
      const contribution = orderBuyPrice.div(n_buyers).add(1); // +1 wei for rounding error
      const buyNonce = BigNumber.from(0);
      const orders = await Promise.all(signers.map(async (signer) => {
        // getting the WETH
        await wethTokenContract.connect(signer).deposit({
          value: contribution
        });

        // approve the clowder contract to spend thirdParty's WETH
        await wethTokenContract.connect(signer).approve(
          clowderMain.address,
          MAX_UINT256
        );
        const order = {
          signer: signer.address,
          collection: testERC721.address,
          executionId,
          contribution,

          buyPrice: orderBuyPrice,
          buyNonce,
          buyPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),

          sellPrice: orderBuyPrice.div(2), // just for these tests
          sellPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),
          sellNonce: BigNumber.from(0),
        };
        const orderSigned = await ClowderSignature.signBuyOrder(order,
          eip712Domain,
          signer,
        );
        return orderSigned;
      }));

      const buyExecutionPrice = orderBuyPrice.mul(10_000).div(feeFraction.add(10_000)).add(1);
      const actualPricePaidByBuyers = buyExecutionPrice.mul(feeFraction.add(10_000)).div(10_000);

      const txn = await clowderMain.connect(testERC721Holder).executeOnPassiveBuyOrders(
        orders,
        buyExecutionPrice,
        testERC721TokenId
      );
      const receipt = await txn.wait();
      // print gas used
      console.log(`Gas used for ${n_buyers} buyers buy execution: ${receipt.gasUsed.toString()}`);

      // getting the real contributions of each buyer
      const buyersRealContributions = await Promise.all(signers.map(async (signer) => {
        return await clowderMain.realContributions(signer.address, orders[0].executionId);
      }));

      // asserting fees and consensus
      const protocolSellingFeeFraction = BigNumber.from(0);
      await clowderMain.connect(owner).changeProtocolFeeFractionFromSelling(protocolSellingFeeFraction);
      const minConsensusForSellingOverBuyPrice = BigNumber.from(5_000);
      await clowderMain.connect(owner).changeminConsensusForSellingOverBuyPrice(minConsensusForSellingOverBuyPrice);

      // approve the clowder contract to spend wethHolder's WETH
      await wethTokenContract.connect(wethHolder).approve(
        clowderMain.address,
        MAX_UINT256
      );

      let votes = BigNumber.from(0);
      let slice_of_seller_votes = 0;
      while (votes.mul(10_000).lt(actualPricePaidByBuyers.mul(minConsensusForSellingOverBuyPrice))) {
        votes = votes.add(buyersRealContributions[slice_of_seller_votes]);
        slice_of_seller_votes++;
      }

      // testing rejection when not achieving consensus
      const revertMessage = slice_of_seller_votes - 1 <= 0 ?
        "ExecuteSell: Must have at least one order" :
        "Selling over or equal buyPrice: consensus not reached";
      await expect(clowderMain.connect(wethHolder).executeOnPassiveSellOrders(
        orders.slice(0, slice_of_seller_votes - 1), // not enough votes
        actualPricePaidByBuyers.add(1), // price greater then the buy price
      )).to.be.revertedWith(revertMessage);

      const sellTxn = await clowderMain.connect(wethHolder).executeOnPassiveSellOrders(
        orders.slice(0, slice_of_seller_votes),
        actualPricePaidByBuyers.add(1), // price greater then the buy price
      );
      const sellReceipt = await sellTxn.wait();
      // print gas used
      console.log(`Gas used for ${n_buyers} buyers with ${slice_of_seller_votes} voters sell execution: ${sellReceipt.gasUsed.toString()}`);
    }
  }).timeout(2 * 60 * 1000);
})