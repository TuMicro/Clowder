import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";
import { artifacts, ethers, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import { ClowderMain } from "../../typechain-types";

export const WETH_ADDRESS_FOR_TESTING = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const DEFAULT_FEE_FRACTION = BigNumber.from(1); // out of 10k

export interface DeployOutputs {
  owner: SignerWithAddress;
  nonOwner: SignerWithAddress;
  thirdParty: SignerWithAddress;
  feeReceiver: SignerWithAddress;
  feeFraction: BigNumber;
  clowderMain: ClowderMain;
}

export async function deployForTests(): Promise<DeployOutputs> {
  const [owner, nonOwner, thirdParty, feeReceiver] = await ethers.getSigners();
  const clowderMainArtifact: Artifact = await artifacts.readArtifact("ClowderMain");
  const clowderMain = <ClowderMain>await waffle.deployContract(owner, 
    clowderMainArtifact, [
      WETH_ADDRESS_FOR_TESTING,
      feeReceiver.address,
      DEFAULT_FEE_FRACTION,
    ]);
  return {
    owner,
    nonOwner,
    thirdParty,
    feeReceiver,
    feeFraction: DEFAULT_FEE_FRACTION,
    clowderMain,
  }
}
