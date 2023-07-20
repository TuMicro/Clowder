import { task } from "hardhat/config";

task("get_gas_price", "Gets the gas price from the network")
  .setAction(async (taskArgs, hre) => {
    const { ethers, deployments, getNamedAccounts, getChainId } = hre;
    const gasPrice = await ethers.provider.getGasPrice();
    const chainId = Number(await getChainId());

    const regularGasPricing = [
      1,
      137,
    ];

    if (regularGasPricing.includes(chainId)) {
      console.log("gas price: ", gasPrice.toString());
    } else {
      
      // https://github.com/ethereum-optimism/optimism-tutorial/tree/main/sdk-estimate-gas

      const opBasedL2 = [];
      // TODO: l2 gas price
      console.log("not supported");
    }

  });
