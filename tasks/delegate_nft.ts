import { BigNumber, Wallet } from "ethers";
import { task } from "hardhat/config";
import { ClowderMain__factory } from "../typechain-types";


task("delegate_nft", "Delegates (transfers) an NFT.")
  .addParam("execution", "The execution id")
  .addParam("destination", "The destination address")
  .setAction(async (taskArgs, hre) => {
    const { ethers, deployments, getNamedAccounts } = hre;
    const clowderDeployment = await deployments.get("ClowderMain");
    const clowderMain = ClowderMain__factory.connect(clowderDeployment.address, ethers.provider);
    const executionId = BigNumber.from(taskArgs.execution);
    const e = await clowderMain.executions(executionId);

    const tokenId = e.tokenId;

    // const { deployer: owner } = await getNamedAccounts(); // didn't work, threw void signer error
    const owner = new Wallet(process.env.PK_RINKEBY_DEPLOYER ?? "", ethers.provider);
    await (await clowderMain.connect(owner).transferNft(taskArgs.destination, e.collection, tokenId)).wait();

    // close the execution (mark as sold, so the signers stop having management power
    // over the NFT in case it comes back to the contract)
    await (await clowderMain.connect(owner).claimProtocolFees([
      executionId
    ])).wait();

    const e2 = await clowderMain.executions(executionId);
    console.log("new sold state: ", e2.sold);
  });