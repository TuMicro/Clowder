import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ClowderCalleeExample__factory, ClowderMain__factory } from '../typechain-types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment,) {
  const { ethers, deployments, getNamedAccounts, getChainId } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const accounts = await ethers.getSigners()
  const chainId = await getChainId();
  const chainId_n = Number(chainId);

  const newFeeReceiverAndFlashbuyerOwner = "0x0f576D7d47c4e6053Ff9231Cb0081269700815Bc";

  // get the deployer account
  const deployerAccount = accounts.find((account) => account.address === deployer);
  if (deployerAccount == null) throw Error("deployerAccount not found");

  const clowder = ClowderMain__factory.connect(
    (await deployments.get("ClowderMain")).address,
    ethers.provider);
  const clowderFlashbuyer = ClowderCalleeExample__factory.connect(
    (await deployments.get("ClowderCalleeExample")).address,
    ethers.provider);

  console.log("Setting fee receiver to " + newFeeReceiverAndFlashbuyerOwner + " 🚀");
  await (await clowder.connect(deployerAccount).changeProtocolFeeReceiver(newFeeReceiverAndFlashbuyerOwner)).wait();

  console.log("Setting flashbuyer owner to " + newFeeReceiverAndFlashbuyerOwner + " 🚀");
  await (await clowderFlashbuyer.connect(deployerAccount).transferOwnership(newFeeReceiverAndFlashbuyerOwner)).wait();

};
export default func;