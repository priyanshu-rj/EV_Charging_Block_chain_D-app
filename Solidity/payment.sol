// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PaymentSystem {
    address public owner;

    event PaymentMade(address indexed from, uint256 amount, string note);
    event Withdraw(address indexed to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    // ✅ Multiple payments in a single transaction
    function makeMultiplePayments(
        uint256[] calldata amounts,
        string[] calldata notes
    ) external payable {
        require(amounts.length == notes.length, "Length mismatch");
        
        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        require(msg.value == total, "Incorrect total ETH sent");

        // Emit events for each payment
        for (uint256 i = 0; i < amounts.length; i++) {
            emit PaymentMade(msg.sender, amounts[i], notes[i]);
        }
    }

    // Withdraw all ETH to owner
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");
        payable(owner).transfer(balance);
        emit Withdraw(owner, balance);
    }

    // Check balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
