import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import type {
  GaslessERC20PermitSwap,
  MockERC20Permit,
  MockRouter,
} from "../typechain-types";

async function deployFixture() {
  const [deployer, user, executor] = await ethers.getSigners();

  const MockRouter = await ethers.getContractFactory("MockRouter");
  const router = (await MockRouter.deploy(ethers.parseUnits("100", 18))) as MockRouter;

  const Token = await ethers.getContractFactory("MockERC20Permit");
  const tokenIn = (await Token.deploy("TokenIn", "TIN")) as MockERC20Permit;
  const tokenOut = (await Token.deploy("TokenOut", "TOUT")) as MockERC20Permit;

  const Swap = await ethers.getContractFactory("GaslessERC20PermitSwap");
  const swap = (await Swap.deploy(await router.getAddress())) as GaslessERC20PermitSwap;

  await tokenIn.mint(user.address, ethers.parseUnits("1000", 18));

  return { deployer, user, executor, router, tokenIn, tokenOut, swap };
}

describe("GaslessERC20PermitSwap", function () {
  describe("constructor", function () {
    it("should set router", async function () {
      const { router, swap } = await loadFixture(deployFixture);
      expect(await swap.uniswapRouter()).to.equal(await router.getAddress());
    });

    it("should revert on zero router", async function () {
      const Swap = await ethers.getContractFactory("GaslessERC20PermitSwap");
      await expect(Swap.deploy(ethers.ZeroAddress)).to.be.revertedWith("Invalid router");
    });
  });

  describe("getExpectedOutput", function () {
    it("returns router quote", async function () {
      const { swap, tokenIn, tokenOut } = await loadFixture(deployFixture);
      const result = await swap.getExpectedOutput(
        await tokenIn.getAddress(),
        await tokenOut.getAddress(),
        ethers.parseUnits("10", 18)
      );
      expect(result).to.equal(ethers.parseUnits("100", 18));
    });
  });

  describe("executeSwapWithPermit negative cases", function () {
    it("reverts if permit expired", async function () {
      const { swap, tokenIn, tokenOut, user } = await loadFixture(deployFixture);

      const amountIn = ethers.parseUnits("10", 18);
      const deadline = (await time.latest()) - 1;
      const signature = await getPermitSignature({
        token: tokenIn,
        owner: user,
        spender: await swap.getAddress(),
        value: amountIn,
        deadline,
      });

      await expect(
        swap
          .connect(user)
          .executeSwapWithPermit(
            user.address,
            await tokenIn.getAddress(),
            await tokenOut.getAddress(),
            amountIn,
            ethers.parseUnits("90", 18),
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWithCustomError(swap, "PermitExpired");
    });

    it("reverts if token pair invalid", async function () {
      const { swap, tokenIn, user } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("10", 18);
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: tokenIn,
        owner: user,
        spender: await swap.getAddress(),
        value: amountIn,
        deadline,
      });

      await expect(
        swap
          .connect(user)
          .executeSwapWithPermit(
            user.address,
            await tokenIn.getAddress(),
            await tokenIn.getAddress(),
            amountIn,
            ethers.parseUnits("90", 18),
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWithCustomError(swap, "InvalidTokenPair");
    });

    it("reverts if amountOutMin above router quote", async function () {
      const { swap, tokenIn, tokenOut, user } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("10", 18);
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: tokenIn,
        owner: user,
        spender: await swap.getAddress(),
        value: amountIn,
        deadline,
      });

      await expect(
        swap
          .connect(user)
          .executeSwapWithPermit(
            user.address,
            await tokenIn.getAddress(),
            await tokenOut.getAddress(),
            amountIn,
            ethers.parseUnits("1000", 18),
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWithCustomError(swap, "InsufficientOutput");
    });

    it("reverts if router swap reverts", async function () {
      const { swap, router, tokenIn, tokenOut, user } = await loadFixture(deployFixture);
      await router.setShouldRevert(true);

      const amountIn = ethers.parseUnits("10", 18);
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: tokenIn,
        owner: user,
        spender: await swap.getAddress(),
        value: amountIn,
        deadline,
      });

      await expect(
        swap
          .connect(user)
          .executeSwapWithPermit(
            user.address,
            await tokenIn.getAddress(),
            await tokenOut.getAddress(),
            amountIn,
            ethers.parseUnits("90", 18),
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWith("MockRouter: swap reverted");
    });
  });
});

async function getPermitSignature({
  token,
  owner,
  spender,
  value,
  deadline,
}: {
  token: MockERC20Permit;
  owner: any;
  spender: string;
  value: bigint;
  deadline: number;
}) {
  const nonce = await token.nonces(owner.address);
  const name = await token.name();
  const version = "1";
  const chainId = (await owner.provider!.getNetwork()).chainId;
  const domain = {
    name,
    version,
    chainId,
    verifyingContract: await token.getAddress(),
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const message = {
    owner: owner.address,
    spender,
    value,
    nonce,
    deadline,
  };

  const signature = await owner.signTypedData(domain, types, message);
  const { r, s, v } = ethers.Signature.from(signature);

  return { v, r, s };
}

