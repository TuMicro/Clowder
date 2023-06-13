import { BigNumberish } from "ethers";
import { ethers } from "hardhat";

export async function deployDelegate(
  clowderMainAddress: string,
  executionId: BigNumberish,
  reservoirOracleAddress: string,
) {
  const [owner] = await ethers.getSigners();

  // deploy the SeaportUtil library
  const seaportUtilFactory = await ethers.getContractFactory('SeaportUtil');
  const seaportUtil = await seaportUtilFactory.deploy()
  await seaportUtil.deployed();

  // deploy the SellOrderV1Functions library
  const sellOrderV1FunctionsFactory = await ethers.getContractFactory('SellOrderV1Functions');
  const sellOrderV1FunctionsLibrary = await sellOrderV1FunctionsFactory.deploy()
  await sellOrderV1FunctionsLibrary.deployed();

  // deploy the delegate
  const delegateFactory = await ethers.getContractFactory('TraderClowderDelegateV1', {
    libraries: {
      'SeaportUtil': seaportUtil.address,
      'SellOrderV1Functions': sellOrderV1FunctionsLibrary.address,
    },
  });
  const delegate = await delegateFactory.connect(owner).deploy(
    clowderMainAddress,
    executionId,
    reservoirOracleAddress,
  );
  await delegate.deployed();

  return delegate;
}