import { BigNumber, Wallet } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { task } from "hardhat/config";
import { ClowderMain__factory } from "../typechain-types";


task("change_protocol_fee_fraction", "")
  .addParam("feefraction", "The fee fraction (out of 10000)")
  .setAction(async (taskArgs, hre) => {
    const { ethers, deployments, getNamedAccounts } = hre;
    const clowderDeployment = await deployments.get("ClowderMain");
    const clowderMain = ClowderMain__factory.connect(clowderDeployment.address, ethers.provider);

    // const { deployer: owner } = await getNamedAccounts(); // didn't work, threw void signer error
    const owner = new Wallet(process.env.PK_RINKEBY_DEPLOYER ?? "", ethers.provider);
    const fee = BigNumber.from(taskArgs.feefraction);
    await (await clowderMain.connect(owner).changeProtocolFeeFraction(fee)).wait();

    console.log("✔️ New protocol fee fraction: ", formatEther((await clowderMain.protocolFeeFraction())), " out of 10,000");
  });