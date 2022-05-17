import { expect } from "chai";
import { deployForTests, DeployOutputs } from "./deploy";

describe("Owner functions", () => {
  let deployOutputs : DeployOutputs;
  before(async () => {
    deployOutputs = await deployForTests();
  });

  it("allow only the owner to change the protocol fee receiver", async () => {
    // unwrap the required deploy outputs
    const { owner, nonOwner, clowderMain, thirdParty } = deployOutputs;
  
    await clowderMain.connect(owner).changeProtocolFeeReceiver(owner.address);
    await clowderMain.connect(owner).changeProtocolFeeReceiver(thirdParty.address);
    expect(await clowderMain.protocolFeeReceiver()).to.equal(thirdParty.address);
    await expect(clowderMain.connect(nonOwner).changeProtocolFeeReceiver(nonOwner.address))
      .to.be.revertedWith("Ownable: caller is not the owner");
  });
})