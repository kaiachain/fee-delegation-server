// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "../interfaces/IWKAIA.sol";

contract MockWKAIA is ERC20Permit, IWKAIA {
    bool public forceIncorrectWithdraw;
    uint256 public withdrawMultiplierBps = 10_000;

    constructor() ERC20("Wrapped KAIA", "WKAIA") ERC20Permit("Wrapped KAIA") {}

    receive() external payable {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    function deposit() external payable override {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external override {
        _burn(msg.sender, amount);

        uint256 payout = amount;
        if (forceIncorrectWithdraw) {
            payout = (amount * withdrawMultiplierBps) / 10_000;
        }

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "MockWKAIA: withdraw failed");
    }

    function testMint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setForceIncorrectWithdraw(bool value) external {
        forceIncorrectWithdraw = value;
    }

    function setWithdrawMultiplierBps(uint256 value) external {
        withdrawMultiplierBps = value;
    }
}
