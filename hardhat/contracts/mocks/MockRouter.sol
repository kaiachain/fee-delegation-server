// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../GaslessERC20PermitSwap.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockRouter is IUniswapV2Router02 {
    using SafeERC20 for IERC20;

    uint256 public lastAmountIn;
    uint256 public minimumOut;
    bool public shouldRevert;
    address public wkaia;
    address public usdt;

    constructor(uint256 _minimumOut, address _usdt, address _wkaia) {
        minimumOut = _minimumOut;
        usdt = _usdt;
        wkaia = _wkaia;
    }

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override returns (uint256[] memory amounts) {
        require(path.length == 2, "Invalid path");
        require(path[0] == usdt && path[1] == wkaia, "Unexpected path");
        require(to != address(0), "Invalid recipient");
        require(deadline >= block.timestamp, "Expired deadline");

        if (shouldRevert) {
            revert("MockRouter: swap reverted");
        }

        if (amountOutMin > minimumOut) {
            revert("MockRouter: insufficient output");
        }

        lastAmountIn = amountIn;

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = minimumOut;

        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(path[1]).safeTransfer(to, minimumOut);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        override
        returns (uint256[] memory amounts)
    {
        require(path.length == 2, "Invalid path");

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = minimumOut;
    }
}

