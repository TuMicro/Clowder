import { network, ethers } from "hardhat";

export async function impersonateAccount(address: string) {
  // [hardhat required] impersonating
  await network.provider.request({ // network from hardhat
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  return await ethers.getSigner(address);
}