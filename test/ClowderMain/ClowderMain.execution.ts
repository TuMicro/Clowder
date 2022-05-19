import { expect } from "chai";
import { BigNumber } from "ethers";
import { deployForTests, DeployOutputs } from "./deploy";
import { ClowderSignature } from "./clowdersignature";
import { ETHER, MAX_UINT256 } from "../constants/ether";
import { getUnixTimestamp, ONE_DAY_IN_SECONDS } from "../constants/time";
import { BuyOrderV1, BuyOrderV1Basic } from "./model";
import { formatEther } from "ethers/lib/utils";

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
    await clowderMain.connect(thirdParty).cancelBuyOrders(buyOrders.map(o => o.buyNonce));

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

    // testing sell order nonce used rejection
    await expect(clowderMain.connect(wethHolder).executeOnPassiveSellOrders(
      [buyOrderSigned, buyOrderSigned],
      buyOrder.sellPrice.mul(2),
    )).to.be.revertedWith("Order nonce is unusable");

    // testing sell order price rejection
    await expect(clowderMain.connect(wethHolder).executeOnPassiveSellOrders(
      [buyOrderSigned],
      BigNumber.from(0),
    )).to.be.revertedWith("Selling under buyPrice: consensus not reached");

    // Must be able to sell
    const protocolSellingFeeFraction = BigNumber.from(10); // out of 10_000
    await clowderMain.connect(owner).changeProtocolFeeFractionFromSelling(protocolSellingFeeFraction);
    const acceptedSellPrice = buyOrder.sellPrice;
    const sellExecutionPrice = acceptedSellPrice.mul(10_000).div(BigNumber.from(10_000)
      .sub(protocolSellingFeeFraction)).add(1); // we add 1 for rounding error
    const sellProtocolFee = sellExecutionPrice.mul(protocolSellingFeeFraction).div(10_000);
    const actualSellPrice = sellExecutionPrice.sub(sellProtocolFee);
    // testing calculations:
    expect(actualSellPrice.gte(acceptedSellPrice)).to.be.true;
    expect(actualSellPrice.sub(acceptedSellPrice).lt(10)).to.be.true; // less than 10wei difference
    // executing the sell
    await clowderMain.connect(wethHolder).executeOnPassiveSellOrders([buyOrderSigned], sellExecutionPrice);
    // making sure the new NFT owner is the wethHolder
    expect(await testERC721.ownerOf(testERC721TokenId)).to.eq(wethHolder.address);
    // making sure the original buyer receives the correct amount of proceeds (WETH)
    const buyerWethBalanceAfterSelling = await wethTokenContract.balanceOf(buyOrder.signer);
    const groupBuyerProceeds = buyerWethBalanceAfterSelling.sub(buyerWethBalanceAfter);
    const groupBuyerProceedsExpected = realContribution.mul(actualSellPrice).div(price);
    expect(groupBuyerProceeds.eq(groupBuyerProceedsExpected)).to.be.true;

    // testing rejection when reusing the executionId
    await expect(clowderMain.connect(wethHolder).executeOnPassiveSellOrders(
      [buyOrderSigned], sellExecutionPrice
    )).to.be.revertedWith("ExecuteSell: Execution already sold");
  });

  it("Must allow sole owner to claim the NFT", async () => {
    const { clowderMain, feeReceiver, owner, nonOwner,
      testERC721, testERC721Holder, testERC721TokenId, wethTokenContract,
      wethHolder, eip712Domain, thirdParty } = deployOutputs;

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
})