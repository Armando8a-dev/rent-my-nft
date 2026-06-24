export const RENT_MY_NFT_ADDRESS = "0x13e6D28912ab30198fdE03627a6733cc877196eB" as const;
export const TEST_NFT_ADDRESS = "0x07B07622B952344BE8A77b79ff8fA965d5A62d38" as const;

export const RENT_MY_NFT_ABI = [
  {
    type: "function",
    name: "rentals",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "pricePerDay", type: "uint256" },
      { name: "maxDays", type: "uint256" },
      { name: "renter", type: "address" },
      { name: "rentedUntil", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isRented",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "listForRent",
    inputs: [
      { name: "nftAddress", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "pricePerDay", type: "uint256" },
      { name: "maxDays", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rent",
    inputs: [
      { name: "nftAddress", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "numDays", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "reclaimNFT",
    inputs: [
      { name: "nftAddress", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelListing",
    inputs: [
      { name: "nftAddress", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const TEST_NFT_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [{ name: "to", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalMinted",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getApproved",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;
