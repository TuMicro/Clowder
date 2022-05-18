import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { artifacts, ethers, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import { ClowderMain } from "../../typechain-types";
import { deployForTests, DeployOutputs, WETH_ADDRESS_FOR_TESTING } from "./deploy";
import { ClowderSignature } from "./clowdersignature";
import { ETHER, MAX_UINT256 } from "../constants/ether";
import { getUnixTimestamp, ONE_DAY_IN_SECONDS } from "../constants/time";
import { DOODLES_ADDRESS } from "./addresses";
import { WETH9_ABI } from "../constants/erc20abi";

describe("Execution function", () => {
  let deployOutputs: DeployOutputs;
  beforeEach(async () => {
    deployOutputs = await deployForTests();
  });

  it("Must respect the order buyPrice", async () => {
    const { clowderMain, thirdParty, eip712Domain, nonOwner, feeFraction } = deployOutputs;

    const initialNonceState = await clowderMain.isUsedBuyNonce(thirdParty.address, 0);
    expect(initialNonceState).to.equal(false);

    const executionPrice = ETHER.mul(10);
    const protocolFee = executionPrice.mul(feeFraction).div(10_000);
    const price = executionPrice.add(protocolFee);


    const contribution = price;
    // getting the WETH
    const wethTokenContract = new Contract(WETH_ADDRESS_FOR_TESTING, WETH9_ABI);
    await wethTokenContract.connect(thirdParty).deposit({
      value: contribution
    });

    const buyPrice = ETHER.mul(40);
    const executionId = BigNumber.from(0);
    const buyOrderSigned = await ClowderSignature.signBuyOrder({
      signer: thirdParty.address,
      collection: DOODLES_ADDRESS,
      executionId,
      contribution,
      buyPrice,
      buyNonce: BigNumber.from(0),
      buyPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),

      sellPrice: ETHER.mul(30),
      sellPriceEndTime: getUnixTimestamp().sub(ONE_DAY_IN_SECONDS),
      sellNonce: BigNumber.from(0),
    },
      eip712Domain,
      thirdParty
    );


    // approve the clowder contract to spend the WETH
    await wethTokenContract.connect(thirdParty).approve(
      clowderMain.address,
      MAX_UINT256);

    // testing price rejection
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

    await expect(clowderMain.connect(nonOwner).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      1)).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");

    // TODO: test the NFT transfer
  });

  it("Must transfer the required amounts and NFT", async () => {
    throw new Error("Not implemented");
  });
})