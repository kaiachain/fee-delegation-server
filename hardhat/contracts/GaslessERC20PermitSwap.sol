// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IWKAIA.sol";

interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function nonces(address owner) external view returns (uint256);
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

/**
 * @title GaslessERC20PermitSwap
 * @dev Enables 100% gasless token swaps using ERC20Permit signatures
 * @notice Users only need to sign off-chain messages, backend pays all gas
 */
contract GaslessERC20PermitSwap is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    IUniswapV2Router02 public uniswapRouter;
    address public usdtToken;
    address public wkaiaToken;
    uint256 public maxUsdtAmount;

    // Events
    event GaslessSwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address executor
    );

    event RouterUpdated(address indexed previousRouter, address indexed newRouter);
    event TokensUpdated(
        address indexed previousUsdt,
        address indexed newUsdt,
        address indexed previousWkaia,
        address newWkaia
    );
    event MaxAmountUpdated(uint256 previousMax, uint256 newMax);

    constructor(address _uniswapRouter, address _usdtToken, address _wkaiaToken) Ownable(msg.sender) {
        require(_uniswapRouter != address(0), "Invalid router");
        require(_usdtToken != address(0), "Invalid USDT");
        require(_wkaiaToken != address(0), "Invalid WKAIA");

        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        usdtToken = _usdtToken;
        wkaiaToken = _wkaiaToken;
        maxUsdtAmount = 1_000_000; // 1 USDT with 6 decimals
    }

    receive() external payable {}

    /**
     * @dev Execute gasless swap using native ERC20Permit signature
     * @param user Address of token owner who signed the permit
     * @param tokenIn Address of input token (must equal predefined USDT)
     * @param tokenOut Address of output token (must equal predefined WKAIA)
     * @param amountIn Amount of input tokens to swap
     * @param amountOutMin Minimum output tokens expected (slippage protection)
     * @param deadline Permit and swap deadline
     * @param v Permit signature component
     * @param r Permit signature component
     * @param s Permit signature component
     */
    function executeSwapWithPermit(
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused {
        require(block.timestamp <= deadline, "Permit expired");
        require(tokenIn == usdtToken, "Unsupported input token");
        require(tokenOut == wkaiaToken, "Unsupported output token");
        require(user != address(0), "Invalid user");
        require(amountIn > 0 && amountOutMin > 0, "Invalid amount");
        require(amountIn <= maxUsdtAmount, "Amount exceeds limit");

        address[] memory path = new address[](2);
        path[0] = usdtToken;
        path[1] = wkaiaToken;

        uint256[] memory expectedAmounts = uniswapRouter.getAmountsOut(amountIn, path);
        require(expectedAmounts[1] >= amountOutMin, "Insufficient quote");

        IERC20Permit(tokenIn).permit(user, address(this), amountIn, deadline, v, r, s);

        IERC20(tokenIn).safeTransferFrom(user, address(this), amountIn);

        IERC20(tokenIn).forceApprove(address(uniswapRouter), amountIn);

        uint256 wkaiaBalanceBefore = IERC20(wkaiaToken).balanceOf(address(this));
        uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            deadline
        );

        uint256 wkaiaReceived = IERC20(wkaiaToken).balanceOf(address(this)) - wkaiaBalanceBefore;
        require(amounts.length >= 2 && wkaiaReceived >= amountOutMin, "Swap failed");

        uint256 nativeBalanceBefore = address(this).balance;
        IWKAIA(wkaiaToken).withdraw(wkaiaReceived);

        uint256 nativeDelta = address(this).balance - nativeBalanceBefore;
        require(nativeDelta == wkaiaReceived, "Withdraw mismatch");

        (bool success, ) = payable(user).call{value: wkaiaReceived}("");
        require(success, "Native transfer failed");

        emit GaslessSwapExecuted(user, tokenIn, tokenOut, amountIn, wkaiaReceived, msg.sender);
    }

    /**
     * @dev Get expected output amount for a swap (view function)
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @return Expected output amount
     */
    function getExpectedOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256) {
        require(tokenIn == usdtToken && tokenOut == wkaiaToken, "Invalid pair");

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = uniswapRouter.getAmountsOut(amountIn, path);
        return amounts[amounts.length - 1];
    }

    function setRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Invalid router");
        address previousRouter = address(uniswapRouter);
        uniswapRouter = IUniswapV2Router02(newRouter);
        emit RouterUpdated(previousRouter, newRouter);
    }

    function setTokens(address newUsdt, address newWkaia) external onlyOwner {
        require(newUsdt != address(0), "Invalid USDT");
        require(newWkaia != address(0), "Invalid WKAIA");
        address previousUsdt = usdtToken;
        address previousWkaia = wkaiaToken;
        usdtToken = newUsdt;
        wkaiaToken = newWkaia;
        emit TokensUpdated(previousUsdt, newUsdt, previousWkaia, newWkaia);
    }

    function setMaxUsdtAmount(uint256 newMax) external onlyOwner {
        require(newMax > 0, "Invalid amount");
        uint256 previousMax = maxUsdtAmount;
        maxUsdtAmount = newMax;
        emit MaxAmountUpdated(previousMax, newMax);
    }

    function emergencyRecoverNativeToken(address payable recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Recovery failed");
    }

    function emergencyRecoverERC20Token(address token, address recipient, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(recipient != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(recipient, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}

