import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { WETH_ADDRESS } from '../test/ClowderMain/addresses';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment,) {
  const { deployments, getNamedAccounts, getChainId } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  const buyOrderV1FunctionsLibrary = await deploy("BuyOrderV1Functions", {
    from: deployer,
  });
  // const OpenSeaUtilLibrary = await deploy("OpenSeaUtil", {
  //   from: deployer,
  // });
  // const LooksRareUtilLibrary = await deploy("LooksRareUtil", {
  //   from: deployer,
  // });

  const clowderMain = await deploy("ClowderMain", {
    from: deployer,
    args: [WETH_ADDRESS[Number(chainId)], deployer],
    libraries: {
      "BuyOrderV1Functions": buyOrderV1FunctionsLibrary.address,
      // "OpenSeaUtil": OpenSeaUtilLibrary.address,
      // 'LooksRareUtil': LooksRareUtilLibrary.address,
    }
  });

  console.log("Deployed ClowderMain at " + clowderMain.address + " 🎉");

};
export default func;