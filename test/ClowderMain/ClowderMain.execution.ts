import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { artifacts, ethers, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import { ClowderMain } from "../../typechain-types";
import { deployForTests, DeployOutputs } from "./deploy";

describe("Execution function", () => {
  let deployOutputs : DeployOutputs;
  beforeEach(async () => {
    deployOutputs = await deployForTests();
  });

  it("Must transfer the required amounts and NFT", async () => {
    throw new Error("Not implemented");
  });
})