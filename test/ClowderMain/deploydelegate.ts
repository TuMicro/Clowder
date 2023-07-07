import { BigNumberish } from "ethers";
import { ethers } from "hardhat";

export async function deployDelegateLibraries() {
  // deploy the SeaportUtil library
  const seaportUtilFactory = await ethers.getContractFactory('SeaportUtil');
  const seaportUtil = await seaportUtilFactory.deploy()
  await seaportUtil.deployed();

  // deploy the SellOrderV1Functions library
  const sellOrderV1FunctionsFactory = await ethers.getContractFactory('SellOrderV1Functions');
  const sellOrderV1FunctionsLibrary = await sellOrderV1FunctionsFactory.deploy()
  await sellOrderV1FunctionsLibrary.deployed();

  // deploy the TransferOrderV1Functions library
  const transferOrderV1FunctionsFactory = await ethers.getContractFactory('TransferOrderV1Functions');
  const transferOrderV1FunctionsLibrary = await transferOrderV1FunctionsFactory.deploy()
  await transferOrderV1FunctionsLibrary.deployed();

  return {
    seaportUtil,
    sellOrderV1FunctionsLibrary,
    transferOrderV1FunctionsLibrary,
  }
}

export async function deployDelegateFactory(
  clowderMainAddress: string,
  reservoirOracleAddress: string,
  splitMainAddress: string,
) {
  const [owner] = await ethers.getSigners();

  const l = await deployDelegateLibraries();

  // deploy the delegate implementation
  const delegateFactory = await ethers.getContractFactory('TraderClowderDelegateV1', {
    libraries: {
      'SeaportUtil': l.seaportUtil.address,
      'SellOrderV1Functions': l.sellOrderV1FunctionsLibrary.address,
      'TransferOrderV1Functions': l.transferOrderV1FunctionsLibrary.address,
    },
  });

  const delegate = await delegateFactory.connect(owner).deploy(
    clowderMainAddress,
    reservoirOracleAddress,
    splitMainAddress,
  );
  await delegate.deployed();

  // deploy the delegate factory
  const delegateFactoryFactory = await ethers.getContractFactory('TraderClowderDelegateV1Factory');
  const delegateFactoryContract = await delegateFactoryFactory.connect(owner).deploy(
    delegate.address,
  );
  await delegateFactoryContract.deployed();

  return delegateFactoryContract;
}