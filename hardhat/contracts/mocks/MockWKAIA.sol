// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "../interfaces/IWKAIA.sol";

contract MockWKAIA is ERC20Permit, IWKAIA {
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
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "MockWKAIA: withdraw failed");
    }

    function testMint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
