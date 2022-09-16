import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { WETH_ADDRESS } from '../test/ClowderMain/addresses';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment,) {
  const { deployments, getNamedAccounts, getChainId } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const chainId_n = Number(chainId);

  const buyOrderV1FunctionsLibrary = await deploy("BuyOrderV1Functions", {
    from: deployer,
  });

  let libraries: { [libraryName: string]: string } = {
    "BuyOrderV1Functions": buyOrderV1FunctionsLibrary.address,
  };

  if (chainId_n === 4) { // only on rinkeby
    // TODO: separate the marketplace-listable version of Clowder into another contract
    const OpenSeaUtilLibrary = await deploy("OpenSeaUtil", {
      from: deployer,
    });
    const LooksRareUtilLibrary = await deploy("LooksRareUtil", {
      from: deployer,
    });
    libraries = {
      ...libraries,
      "OpenSeaUtil": OpenSeaUtilLibrary.address,
      'LooksRareUtil': LooksRareUtilLibrary.address,
    }
  }

  const clowderMain = await deploy("ClowderMain", {
    from: deployer,
    args: [WETH_ADDRESS[Number(chainId)], deployer],
    libraries,
  });

  console.log("Deployed ClowderMain at " + clowderMain.address + " 🎉");

};
export default func;