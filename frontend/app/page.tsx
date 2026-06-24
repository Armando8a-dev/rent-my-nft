"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useState, useEffect } from "react";
import { RENT_MY_NFT_ADDRESS, RENT_MY_NFT_ABI, TEST_NFT_ADDRESS, TEST_NFT_ABI } from "./abi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function Home() {
  const { address, isConnected } = useAccount();
  const [txMsg, setTxMsg] = useState("");

  // List form
  const [listTokenId, setListTokenId] = useState("0");
  const [pricePerDay, setPricePerDay] = useState("0.001");
  const [maxDays, setMaxDays] = useState("7");

  // Rent form — separate lookup token ID
  const [lookupTokenId, setLookupTokenId] = useState("");
  const [numDays, setNumDays] = useState("1");
  const [showRentalInfo, setShowRentalInfo] = useState(false);

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

  // Only fetch rental info when user clicks "Lookup"
  const { data: rentalData, refetch: refetchRental } = useReadContract({
    address: RENT_MY_NFT_ADDRESS, abi: RENT_MY_NFT_ABI, functionName: "rentals",
    args: [TEST_NFT_ADDRESS, BigInt(lookupTokenId || "0")],
    query: { enabled: false }, // manual trigger only
  });

  // Positional tuple: [owner, pricePerDay, maxDays, renter, rentedUntil]
  const rentalOwner   = rentalData?.[0] as string | undefined;
  const rentalPrice   = rentalData?.[1] as bigint | undefined;
  const rentalMaxDays = rentalData?.[2] as bigint | undefined;
  const rentalRenter  = rentalData?.[3] as string | undefined;
  const rentalUntil   = rentalData?.[4] as bigint | undefined;

  const isListed = !!rentalOwner && rentalOwner !== ZERO_ADDRESS;
  const rentalActive = isListed && !!rentalRenter && rentalRenter !== ZERO_ADDRESS &&
    Number(rentalUntil ?? 0n) > Math.floor(Date.now() / 1000);
  const totalCost = isListed && rentalPrice && rentalPrice > 0n
    ? rentalPrice * BigInt(numDays || "1")
    : 0n;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      refetchTotal();
      refetchApproval();
      if (showRentalInfo) refetchRental();
      setTxMsg("Transaction confirmed!");
      setTimeout(() => setTxMsg(""), 4000);
    }
  }, [isSuccess, refetchTotal, refetchApproval, refetchRental, showRentalInfo]);

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

  const handleLookup = async () => {
    if (lookupTokenId === "") return;
    await refetchRental();
    setShowRentalInfo(true);
  };

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
          {/* Step 1: Mint */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold mb-1 text-pink-400">1️⃣ Mint a Test NFT</h2>
            <p className="text-xs text-white/50 mb-4">
              Total minted: <span className="text-white">{totalMinted?.toString() ?? "0"}</span> · Next ID will be #{totalMinted?.toString() ?? "0"}
            </p>
            <button onClick={handleMint} disabled={isPending}
              className="bg-pink-500 hover:bg-pink-400 disabled:opacity-40 text-black font-semibold px-6 py-2 rounded-xl transition-colors">
              {isPending ? "..." : "Mint TestNFT to my wallet"}
            </button>
          </div>

          {/* Step 2: List */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold mb-4 text-pink-400">2️⃣ List NFT for Rent</h2>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-white/50">Token ID</label>
                  <input type="number" min="0" value={listTokenId}
                    onChange={(e) => setListTokenId(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400" />
                </div>
                <div>
                  <label className="text-xs text-white/50">Price/day (ETH)</label>
                  <input type="number" min="0" step="0.001" value={pricePerDay}
                    onChange={(e) => setPricePerDay(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400" />
                </div>
                <div>
                  <label className="text-xs text-white/50">Max days</label>
                  <input type="number" min="1" value={maxDays}
                    onChange={(e) => setMaxDays(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                {needsApproval ? (
                  <button onClick={handleApprove} disabled={isPending}
                    className="flex-1 bg-pink-500 hover:bg-pink-400 disabled:opacity-40 text-black font-semibold py-2 rounded-xl transition-colors">
                    {isPending ? "..." : "① Approve"}
                  </button>
                ) : (
                  <button onClick={handleList} disabled={isPending}
                    className="flex-1 bg-pink-500 hover:bg-pink-400 disabled:opacity-40 text-black font-semibold py-2 rounded-xl transition-colors">
                    {isPending ? "..." : "② List for Rent"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Rent */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold mb-4 text-pink-400">3️⃣ Rent a Listed NFT</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-white/50">Token ID</label>
                  <input type="number" min="0" value={lookupTokenId}
                    onChange={(e) => { setLookupTokenId(e.target.value); setShowRentalInfo(false); }}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400"
                    placeholder="e.g. 0" />
                </div>
                <div className="flex flex-col justify-end">
                  <button onClick={handleLookup} disabled={lookupTokenId === "" || isPending}
                    className="bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-semibold py-2 rounded-xl transition-colors text-sm">
                    🔍 Lookup
                  </button>
                </div>
              </div>

              {/* Rental info panel */}
              {showRentalInfo && isListed && (
                <div className="text-xs bg-white/5 rounded-xl p-3 space-y-1">
                  <p className="text-white/50">Owner: <span className="text-white">{rentalOwner?.slice(0,6)}...{rentalOwner?.slice(-4)}</span></p>
                  <p className="text-white/50">Price/day: <span className="text-pink-400">{rentalPrice ? formatEther(rentalPrice) : "0"} ETH</span></p>
                  <p className="text-white/50">Max days: <span className="text-white">{rentalMaxDays?.toString()}</span></p>
                  <p className="text-white/50">Status: <span className={rentalActive ? "text-red-400" : "text-green-400"}>{rentalActive ? "🔴 Rented" : "🟢 Available"}</span></p>
                </div>
              )}
              {showRentalInfo && !isListed && (
                <p className="text-xs text-white/40 text-center">No listing found for this token ID.</p>
              )}

              <div>
                <label className="text-xs text-white/50">Days</label>
                <input type="number" min="1" value={numDays}
                  onChange={(e) => setNumDays(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400" />
              </div>

              <button onClick={handleRent}
                disabled={isPending || !isListed || rentalActive || totalCost === 0n}
                className="w-full bg-pink-500 hover:bg-pink-400 disabled:opacity-40 text-black font-semibold py-2 rounded-xl transition-colors">
                {isPending ? "..." : isListed ? `Rent for ${formatEther(totalCost)} ETH` : "Lookup a listing first"}
              </button>
            </div>
          </div>

          {/* Step 4: Cancel / Reclaim */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold mb-4 text-pink-400">4️⃣ Cancel or Reclaim</h2>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-white/50">Token ID</label>
                <input type="number" min="0" value={manageTokenId}
                  onChange={(e) => setManageTokenId(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-400" />
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
