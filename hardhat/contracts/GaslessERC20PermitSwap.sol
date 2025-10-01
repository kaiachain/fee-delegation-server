// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
contract GaslessERC20PermitSwap is ReentrancyGuard {
    IUniswapV2Router02 public immutable uniswapRouter;

    // Events
    event GaslessSwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address executor
    );

    // Custom errors for gas efficiency
    error PermitExpired();
    error InvalidTokenPair();
    error InsufficientOutput();
    error SwapFailed();

    constructor(address _uniswapRouter) {
        require(_uniswapRouter != address(0), "Invalid router");
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
    }

    /**
     * @dev Execute gasless swap using native ERC20Permit signature
     * @param user Address of token owner who signed the permit
     * @param tokenIn Address of input token (must be ERC20Permit)
     * @param tokenOut Address of output token
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
    ) external nonReentrant {
        // Input validation
        if (block.timestamp > deadline) revert PermitExpired();
        if (tokenIn == tokenOut) revert InvalidTokenPair();
        require(user != address(0), "Invalid user");
        require(amountIn > 0, "Invalid amount");

        // 1. Execute permit - grants allowance via signature (no gas from user)
        IERC20Permit(tokenIn).permit(
            user, // Token owner
            address(this), // Spender (this contract)
            amountIn, // Amount to approve
            deadline, // Permit deadline
            v,
            r,
            s // Signature components
        );

        // 2. Transfer tokens from user to this contract
        IERC20(tokenIn).transferFrom(user, address(this), amountIn);

        // 3. Approve Uniswap router
        IERC20(tokenIn).approve(address(uniswapRouter), amountIn);

        // 4. Execute swap
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        // Verify expected output meets minimum requirement
        uint256[] memory expectedAmounts = uniswapRouter.getAmountsOut(amountIn, path);
        if (expectedAmounts[1] < amountOutMin) revert InsufficientOutput();

        // Execute swap - output tokens sent directly to user
        uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            user, // Recipient is the user
            deadline
        );

        if (amounts.length < 2 || amounts[amounts.length - 1] < amountOutMin) revert SwapFailed();

        emit GaslessSwapExecuted(
            user,
            tokenIn,
            tokenOut,
            amountIn,
            amounts[amounts.length - 1],
            msg.sender // Backend executor
        );
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
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = uniswapRouter.getAmountsOut(amountIn, path);
        return amounts[amounts.length - 1];
    }
}

