import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import type {
  GaslessERC20PermitSwap,
  MockRouter,
  MockWKAIA,
  MockUSDT,
} from "../typechain-types";

async function deployFixture() {
  const [deployer, user, executor, other, newOwner] = await ethers.getSigners();

  const MockWKAIA = await ethers.getContractFactory("MockWKAIA");
  const mockWkaia = (await MockWKAIA.deploy()) as MockWKAIA;

  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const usdt = (await MockUSDT.deploy()) as MockUSDT;

  const MockRouter = await ethers.getContractFactory("MockRouter");
  const router = (await MockRouter.deploy(
    ethers.parseUnits("100", 18),
    await usdt.getAddress(),
    await mockWkaia.getAddress()
  )) as MockRouter;

  const Swap = await ethers.getContractFactory("GaslessERC20PermitSwap");
  const swap = (await Swap.deploy(
    await router.getAddress(),
    await usdt.getAddress(),
    await mockWkaia.getAddress()
  )) as GaslessERC20PermitSwap;

  await usdt.mint(user.address, ethers.parseUnits("1000", 6));

  const wkaiaLiquidity = ethers.parseUnits("1000", 18);
  await mockWkaia.connect(deployer).deposit({ value: wkaiaLiquidity });
  await mockWkaia.connect(deployer).transfer(await router.getAddress(), wkaiaLiquidity);

  return { deployer, user, executor, other, newOwner, router, usdt, wkaia: mockWkaia, swap };
}

