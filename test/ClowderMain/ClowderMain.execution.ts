import { expect } from "chai";
import { BigNumber } from "ethers";
import { deployForTests, DeployOutputs } from "./deploy";
import { ClowderSignature } from "./clowdersignature";
import { ETHER, MAX_UINT256 } from "../constants/ether";
import { getUnixTimestamp, ONE_DAY_IN_SECONDS } from "../constants/time";
import { BuyOrderV1, BuyOrderV1Basic } from "./model";
import { ethers } from "hardhat";

export async function prepareForSingleBuySellTest(deployOutputs: DeployOutputs) {
  const { clowderMain, thirdParty, eip712Domain, feeFraction,
    testERC721, testERC721Holder, wethTokenContract, wethHolder,
    delegate } = deployOutputs;

  const executionId = BigNumber.from(0);
  const executionPrice = ETHER.mul(10);
  const protocolFee = executionPrice.mul(feeFraction).div(10_000);
  const price = executionPrice.add(protocolFee);


  const contribution = price;

  // getting the WETH
  await wethTokenContract.connect(thirdParty).deposit({
    value: contribution
  });

  const buyPrice = ETHER.mul(40);
  const buyOrder = {
    signer: thirdParty.address,
    collection: testERC721.address,
    executionId,
    contribution,

    buyPrice,
    buyNonce: BigNumber.from(0),
    buyPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),

    delegate: delegate.address,
  };
  const buyOrderSigned = await ClowderSignature.signBuyOrder(buyOrder,
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

  return {
    buyOrder,
    buyOrderSigned,
    executionPrice,
    protocolFee,
    price,
    executionId,
  }
}

describe.only("Execution functions", () => {
  let deployOutputs: DeployOutputs;

  let buyOrder: BuyOrderV1Basic;
  let buyOrderSigned: BuyOrderV1;

  // execution parameters that should be accepted
  let executionPrice: BigNumber;
  let protocolFee: BigNumber;
  let price: BigNumber;
  let executionId: BigNumber;

  beforeEach(async () => {
    deployOutputs = await deployForTests();

    const res = await prepareForSingleBuySellTest(deployOutputs);
    buyOrder = res.buyOrder;
    buyOrderSigned = res.buyOrderSigned;
    executionPrice = res.executionPrice;
    protocolFee = res.protocolFee;
    price = res.price;
    executionId = res.executionId;

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

  it("Must execute a buy order transferring the NFT and required amounts. Then NFT must belong to the delegate.", async () => {
    const { clowderMain, feeReceiver, owner,
      testERC721, testERC721Holder, testERC721TokenId, wethTokenContract,
      wethHolder, eip712Domain, thirdParty, delegate } = deployOutputs;

    const buyerWethBalanceBefore = await wethTokenContract.balanceOf(buyOrder.signer);
    const sellerWethBalanceBefore = await wethTokenContract.balanceOf(testERC721Holder.address);
    const feeReceiverBalanceBefore = await wethTokenContract.balanceOf(feeReceiver.address);
    await clowderMain.connect(testERC721Holder).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      testERC721TokenId
    );
    const buyerWethBalanceAfter = await wethTokenContract.balanceOf(buyOrder.signer);
    const sellerWethBalanceAfter = await wethTokenContract.balanceOf(testERC721Holder.address);
    const feeReceiverBalanceAfter = await wethTokenContract.balanceOf(feeReceiver.address);

    // protocol fees
    expect(feeReceiverBalanceAfter.sub(feeReceiverBalanceBefore).eq(protocolFee)).to.be.true;
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

    // testing delegate owns the NFT
    expect(await testERC721.ownerOf(testERC721TokenId)).to.eq(delegate.address);

    // testing delegate can transfer the NFT
    await testERC721.connect(delegate).transferFrom(delegate.address, owner.address, testERC721TokenId);

    // testing now the owner owns the NFT
    expect(await testERC721.ownerOf(testERC721TokenId)).to.eq(owner.address);
  });

  it("Must allow groups of people to buy one NFT and then the delegate owns the NFT", async () => {
    for (let n_buyers = 1; n_buyers <= 10; n_buyers++) {
      const { clowderMain, feeFraction,
        testERC721, testERC721Holder, testERC721TokenId, wethTokenContract,
        wethHolder, eip712Domain, owner, delegate } = await deployForTests();

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

          delegate: delegate.address,
        };
        const orderSigned = await ClowderSignature.signBuyOrder(order,
          eip712Domain,
          signer,
        );
        return orderSigned;
      }));

      // when reviewing this code I don't understand why I added 1 here on the first place
      const buyExecutionPrice = orderBuyPrice.mul(10_000).div(feeFraction.add(10_000)).add(1);

      const txn = await clowderMain.connect(testERC721Holder).executeOnPassiveBuyOrders(
        orders,
        buyExecutionPrice,
        testERC721TokenId
      );
      const receipt = await txn.wait();
      // print gas used
      console.log(`Gas used for ${n_buyers} buyers buy execution: ${receipt.gasUsed.toString()}`);

      // testing delegate owns the NFT
      expect(await testERC721.ownerOf(testERC721TokenId)).to.eq(delegate.address);

      // testing delegate can transfer the NFT
      await testERC721.connect(delegate).transferFrom(delegate.address, owner.address, testERC721TokenId);
    }
  }).timeout(2 * 60 * 1000);

  // it("Must return snow access key", async () => {
  //   const { clowderMain } = await deployForTests();
  //   const addr = '0x606be0248B77c89Cd44dfEA0EA895EA42e25748D';
  //   const snowAccessKey = await clowderMain.getSnowAccessKey(addr);
  //   console.log("snowAccessKey");
  //   console.log(snowAccessKey);
  // }).timeout(2 * 60 * 1000);

})