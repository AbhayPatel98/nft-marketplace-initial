import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { constants as ethersConstants, Contract } from "ethers";
import { ethers } from "hardhat";

describe("AvengersNFT", () => {
  let avengersNFT: Contract;
  let signers: SignerWithAddress[];

  before(async () => {
    // Deploy the AvengersNFTcontract
    const AvengersNFT = await ethers.getContractFactory("AvengersNFT");
    avengersNFT = await AvengersNFT.deploy();
    await avengersNFT.deployed();
    signers = await ethers.getSigners();
  });

  const createNFT = async (tokenURI: string) => {
    const transaction = await avengersNFT.createNFT(tokenURI);
    const receipt = await transaction.wait();
    const tokenID = receipt.events[0].args.tokenId;
    return tokenID;
  };

  const createAndListNFT = async (price: number) => {
    const tokenID = await createNFT("some token uri");
    const transaction = await avengersNFT.listNFT(tokenID, price);
    await transaction.wait();
    return tokenID;
  };

  describe("createNFT", () => {
    it("should create an NFT with the correct owner and tokenURI", async () => {
      // Call the create nft function
      const tokenURI = "https://some-token.uri/";
      const transaction = await avengersNFT.createNFT(tokenURI);
      const receipt = await transaction.wait();
      const tokenID = receipt.events[0].args.tokenId;
      // Assert that the newly created NFT's token uri is the same one sent to the createNFT function
      const mintedTokenURI = await avengersNFT.tokenURI(tokenID);
      expect(mintedTokenURI).to.equal(tokenURI);
      // Assert that the owner of the newly created NFT is the address that started the transaction
      const ownerAddress = await avengersNFT.ownerOf(tokenID);
      const currentAddress = await signers[0].getAddress();
      expect(ownerAddress).to.equal(currentAddress);
      // Assert that NFTTransfer event has the correct args
      const args = receipt.events[1].args;
      expect(args.tokenID).to.equal(tokenID);
      expect(args.from).to.equal(ethersConstants.AddressZero);
      expect(args.to).to.equal(ownerAddress);
      expect(args.tokenURI).to.equal(tokenURI);
      expect(args.price).to.equal(0);
    });
  });

  describe("listNFT", () => {
    const tokenURI = "some token uri";
    it("should revert if price is zero", async () => {
      const tokenID = await createNFT(tokenURI);
      const transaction = avengersNFT.listNFT(tokenID, 0);
      await expect(transaction).to.be.revertedWith(
        "price must be greater than 0"
      );
    });

    it("should revert if not called by the owner", async () => {
      const tokenID = await createNFT(tokenURI);
      const transaction = avengersNFT.connect(signers[1]).listNFT(tokenID, 12);
      await expect(transaction).to.be.revertedWith(
        "transfer caller is not owner nor approved"
      );
    });

    it("should list the token for sale if all requirements are met", async () => {
      const price = 123;
      const tokenID = await createNFT(tokenURI);
      const transaction = await avengersNFT.listNFT(tokenID, price);
      const receipt = await transaction.wait();
      // Ownership should be transferred to the contract
      const ownerAddress = await avengersNFT.ownerOf(tokenID);
      expect(ownerAddress).to.equal(avengersNFT.address);
      // NFTTransfer event should have the right args
      const args = receipt.events[2].args;
      expect(args.tokenID).to.equal(tokenID);
      expect(args.from).to.equal(signers[0].address);
      expect(args.to).to.equal(avengersNFT.address);
      expect(args.tokenURI).to.equal("");
      expect(args.price).to.equal(price);
    });
  });

  describe("buyNFT", () => {
    it("should revert if NFT is not listed for sale", async () => {
      const transaction = avengersNFT.buyNFT(9999);
      await expect(transaction).to.be.revertedWith(
        "nft not listed for sale"
      );
    });

    it("should revert if the amount of wei sent is not equal to the NFT price", async () => {
      const tokenID = await createAndListNFT(123);
      const transaction = avengersNFT.buyNFT(tokenID, { value: 124 });
      await expect(transaction).to.be.revertedWith(
        "incorrect price"
      );
    });

    it("should transfer ownership to the buyer and send the price to the seller", async () => {
      const price = 123;
      const sellerProfit = Math.floor((price * 95) / 100);
      const fee = price - sellerProfit;
      const initialContractBalance = await avengersNFT.provider.getBalance(
        avengersNFT.address
      );
      const tokenID = await createAndListNFT(price);
      await new Promise((r) => setTimeout(r, 100));
      const oldSellerBalance = await signers[0].getBalance();
      const transaction = await avengersNFT
        .connect(signers[1])
        .buyNFT(tokenID, { value: price });
      const receipt = await transaction.wait();
      // 95% of the price was added to the seller balance
      await new Promise((r) => setTimeout(r, 100));
      const newSellerBalance = await signers[0].getBalance();
      const diff = newSellerBalance.sub(oldSellerBalance);
      expect(diff).to.equal(sellerProfit);
      // 5% of the price was kept in the contract balance
      const newContractBalance = await avengersNFT.provider.getBalance(
        avengersNFT.address
      );
      const contractBalanceDiff = newContractBalance.sub(
        initialContractBalance
      );
      expect(contractBalanceDiff).to.equal(fee);
      // NFT ownership was transferred to the buyer
      const ownerAddress = await avengersNFT.ownerOf(tokenID);
      expect(ownerAddress).to.equal(signers[1].address);
      // NFTTransfer event has the correct arguments
      const args = receipt.events[2].args;
      expect(args.tokenID).to.equal(tokenID);
      expect(args.from).to.equal(avengersNFT.address);
      expect(args.to).to.equal(signers[1].address);
      expect(args.tokenURI).to.equal("");
      expect(args.price).to.equal(0);
    });
  });

  describe("cancelListing", () => {
    it("should revert if the NFT is not listed for sale", async () => {
      const transaction = avengersNFT.cancelListing(9999);
      await expect(transaction).to.be.revertedWith(
        "nft not listed for sale"
      );
    });

    it("should revert if the caller is not the seller of the listing", async () => {
      const tokenID = await createAndListNFT(123);
      const transaction = avengersNFT.connect(signers[1]).cancelListing(tokenID);
      await expect(transaction).to.be.revertedWith(
        "you're not the seller"
      );
    });

    it("should transfer the ownership back to the seller if all requirements are met", async () => {
      const tokenID = await createAndListNFT(123);
      const transaction = await avengersNFT.cancelListing(tokenID);
      const receipt = await transaction.wait();
      // Check ownership
      const ownerAddress = await avengersNFT.ownerOf(tokenID);
      expect(ownerAddress).to.equal(signers[0].address);
      // Check NFTTransfer event
      const args = receipt.events[2].args;
      expect(args.tokenID).to.equal(tokenID);
      expect(args.from).to.equal(avengersNFT.address);
      expect(args.to).to.equal(signers[0].address);
      expect(args.tokenURI).to.equal("");
      expect(args.price).to.equal(0);
    });
  });

  describe("withdrawFunds", () => {
    it("should revert if called by a signer other than the owner", async () => {
      const transaction = avengersNFT.connect(signers[1]).withdrawFunds();
      await expect(transaction).to.be.revertedWith(
        "caller is not the owner"
      );
    });

    it("should transfer all funds from the contract balance to the owner's", async () => {
      const contractBalance = await avengersNFT.provider.getBalance(
        avengersNFT.address
      );
      const initialOwnerBalance = await signers[0].getBalance();
      const transaction = await avengersNFT.withdrawFunds();
      const receipt = await transaction.wait();

      await new Promise((r) => setTimeout(r, 100));
      const newOwnerBalance = await signers[0].getBalance();

      const gas = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const transferred = newOwnerBalance.add(gas).sub(initialOwnerBalance);
      expect(transferred).to.equal(contractBalance);
    });

    it("should revert if contract balance is zero", async () => {
      const transaction = avengersNFT.withdrawFunds();
      await expect(transaction).to.be.revertedWith(
        "NFTMarket: balance is zero"
      );
    });
  });
});
