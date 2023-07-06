import { BigNumber, BigNumberish } from "ethers";
import { network, ethers } from "hardhat";

export async function impersonateAccount(address: string) {
  // [hardhat required] impersonating
  await network.provider.request({ // network from hardhat
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  return await ethers.getSigner(address);
}

export async function setEtherBalance(address: string, bn: BigNumberish) {
  await network.provider.send("hardhat_setBalance", [
    address,
    ethers.utils.hexStripZeros(BigNumber.from(bn).toHexString()),
  ]);
}