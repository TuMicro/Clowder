import { TypedDataDomain } from "@ethersproject/abstract-signer";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, Contract } from "ethers";
import { hexStripZeros } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { ClowderMain, TestERC721, Weth9, Weth9__factory } from "../../typechain-types";
import { WETH9_ABI } from "../constants/erc20abi";
import { ETHER } from "../constants/ether";
import { RESERVOIR_ORACLE_VERIFIER_ADDRESS, SPLITMAIN_ADDRESS, WETH_ADDRESS } from "./addresses";
import { ClowderSignature } from "./clowdersignature";
import { deployDelegateFactory, deployDelegateLibraries } from "./deploydelegate";
import { setEtherBalance } from "../hardhat-util";

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

  wethTokenContract: Weth9;
  wethHolder: SignerWithAddress,

  delegateEOA: SignerWithAddress,

  delegateFactory: string,
}

export async function deployForTests(customWethAddress: string | null = null): Promise<DeployOutputs> {
  const [owner, nonOwner, thirdParty, feeReceiver, testERC721Owner,
    testERC721Holder, wethHolder, delegateEOA] = await ethers.getSigners();

  const network = await ethers.provider.getNetwork();

  // const buyOrderV1FunctionsFactory = await ethers.getContractFactory('BuyOrderV1Functions');
  // const buyOrderV1FunctionsLibrary = await buyOrderV1FunctionsFactory.deploy()
  // await buyOrderV1FunctionsLibrary.deployed();

  // const OpenSeaUtilFactory = await ethers.getContractFactory('OpenSeaUtil');
  // const OpenSeaUtilLibrary = await OpenSeaUtilFactory.deploy()
  // await OpenSeaUtilLibrary.deployed();

  // const LooksRareUtilFactory = await ethers.getContractFactory('LooksRareUtil');
  // const LooksRareUtilLibrary = await LooksRareUtilFactory.deploy()
  // await LooksRareUtilLibrary.deployed();

  const delegateFactory = await deployDelegateFactory(
    RESERVOIR_ORACLE_VERIFIER_ADDRESS[network.chainId],
    SPLITMAIN_ADDRESS[network.chainId],
  );

  const clowderMainFactory = await ethers.getContractFactory('ClowderMain', {
    libraries: {
      // 'BuyOrderV1Functions': buyOrderV1FunctionsLibrary.address,
      // 'OpenSeaUtil': OpenSeaUtilLibrary.address,
      // 'LooksRareUtil': LooksRareUtilLibrary.address,
    }
  });


  const wethAddress = customWethAddress ?? WETH_ADDRESS[network.chainId];
  const clowderConstructorParams = [
    wethAddress,
    feeReceiver.address,
  ];
  const clowderMain = await clowderMainFactory.connect(owner).deploy(
    clowderConstructorParams[0].toString(),
    clowderConstructorParams[1].toString(),
    delegateFactory.address,
  );
  // Couldn't find a way to link libraries this way:
  // const clowderMainArtifact: Artifact = await artifacts.readArtifact("ClowderMain");
  // const clowderMain = <ClowderMain>await waffle.deployContract(owner,
  //   clowderMainArtifact, clowderConstructorParams);


  // setting the fee fraction
  await clowderMain.connect(owner).changeProtocolFeeFraction(DEFAULT_FEE_FRACTION);

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
  const wethTokenContract = Weth9__factory.connect(wethAddress, ethers.provider);
  await setEtherBalance(wethHolder.address, ETHER.mul(10_000));  // because eth balance is spent on tests
  await wethTokenContract.connect(wethHolder).deposit({ // adding more WETH
    value: ETHER.mul(5_000),
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

    delegateEOA,
    delegateFactory: delegateFactory.address,
  }
}
