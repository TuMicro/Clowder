import { expect } from "chai";
import { prepareForSingleBuySellTest } from "./ClowderMain.execution";
import { deployForTests, DeployOutputs } from "./deploy";

describe.only("Owner functions", () => {
  let deployOutputs: DeployOutputs;
  before(async () => {
    deployOutputs = await deployForTests();
  });

  it("allow only the owner to change the protocol fee receiver", async () => {
    // unwrap the required deploy outputs
    const { owner, nonOwner, clowderMain, thirdParty } = deployOutputs;

    await clowderMain.connect(owner).changeProtocolFeeReceiver(owner.address);
    expect(await clowderMain.protocolFeeReceiver()).to.equal(owner.address);
    await clowderMain.connect(owner).changeProtocolFeeReceiver(thirdParty.address);
    expect(await clowderMain.protocolFeeReceiver()).to.equal(thirdParty.address);
    await expect(clowderMain.connect(nonOwner).changeProtocolFeeReceiver(nonOwner.address))
      .to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("allow only the owner to transfer NFTs from groups", async () => {
    // unwrap the required deploy outputs
    const { clowderMain, nonOwner, owner,
      testERC721, testERC721Holder, testERC721TokenId, thirdParty } = deployOutputs;

    const res = await prepareForSingleBuySellTest(deployOutputs);
    const buyOrderSigned = res.buyOrderSigned;
    const executionPrice = res.executionPrice;

    await clowderMain.connect(testERC721Holder).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      testERC721TokenId
    );

    // reject if not owner
    await expect(clowderMain.connect(nonOwner).transferNft(thirdParty.address,
      testERC721.address, testERC721TokenId))
      .to.be.revertedWith("Ownable: caller is not the owner");

    // owner can transfer
    await clowderMain.connect(owner).transferNft(thirdParty.address,
      testERC721.address, testERC721TokenId);

    // check that the NFT was transferred, that is, thirdParty can transfer it
    await testERC721.connect(thirdParty).transferFrom(thirdParty.address,
      testERC721Holder.address, testERC721TokenId);

    // check that the new owner is testERC721Holder
    expect(await testERC721.ownerOf(testERC721TokenId)).to.equal(testERC721Holder.address);
  });

})