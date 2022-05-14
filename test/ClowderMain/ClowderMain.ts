import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { artifacts, ethers, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import { ClowderMain } from "../../typechain-types";

describe("ClowderMain tests", function () {
  let owner: SignerWithAddress;
  let nonOwner: SignerWithAddress;
  let clowderMain: ClowderMain;

  before(async function () {
    console.log("this runs once before everything");
  });

  beforeEach(async function () {
    console.log("beforeEach on ClowderMain tests");
    [owner, nonOwner] = await ethers.getSigners();
    const clowderMainArtifact: Artifact = await artifacts.readArtifact("ClowderMain");
    clowderMain = <ClowderMain>await waffle.deployContract(owner, clowderMainArtifact, []);
  });


  it("test on top level", async function () {
    expect(await clowderMain.connect(owner).nPurrs()).to.equal(BigNumber.from(0));
    console.log("first test in ownership tests passed!!!");
  });

  describe("Ownership tests", function () {
    before(async function () {
      console.log("setting up ownership tests....");
    });
    beforeEach(async function () {
      console.log("beforeEach on Ownership tests");
    });


    it("first test in ownership tests", async function () {
      await clowderMain.connect(owner).pet();
      console.log("second test in ownership tests passed!!!");
    });

    
    it("second test in ownership tests", async function () {
      await expect(clowderMain.connect(nonOwner).pet())
        .to.be.revertedWith("Ownable: caller is not the owner");
      console.log("second test in ownership tests passed!!!");
    });
  })
});