async function getPermitSignature({
  token,
  owner,
  spender,
  value,
  deadline,
}: {
  token: MockUSDT;
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

describe("GaslessERC20PermitSwap", function () {
  describe("constructor", function () {
    it("should set router and token addresses", async function () {
      const { router, swap, usdt, wkaia } = await loadFixture(deployFixture);
      expect(await swap.uniswapRouter()).to.equal(await router.getAddress());
      expect(await swap.usdtToken()).to.equal(await usdt.getAddress());
      expect(await swap.wkaiaToken()).to.equal(await wkaia.getAddress());
    });

    it("should revert on zero addresses", async function () {
      const MockUSDT = await ethers.getContractFactory("MockUSDT");
      const mockToken = (await MockUSDT.deploy()) as MockUSDT;
      const Router = await ethers.getContractFactory("MockRouter");
      const mockRouter = (await Router.deploy(0, await mockToken.getAddress(), await mockToken.getAddress())) as MockRouter;

      const GaslessSwap = await ethers.getContractFactory("GaslessERC20PermitSwap");

      await expect(
        GaslessSwap.deploy(
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          await mockToken.getAddress()
        )
      ).to.be.revertedWith("Invalid router");

      await expect(
        GaslessSwap.deploy(
          await mockRouter.getAddress(),
          ethers.ZeroAddress,
          await mockToken.getAddress()
        )
      ).to.be.revertedWith("Invalid USDT");

      await expect(
        GaslessSwap.deploy(
          await mockRouter.getAddress(),
          await mockToken.getAddress(),
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid WKAIA");
    });
  });

  describe("getExpectedOutput", function () {
    it("returns router quote for fixed path", async function () {
      const { swap, usdt, wkaia } = await loadFixture(deployFixture);
      const result = await swap.getExpectedOutput(await usdt.getAddress(), await wkaia.getAddress(), ethers.parseUnits("10", 18));
      expect(result).to.equal(ethers.parseUnits("100", 18));
    });

    it("reverts for invalid token pairs", async function () {
      const { swap, usdt, wkaia } = await loadFixture(deployFixture);
      await expect(swap.getExpectedOutput(await wkaia.getAddress(), await usdt.getAddress(), 1n)).to.be.revertedWith(
        "Invalid pair"
      );
    });
  });

  describe("executeSwapWithPermit negative cases", function () {
    it("reverts if tokenIn mismatch", async function () {
      const { swap, router, wkaia, user } = await loadFixture(deployFixture);
      await router.setShouldRevert(false);
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: (await ethers.getContractFactory("MockUSDT")).attach(await wkaia.getAddress()) as MockUSDT,
        owner: user,
        spender: await swap.getAddress(),
        value: ethers.parseUnits("1", 6), 
        deadline,
      });

      await expect(
        swap
          .connect(user)
          .executeSwapWithPermit(
            user.address,
            await wkaia.getAddress(),
            await wkaia.getAddress(),
            ethers.parseUnits("1", 6),
            1n,
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWith("Unsupported input token");
    });

    it("reverts if tokenOut mismatch", async function () {
      const { swap, usdt, user } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: usdt,
        owner: user,
        spender: await swap.getAddress(),
        value: ethers.parseUnits("1", 6),
        deadline,
      });

      await expect(
        swap
          .connect(user)
          .executeSwapWithPermit(
            user.address,
            await usdt.getAddress(),
            await usdt.getAddress(),
            ethers.parseUnits("1", 6),
            1n,
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWith("Unsupported output token");
    });

    it("reverts if permit expired", async function () {
      const { swap, usdt, wkaia, user } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("1", 6);
      const deadline = (await time.latest()) - 1;
      const signature = await getPermitSignature({
        token: usdt,
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
            await usdt.getAddress(),
            await wkaia.getAddress(),
            amountIn,
            1n,
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWith("Permit expired");
    });

    it("reverts if router output insufficient", async function () {
      const { swap, usdt, wkaia, user } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("1", 6);
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: usdt,
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
            await usdt.getAddress(),
            await wkaia.getAddress(),
            amountIn,
            ethers.parseUnits("200", 18),
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWith("Insufficient quote");
    });

    it("propagates router swap revert", async function () {
      const { swap, router, usdt, wkaia, user } = await loadFixture(deployFixture);
      await router.setShouldRevert(true);

      const amountIn = 1_000_000n;
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: usdt,
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
            await usdt.getAddress(),
            await wkaia.getAddress(),
            amountIn,
            1n,
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWith("MockRouter: swap reverted");
    });

    it("reverts if amount exceeds max limit", async function () {
      const { swap, usdt, wkaia, user } = await loadFixture(deployFixture);
      const amountIn = (await swap.maxUsdtAmount()) + 1n;
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: usdt,
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
            await usdt.getAddress(),
            await wkaia.getAddress(),
            amountIn,
            1n,
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWith("Amount exceeds limit");
    });

    it("reverts on invalid signature", async function () {
      const { swap, usdt, wkaia, user, other } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("1", 6);
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: usdt,
        owner: other,
        spender: await swap.getAddress(),
        value: amountIn,
        deadline,
      });

      await expect(
        swap
          .connect(user)
          .executeSwapWithPermit(
            user.address,
            await usdt.getAddress(),
            await wkaia.getAddress(),
            amountIn,
            ethers.parseUnits("90", 18),
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.reverted;
    });
  });

  describe("permit replay protection", function () {
    it("prevents reusing the same signature", async function () {
      const { swap, usdt, wkaia, user, executor } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("1", 6);
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: usdt,
        owner: user,
        spender: await swap.getAddress(),
        value: amountIn,
        deadline,
      });

      await swap
        .connect(executor)
        .executeSwapWithPermit(
          user.address,
          await usdt.getAddress(),
          await wkaia.getAddress(),
          amountIn,
          ethers.parseUnits("90", 18),
          deadline,
          signature.v,
          signature.r,
          signature.s
        );

      await expect(
        swap
          .connect(executor)
          .executeSwapWithPermit(
            user.address,
            await usdt.getAddress(),
            await wkaia.getAddress(),
            amountIn,
            ethers.parseUnits("90", 18),
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWith("Permit already used");
    });

    it("reverts when permit allowance is lower than amountIn", async function () {
      const { swap, usdt, wkaia, user, executor } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("0.2", 6);
      const permittedAmount = ethers.parseUnits("0.05", 6);

      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: usdt,
        owner: user,
        spender: await swap.getAddress(),
        value: permittedAmount,
        deadline,
      });

      await expect(
        swap
          .connect(executor)
          .executeSwapWithPermit(
            user.address,
            await usdt.getAddress(),
            await wkaia.getAddress(),
            amountIn,
            ethers.parseUnits("90", 18),
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      ).to.be.revertedWithCustomError(usdt, "ERC2612InvalidSigner");
    });
  });

  describe("executeSwapWithPermit success path", function () {
    it("swaps USDT to native KAIA and sends to user", async function () {
      const { swap, router, usdt, wkaia, user, executor } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("0.1", 6);
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: usdt,
        owner: user,
        spender: await swap.getAddress(),
        value: amountIn,
        deadline,
      });

      expect(await usdt.allowance(user.address, await swap.getAddress())).to.equal(0n);

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      await expect(
        swap
          .connect(executor)
          .executeSwapWithPermit(
            user.address,
            await usdt.getAddress(),
            await wkaia.getAddress(),
            amountIn,
            ethers.parseUnits("90", 18),
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      )
        .to.emit(swap, "GaslessSwapExecuted")
        .withArgs(
          user.address,
          await usdt.getAddress(),
          await wkaia.getAddress(),
          amountIn,
          ethers.parseUnits("100", 18),
          executor.address
        );

      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      expect(userBalanceAfter - userBalanceBefore).to.equal(ethers.parseUnits("100", 18));
      expect(await wkaia.balanceOf(user.address)).to.equal(0);
      expect(await usdt.balanceOf(user.address)).to.equal(ethers.parseUnits("999.9", 6));
      expect(await usdt.allowance(user.address, await swap.getAddress())).to.equal(0n);
      expect(await router.lastAmountIn()).to.equal(amountIn);
    });

    it("swaps USDT to native KAIA and sends to user (permit allowance overwrites)", async function () {
      const { swap, router, usdt, wkaia, user, executor } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("0.1", 6);
      await usdt.connect(user).approve(await swap.getAddress(), ethers.parseUnits("0.2", 6));
      const deadline = (await time.latest()) + 1000;
      const signature = await getPermitSignature({
        token: usdt,
        owner: user,
        spender: await swap.getAddress(),
        value: amountIn,
        deadline,
      });

      expect(await usdt.allowance(user.address, await swap.getAddress())).to.equal(ethers.parseUnits("0.2", 6));

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      await expect(
        swap
          .connect(executor)
          .executeSwapWithPermit(
            user.address,
            await usdt.getAddress(),
            await wkaia.getAddress(),
            amountIn,
            ethers.parseUnits("90", 18),
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      )
        .to.emit(swap, "GaslessSwapExecuted")
        .withArgs(
          user.address,
          await usdt.getAddress(),
          await wkaia.getAddress(),
          amountIn,
          ethers.parseUnits("100", 18),
          executor.address
        );

      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      expect(userBalanceAfter - userBalanceBefore).to.equal(ethers.parseUnits("100", 18));
      expect(await wkaia.balanceOf(user.address)).to.equal(0);
      expect(await usdt.balanceOf(user.address)).to.equal(ethers.parseUnits("999.9", 6));
      expect(await usdt.allowance(user.address, await swap.getAddress())).to.equal(0n);
      expect(await router.lastAmountIn()).to.equal(amountIn);
    });
  });

  describe("admin controls", function () {
    it("allows owner to transfer ownership", async function () {
      const { swap, deployer, newOwner } = await loadFixture(deployFixture);

      await expect(swap.connect(deployer).transferOwnership(newOwner.address))
        .to.emit(swap, "OwnershipTransferred")
        .withArgs(deployer.address, newOwner.address);

      expect(await swap.owner()).to.equal(newOwner.address);

      await expect(swap.connect(deployer).setMaxUsdtAmount(2_000_000n)).to.be.revertedWithCustomError(
        swap,
        "OwnableUnauthorizedAccount"
      );

      await swap.connect(newOwner).setMaxUsdtAmount(2_000_000n);
      expect(await swap.maxUsdtAmount()).to.equal(2_000_000n);
    });

    it("prevents unauthorized or zero-address ownership transfers", async function () {
      const { swap, deployer, other } = await loadFixture(deployFixture);

      await expect(swap.connect(other).transferOwnership(other.address)).to.be.revertedWithCustomError(
        swap,
        "OwnableUnauthorizedAccount"
      );

      await expect(swap.connect(deployer).transferOwnership(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        swap,
        "OwnableInvalidOwner"
      );
    });

    it("allows owner to update router", async function () {
      const { swap, deployer, usdt, wkaia } = await loadFixture(deployFixture);
      const MockRouter = await ethers.getContractFactory("MockRouter");
      const newRouter = await MockRouter.deploy(ethers.parseUnits("100", 18), await usdt.getAddress(), await wkaia.getAddress());
      await swap.connect(deployer).setRouter(await newRouter.getAddress());
      expect(await swap.uniswapRouter()).to.equal(await newRouter.getAddress());
    });

    it("prevents non-owner from updating router", async function () {
      const { swap, other, usdt, wkaia } = await loadFixture(deployFixture);
      const MockRouter = await ethers.getContractFactory("MockRouter");
      const newRouter = await MockRouter.deploy(ethers.parseUnits("100", 18), await usdt.getAddress(), await wkaia.getAddress());
      await expect(swap.connect(other).setRouter(await newRouter.getAddress())).to.be.revertedWithCustomError(
        swap,
        "OwnableUnauthorizedAccount"
      );
    });

    it("allows owner to update tokens", async function () {
      const { swap, deployer } = await loadFixture(deployFixture);
      const MockUSDT = await ethers.getContractFactory("MockUSDT");
      const newUsdt = await MockUSDT.deploy();
      const MockWKAIA = await ethers.getContractFactory("MockWKAIA");
      const newWkaia = await MockWKAIA.deploy();
      await swap.connect(deployer).setTokens(await newUsdt.getAddress(), await newWkaia.getAddress());
      expect(await swap.usdtToken()).to.equal(await newUsdt.getAddress());
      expect(await swap.wkaiaToken()).to.equal(await newWkaia.getAddress());
    });

    it("prevents non-owner from updating tokens", async function () {
      const { swap, other, usdt, wkaia } = await loadFixture(deployFixture);
      await expect(swap.connect(other).setTokens(await usdt.getAddress(), await wkaia.getAddress())).to.be.revertedWithCustomError(
        swap,
        "OwnableUnauthorizedAccount"
      );
    });

    it("allows owner to update max amount", async function () {
      const { swap, deployer } = await loadFixture(deployFixture);
      await swap.connect(deployer).setMaxUsdtAmount(2_000_000n);
      expect(await swap.maxUsdtAmount()).to.equal(2_000_000n);
    });

    it("prevents non-owner from updating max amount", async function () {
      const { swap, other } = await loadFixture(deployFixture);
      await expect(swap.connect(other).setMaxUsdtAmount(2_000_000n)).to.be.revertedWithCustomError(
        swap,
        "OwnableUnauthorizedAccount"
      );
    });

    it("allows owner to recover native tokens", async function () {
      const { swap, deployer } = await loadFixture(deployFixture);
      await deployer.sendTransaction({ to: await swap.getAddress(), value: ethers.parseUnits("1", 18) });
      const balanceBefore = await ethers.provider.getBalance(deployer.address);
      await swap.connect(deployer).emergencyRecoverNativeToken(deployer.address, ethers.parseUnits("1", 18));
      const balanceAfter = await ethers.provider.getBalance(deployer.address);
      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });

    it("prevents non-owner from recovering native tokens", async function () {
      const { swap, other } = await loadFixture(deployFixture);
      await expect(
        swap.connect(other).emergencyRecoverNativeToken(other.address, 1n)
      ).to.be.revertedWithCustomError(swap, "OwnableUnauthorizedAccount");
    });

    it("allows owner to recover arbitrary ERC20 tokens", async function () {
      const { swap, deployer, usdt } = await loadFixture(deployFixture);
      await usdt.mint(await swap.getAddress(), ethers.parseUnits("1", 6));
      const balanceBefore = await usdt.balanceOf(deployer.address);
      await swap.connect(deployer).emergencyRecoverERC20Token(await usdt.getAddress(), deployer.address, ethers.parseUnits("1", 6));
      const balanceAfter = await usdt.balanceOf(deployer.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseUnits("1", 6));
    });

    it("prevents non-owner from recovering ERC20 tokens", async function () {
      const { swap, deployer, other, usdt } = await loadFixture(deployFixture);
      await usdt.mint(await swap.getAddress(), ethers.parseUnits("1", 6));
      await expect(
        swap.connect(other).emergencyRecoverERC20Token(await usdt.getAddress(), deployer.address, ethers.parseUnits("1", 6))
      ).to.be.revertedWithCustomError(swap, "OwnableUnauthorizedAccount");
    });
  });
});

