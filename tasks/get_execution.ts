import { BigNumber } from "ethers";
import { task } from "hardhat/config";
import { ClowderMain__factory } from "../typechain-types";


task("get_execution", "Gets execution information.")
.addParam("execution", "The execution id")
.setAction(async (taskArgs, hre) => {
  const { ethers, deployments } = hre;
  const clowderDeployment = await deployments.get("ClowderMain");
  const clowderMain = ClowderMain__factory.connect(clowderDeployment.address, ethers.provider);
  const e = await clowderMain.executions(BigNumber.from(taskArgs.execution));

  console.log(e);
  console.log(JSON.stringify(e));

});