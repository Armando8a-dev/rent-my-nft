// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/RentMyNFT.sol";
import "../src/TestNFT.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        RentMyNFT market = new RentMyNFT();
        console.log("RentMyNFT deployed at:", address(market));

        TestNFT nft = new TestNFT();
        console.log("TestNFT deployed at:", address(nft));
        vm.stopBroadcast();
    }
}
