import { ethers } from "hardhat";

async function main() {
 const AvengersNFT = await ethers.getContractFactory("AvengersNFT");
 const avengersNFT = await AvengersNFT.deploy();
 await avengersNFT.deployed();

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});