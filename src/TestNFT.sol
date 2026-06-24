// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

/// @title TestNFT — Mintable ERC721 for testnet demos
contract TestNFT is ERC721 {
    uint256 private _nextTokenId;

    constructor() ERC721("TestNFT", "TNFT") {}

    /// @notice Anyone can mint a test NFT to any address
    function mint(address to) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }
}
