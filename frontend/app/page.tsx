"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useState, useEffect } from "react";
import { RENT_MY_NFT_ADDRESS, RENT_MY_NFT_ABI, TEST_NFT_ADDRESS, TEST_NFT_ABI } from "./abi";

export default function Home() {
  const { address, isConnected } = useAccount();
  const [txMsg, setTxMsg] = useState("");

  // List form
  const [listTokenId, setListTokenId] = useState("0");
  const [pricePerDay, setPricePerDay] = useState("0.001");
  const [maxDays, setMaxDays] = useState("7");

  // Rent / lookup form
  const [lookupTokenId, setLookupTokenId] = useState("0");
  const [numDays, setNumDays] = useState("1");

  // Reclaim / cancel form
  const [manageTokenId, setManageTokenId] = useState("0");

  const { data: totalMinted, refetch: refetchTotal } = useReadContract({
    address: TEST_NFT_ADDRESS, abi: TEST_NFT_ABI, functionName: "totalMinted",
  });

  const { data: approval, refetch: refetchApproval } = useReadContract({
    address: TEST_NFT_ADDRESS, abi: TEST_NFT_ABI, functionName: "getApproved",
    args: [BigInt(listTokenId || "0")],
    query: { enabled: listTokenId !== "" },
  });

  const { data: rentalInfo, refetch: refetchRental } = useReadContract({
    address: RENT_MY_NFT_ADDRESS, abi: RENT_MY_NFT_ABI, functionName: "rentals",
    args: [TEST_NFT_ADDRESS, BigInt(lookupTokenId || "0")],
    query: { enabled: lookupTokenId !== "" },
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      refetchTotal();
      refetchApproval();
      refetchRental();
      setTxMsg("Transaction confirmed!");
      setTimeout(() => setTxMsg(""), 4000);
    }
  }, [isSuccess, refetchTotal, refetchApproval, refetchRental]);

  const handleMint = () => {
    if (!address) return;
    writeContract({ address: TEST_NFT_ADDRESS, abi: TEST_NFT_ABI, functionName: "mint", args: [address] });
  };

  const needsApproval = approval?.toLowerCase() !== RENT_MY_NFT_ADDRESS.toLowerCase();

  const handleApprove = () => {
    writeContract({
      address: TEST_NFT_ADDRESS, abi: TEST_NFT_ABI, functionName: "approve",
      args: [RENT_MY_NFT_ADDRESS, BigInt(listTokenId || "0")],
    });
  };

  const handleList = () => {
    writeContract({
      address: RENT_MY_NFT_ADDRESS, abi: RENT_MY_NFT_ABI, functionName: "listForRent",
      args: [TEST_NFT_ADDRESS, BigInt(listTokenId || "0"), parseEther(pricePerDay || "0"), BigInt(maxDays || "1")],
    });
  };

  const totalCost = rentalInfo && rentalInfo[1] > 0n
    ? rentalInfo[1] * BigInt(numDays || "1")
    : 0n;

  const handleRent = () => {
    writeContract({
      address: RENT_MY_NFT_ADDRESS, abi: RENT_MY_NFT_ABI, functionName: "rent",
      args: [TEST_NFT_ADDRESS, BigInt(lookupTokenId || "0"), BigInt(numDays || "1")],
      value: totalCost,
    });
  };

  const handleCancel = () => {
    writeContract({
      address: RENT_MY_NFT_ADDRESS, abi: RENT_MY_NFT_ABI, functionName: "cancelListing",
      args: [TEST_NFT_ADDRESS, BigInt(manageTokenId || "0")],
    });
  };

  const handleReclaim = () => {
    writeContract({
      address: RENT_MY_NFT_ADDRESS, abi: RENT_MY_NFT_ABI, functionName: "reclaimNFT",
      args: [TEST_NFT_ADDRESS, BigInt(manageTokenId || "0")],
    });
  };

  const rentalActive = rentalInfo && rentalInfo[3] !== "0x0000000000000000000000000000000000000000" &&
    Number(rentalInfo[4]) > Math.floor(Date.now() / 1000);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-pink-400">🏠 RentMyNFT</h1>
          <p className="text-sm text-white/50">Peer-to-peer NFT rentals · Sepolia</p>
        </div>
        <ConnectButton />
      </div>

      {!isConnected ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
          <p className="text-4xl mb-4">🏠</p>
          <p className="text-white/60">Connect your wallet to list or rent NFTs.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Step 1: Mint test NFT */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold mb-1 text-pink-400">1️⃣ Mint a Test NFT</h2>
            <p className="text-xs text-white/50 mb-4">
              Total minted: <span className="text-white">{totalMinted?.toString() ?? "0"}</span> · Next token ID will be #{totalMinted?.toString() ?? "0"}
            </p>
            <button
              onClick={handleMint}
              disabled={isPending}
              className="bg-pink-500 hover:bg-pink-400 disabled:opacity-40 text-black font-semibold px-6 py-2 rounded-xl transition-colors"
            >
              {isPending ? "..." : "Mint TestNFT to my wallet"}
            </button>
          </div>

          {/* Step 2: List for rent */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold mb-4 text-pink-400">2️⃣ List NFT for Rent</h2>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-white/50">Token ID</label>
                  <input type="number" min="0" value={listTokenId}
                    onChange={(e) => setListTokenId(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50">Price/day (ETH)</label>
                  <input type="number" min="0" step="0.001" value={pricePerDay}
                    onChange={(e) => setPricePerDay(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50">Max days</label>
                  <input type="number" min="1" value={maxDays}
                    onChange={(e) => setMaxDays(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                {needsApproval ? (
                  <button onClick={handleApprove} disabled={isPending}
                    className="flex-1 bg-pink-500 hover:bg-pink-400 disabled:opacity-40 text-black font-semibold py-2 rounded-xl transition-colors">
                    {isPending ? "..." : "Approve"}
                  </button>
                ) : (
                  <button onClick={handleList} disabled={isPending}
                    className="flex-1 bg-pink-500 hover:bg-pink-400 disabled:opacity-40 text-black font-semibold py-2 rounded-xl transition-colors">
                    {isPending ? "..." : "List for Rent"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Rent an NFT */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold mb-4 text-pink-400">3️⃣ Rent a Listed NFT</h2>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-white/50">Token ID</label>
                  <input type="number" min="0" value={lookupTokenId}
                    onChange={(e) => setLookupTokenId(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50">Days</label>
                  <input type="number" min="1" value={numDays}
                    onChange={(e) => setNumDays(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400"
                  />
                </div>
              </div>
              {rentalInfo && rentalInfo[0] !== "0x0000000000000000000000000000000000000000" && (
                <div className="text-xs bg-white/5 rounded-xl p-3 space-y-1">
                  <p className="text-white/50">Owner: <span className="text-white">{(rentalInfo[0] as string).slice(0,6)}...{(rentalInfo[0] as string).slice(-4)}</span></p>
                  <p className="text-white/50">Price/day: <span className="text-pink-400">{formatEther(rentalInfo[1])} ETH</span></p>
                  <p className="text-white/50">Max days: <span className="text-white">{rentalInfo[2].toString()}</span></p>
                  <p className="text-white/50">Status: <span className={rentalActive ? "text-red-400" : "text-green-400"}>{rentalActive ? "🔴 Rented" : "🟢 Available"}</span></p>
                  {!rentalActive && totalCost > 0n && (
                    <p className="text-white/50">Total cost: <span className="text-white">{formatEther(totalCost)} ETH</span></p>
                  )}
                </div>
              )}
              <button onClick={handleRent} disabled={isPending || rentalActive || totalCost === 0n}
                className="w-full bg-pink-500 hover:bg-pink-400 disabled:opacity-40 text-black font-semibold py-2 rounded-xl transition-colors">
                {isPending ? "..." : `Rent for ${formatEther(totalCost)} ETH`}
              </button>
            </div>
          </div>

          {/* Step 4: Manage listing */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold mb-4 text-pink-400">4️⃣ Cancel or Reclaim</h2>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-white/50">Token ID</label>
                <input type="number" min="0" value={manageTokenId}
                  onChange={(e) => setManageTokenId(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleCancel} disabled={isPending}
                  className="bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-semibold py-2 rounded-xl transition-colors text-sm">
                  {isPending ? "..." : "Cancel Listing"}
                </button>
                <button onClick={handleReclaim} disabled={isPending}
                  className="bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-semibold py-2 rounded-xl transition-colors text-sm">
                  {isPending ? "..." : "Reclaim NFT"}
                </button>
              </div>
            </div>
          </div>

          {/* Tx feedback */}
          {txMsg && (
            <div className="rounded-xl border border-green-400/30 bg-green-400/10 p-4 text-green-400 text-sm text-center">
              ✅ {txMsg}
            </div>
          )}
          {txHash && !isSuccess && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/50 text-center">
              Waiting for confirmation...{" "}
              <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" className="text-pink-400 underline">
                View on Etherscan
              </a>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-xs text-white/20 mt-8">
        Marketplace:{" "}
        <a href={`https://sepolia.etherscan.io/address/${RENT_MY_NFT_ADDRESS}`} target="_blank" className="underline hover:text-white/40">
          {RENT_MY_NFT_ADDRESS.slice(0,6)}...{RENT_MY_NFT_ADDRESS.slice(-4)}
        </a>
        {" · "}TestNFT:{" "}
        <a href={`https://sepolia.etherscan.io/address/${TEST_NFT_ADDRESS}`} target="_blank" className="underline hover:text-white/40">
          {TEST_NFT_ADDRESS.slice(0,6)}...{TEST_NFT_ADDRESS.slice(-4)}
        </a>
      </p>
    </main>
  );
}
