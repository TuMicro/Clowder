import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ClowderMain__factory } from '../typechain-types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment,) {
  const { deployments, getNamedAccounts, getChainId, ethers } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const accounts = await ethers.getSigners()
  const chainId = await getChainId();
  const chainId_n = Number(chainId);

  const clowderMain = await get('ClowderMain');

  const clowder = ClowderMain__factory.connect(clowderMain.address, hre.ethers.provider);

  // get the deployer account
  const deployerAccount = accounts.filter((account) => account.address === deployer)[0];

  const tx = await clowder.connect(deployerAccount).changeProtocolFeeFraction(0);

  console.log("tx hash: ", tx.hash);

  await tx.wait();

  console.log("✔️ New protocol fee fraction: ", (await clowder.protocolFeeFraction()).toString(), " out of 10,000");

};
export default func;