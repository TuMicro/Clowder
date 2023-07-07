import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { RESERVOIR_ORACLE_VERIFIER_ADDRESS, SPLITMAIN_ADDRESS, WETH_ADDRESS } from '../test/ClowderMain/addresses';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment,) {
  const { deployments, getNamedAccounts, getChainId, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const chainId_n = Number(chainId);

  console.log("Deploying to network " + chainId + " 🚀");

  const seaportUtilLibrary = await deploy("SeaportUtil", {
    from: deployer,
  });
  const sellOrderV1FunctionsLibrary = await deploy("SellOrderV1Functions", {
    from: deployer,
  });
  const transferOrderV1FunctionsLibrary = await deploy("TransferOrderV1Functions", {
    from: deployer,
  });

  let libraries: { [libraryName: string]: string } = {
    "SeaportUtil": seaportUtilLibrary.address,
    'SellOrderV1Functions': sellOrderV1FunctionsLibrary.address,
    'TransferOrderV1Functions': transferOrderV1FunctionsLibrary.address,
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

  const nonce = await ethers.provider.getTransactionCount(deployer);
  const clowderMainAddress = ethers.utils.getContractAddress({
    from: deployer,
    nonce: nonce,
  });

  // deploy the delegate implementation
  const delegate = await deploy("TraderClowderDelegateV1", {
    from: deployer,
    args: [
      clowderMainAddress,
      RESERVOIR_ORACLE_VERIFIER_ADDRESS[Number(chainId)],
      SPLITMAIN_ADDRESS[Number(chainId)],
    ],
    libraries: libraries,
  });
  console.log("Deployed TraderClowderDelegateV1 at " + delegate.address + " 🎉");

  // deploy the delegate factory
  const delegateFactory = await deploy("TraderClowderDelegateV1Factory", {
    from: deployer,
    args: [
      delegate.address,
    ],
  });
  console.log("Deployed TraderClowderDelegateV1Factory at " + delegateFactory.address + " 🎉");

  const protocolFeeReceiverAndFlashbuyerCaller = "0x0f576D7d47c4e6053Ff9231Cb0081269700815Bc";

  const clowderMain = await deploy("ClowderMain", {
    from: deployer,
    args: [
      WETH_ADDRESS[Number(chainId)],
      protocolFeeReceiverAndFlashbuyerCaller,
      delegateFactory.address,
    ],
  });

  console.log("Deployed ClowderMain at " + clowderMain.address + " 🎉");


  console.log("Deploying FlashBuyer to network " + chainId + " ⚡️");

  const clowderFlashbuyer = await deploy("ClowderCalleeExample", {
    from: deployer,
    args: [
      clowderMain.address, 
      WETH_ADDRESS[Number(chainId)],
      protocolFeeReceiverAndFlashbuyerCaller,
    ],
  });

  console.log("Deployed FlashBuyer at " + clowderFlashbuyer.address + " 🎉");

};
export default func;