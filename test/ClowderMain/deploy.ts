import { TypedDataDomain } from "@ethersproject/abstract-signer";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, Contract } from "ethers";
import { formatEther, hexStripZeros } from "ethers/lib/utils";
import { artifacts, ethers, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import { ClowderMain, TestERC721 } from "../../typechain-types";
import { WETH9_ABI } from "../constants/erc20abi";
import { ETHER } from "../constants/ether";
import { WETH_ADDRESS_FOR_TESTING } from "./addresses";
import { ClowderSignature } from "./clowdersignature";

export const DEFAULT_FEE_FRACTION = BigNumber.from(1); // out of 10k

export interface DeployOutputs {
  owner: SignerWithAddress;
  nonOwner: SignerWithAddress;
  thirdParty: SignerWithAddress;
  feeReceiver: SignerWithAddress;
  feeFraction: BigNumber;
  clowderMain: ClowderMain;

  chainId: number,

  eip712Domain: TypedDataDomain,

  // nft
  testERC721: TestERC721,
  testERC721Owner: SignerWithAddress,
  testERC721Holder: SignerWithAddress,
  testERC721TokenId: BigNumber,

  wethTokenContract: Contract;
  wethHolder: SignerWithAddress,
}

export async function deployForTests(): Promise<DeployOutputs> {
  const [owner, nonOwner, thirdParty, feeReceiver, testERC721Owner,
    testERC721Holder, wethHolder] = await ethers.getSigners();
  const clowderMainArtifact: Artifact = await artifacts.readArtifact("ClowderMain");
  const clowderMain = <ClowderMain>await waffle.deployContract(owner,
    clowderMainArtifact, [
    WETH_ADDRESS_FOR_TESTING,
    feeReceiver.address,
    DEFAULT_FEE_FRACTION,
  ]);

  const network = await ethers.provider.getNetwork();

  // setting up the test NFT contract and NFT holder
  const testERC721Factory = await ethers.getContractFactory("TestERC721");
  const testERC721 = await testERC721Factory.connect(testERC721Owner).deploy("TestERC721",
    "TERC721",
    "",
  );
  await testERC721.deployed();
  // mint an NFT to the holder (with tokenId: 0)
  await testERC721.connect(testERC721Owner).mint(testERC721Holder.address);

  // setting up the WETH contract and WETH holder
  const wethTokenContract = new Contract(WETH_ADDRESS_FOR_TESTING, WETH9_ABI, ethers.provider);
  await ethers.provider.send("hardhat_setBalance", [ // because eth balance is spent on tests
    wethHolder.address,
    hexStripZeros(ETHER.mul(10_000).toHexString()),
  ]);
  await wethTokenContract.connect(wethHolder).deposit({ // adding more WETH
    value: ETHER.mul(1_000),
  });

  return {
    owner,
    nonOwner,
    thirdParty,
    feeReceiver,
    feeFraction: DEFAULT_FEE_FRACTION,
    clowderMain,

    chainId: network.chainId,
    eip712Domain: ClowderSignature.getDomain(network.chainId, clowderMain.address),

    // nft
    testERC721,
    testERC721Owner,
    testERC721Holder,
    testERC721TokenId: BigNumber.from(0),

    wethTokenContract,
    wethHolder,
  }
}
