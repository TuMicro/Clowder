import { expect } from "chai";
import { BigNumber } from "ethers";
import { deployForTests, DeployOutputs } from "./deploy";
import { ClowderSignature } from "./clowdersignature";
import { ETHER, MAX_UINT256 } from "../constants/ether";
import { getUnixTimestamp, ONE_DAY_IN_SECONDS } from "../constants/time";
import { BuyOrderV1, BuyOrderV1Basic } from "./model";

describe("Execution function", () => {
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
      testERC721, testERC721Holder, wethTokenContract } = deployOutputs;

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
      sellPriceEndTime: getUnixTimestamp().sub(ONE_DAY_IN_SECONDS),
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
  });

  it("Must respect the order buyPrice", async () => {
    const { clowderMain, thirdParty, eip712Domain, nonOwner, feeFraction,
      testERC721, testERC721Holder, testERC721TokenId, wethTokenContract } = deployOutputs;

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

  it("Must transfer the required amounts and NFT", async () => {
    const { clowderMain, feeReceiver,
      testERC721, testERC721Holder, testERC721TokenId, wethTokenContract } = deployOutputs;

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
    expect(buyerWethBalanceBefore.sub(buyerWethBalanceAfter).eq(price)).to.be.true;
    // seller WETH transfer
    expect(sellerWethBalanceAfter.sub(sellerWethBalanceBefore).eq(executionPrice)).to.be.true;
  });
})