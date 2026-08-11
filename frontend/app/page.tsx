"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount, useReadContract, useReadContracts,
  useWriteContract, useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { useState, useEffect, useMemo } from "react";
import {
  RENT_MY_NFT_ADDRESS, TEST_NFT_ADDRESS, RENT_MY_NFT_ABI, TEST_NFT_ABI,
} from "./abi";

const ZERO = "0x0000000000000000000000000000000000000000";
const short = (a?: string) => (a && a !== ZERO ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

type Work = {
  id: number; holder: string; owner: string;
  pricePerDay: bigint; maxDays: bigint; renter: string; rentedUntil: number;
};

const TIERS = [
  { name: "Common",    c: "#22e0ff" },
  { name: "Rare",      c: "#b026ff" },
  { name: "Legendary", c: "#ccff00" },
];
const tierOf = (id: number) => TIERS[(id * 7 + 1) % TIERS.length];

/* ───────── bold generative loot art ───────── */
function LootArt({ id }: { id: number }) {
  const shapes = useMemo(() => {
    const rnd = (k: number) => ((id * 9301 + k * 49297) % 233280) / 233280;
    const pal = [["#ccff00", "#22e0ff"], ["#b026ff", "#ff2e88"], ["#22e0ff", "#b026ff"], ["#ff2e88", "#ccff00"]];
    return Array.from({ length: 4 }, (_, i) => {
      const [a, b] = pal[(id + i) % pal.length];
      return {
        cx: 40 + rnd(i + 1) * 120,
        cy: 40 + rnd(i + 5) * 120,
        r: 34 + rnd(i + 9) * 46,
        rot: rnd(i + 13) * 360,
        a, b,
        round: rnd(i + 17) > 0.45,
      };
    });
  }, [id]);

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden>
      <defs>
        {shapes.map((s, i) => (
          <linearGradient key={i} id={`g${id}-${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={s.a} />
            <stop offset="100%" stopColor={s.b} />
          </linearGradient>
        ))}
        <filter id={`blur${id}`}><feGaussianBlur stdDeviation="7" /></filter>
      </defs>

      {/* glow bed */}
      <g filter={`url(#blur${id})`} opacity="0.55">
        {shapes.slice(0, 2).map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={`url(#g${id}-${i})`} />
        ))}
      </g>

      {/* solid overlapping forms */}
      <g style={{ mixBlendMode: "screen" }}>
        {shapes.map((s, i) =>
          s.round ? (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={`url(#g${id}-${i})`} opacity="0.62" />
          ) : (
            <rect key={i} x={s.cx - s.r} y={s.cy - s.r} width={s.r * 2} height={s.r * 2}
              rx={s.r * 0.22} fill={`url(#g${id}-${i})`} opacity="0.58"
              transform={`rotate(${s.rot} ${s.cx} ${s.cy})`} />
          )
        )}
      </g>

      {/* item sigil */}
      <text x="100" y="118" textAnchor="middle"
        className="font-display"
        style={{ fontSize: 62, fontWeight: 700, fill: "rgba(11,6,22,0.55)" }}>
        {String(id).padStart(2, "0")}
      </text>
    </svg>
  );
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [form, setForm] = useState<Record<number, { price: string; days: string; rent: string }>>({});
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15_000);
    return () => clearInterval(t);
  }, []);

  const R = { address: RENT_MY_NFT_ADDRESS, abi: RENT_MY_NFT_ABI } as const;
  const N = { address: TEST_NFT_ADDRESS, abi: TEST_NFT_ABI } as const;

  const { data: minted, refetch: rMinted } = useReadContract({
    ...N, functionName: "totalMinted", query: { refetchInterval: 15000 },
  });
  const count = minted ? Number(minted) : 0;
  const ids = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  const { data: scan, refetch: rScan } = useReadContracts({
    contracts: ids.flatMap((i) => [
      { ...N, functionName: "ownerOf", args: [BigInt(i)] } as const,
      { ...R, functionName: "rentals", args: [TEST_NFT_ADDRESS, BigInt(i)] } as const,
      { ...N, functionName: "getApproved", args: [BigInt(i)] } as const,
    ]),
    query: { enabled: count > 0, refetchInterval: 15000 },
  });

  const works: Work[] = useMemo(
    () => ids.map((i) => {
      const h = scan?.[i * 3];
      const r = scan?.[i * 3 + 1]?.result as readonly [string, bigint, bigint, string, bigint] | undefined;
      return {
        id: i,
        holder: h?.status === "success" ? String(h.result) : ZERO,
        owner: r?.[0] ?? ZERO,
        pricePerDay: r?.[1] ?? 0n,
        maxDays: r?.[2] ?? 0n,
        renter: r?.[3] ?? ZERO,
        rentedUntil: Number(r?.[4] ?? 0n),
      };
    }),
    [scan, ids]
  );
  const approvals = useMemo(
    () => ids.map((i) => (scan?.[i * 3 + 2]?.status === "success" ? String(scan[i * 3 + 2].result) : ZERO)),
    [scan, ids]
  );

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const busy = isPending || isMining;
  useEffect(() => {
    if (isSuccess) { rMinted(); rScan(); reset(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const f = (i: number) => form[i] ?? { price: "0.001", days: "7", rent: "1" };
  const setF = (i: number, p: Partial<{ price: string; days: string; rent: string }>) =>
    setForm((s) => ({ ...s, [i]: { ...f(i), ...p } }));

  const mint = () => writeContract({ ...N, functionName: "mint", args: [address!] });
  const approve = (id: number) =>
    writeContract({ ...N, functionName: "approve", args: [RENT_MY_NFT_ADDRESS, BigInt(id)] });
  const list = (id: number) =>
    writeContract({
      ...R, functionName: "listForRent",
      args: [TEST_NFT_ADDRESS, BigInt(id), parseEther(f(id).price || "0"), BigInt(f(id).days || "1")],
    });
  const rent = (id: number, days: number, price: bigint) =>
    writeContract({
      ...R, functionName: "rent", args: [TEST_NFT_ADDRESS, BigInt(id), BigInt(days)],
      value: price * BigInt(days),
    });
  const reclaim = (id: number) =>
    writeContract({ ...R, functionName: "reclaimNFT", args: [TEST_NFT_ADDRESS, BigInt(id)] });
  const cancel = (id: number) =>
    writeContract({ ...R, functionName: "cancelListing", args: [TEST_NFT_ADDRESS, BigInt(id)] });

  const input =
    "w-full bg-black/40 border border-white/15 rounded px-3 py-2 text-sm tabular focus:outline-none focus:border-[var(--acid)] transition-colors";
  const ghost =
    "font-display text-[11px] tracking-[0.12em] uppercase px-4 py-2.5 rounded border transition-colors disabled:opacity-30";

  const onLoanCount = works.filter((w) => w.rentedUntil > now).length;
  const availCount = works.filter((w) => w.owner !== ZERO && w.rentedUntil <= now).length;

  return (
    <div className="relative min-h-dvh">
      <div className="arena" />

      <div className="relative z-10 min-h-dvh flex flex-col">
        {/* ═══ HUD BAR ═══ */}
        <header className="px-5 md:px-10 pt-7">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h1 className="font-display text-3xl md:text-[42px] font-bold leading-none tracking-tight">
                RENT<span style={{ color: "var(--acid)" }}>MY</span>NFT
              </h1>
              <p className="font-display text-[11px] tracking-[0.28em] text-white/40 mt-2.5 uppercase">
                Loot Vault · rent by the day · Sepolia
              </p>
            </div>
            <ConnectButton />
          </div>

          {/* stat rail */}
          <div className="mt-7 flex flex-wrap gap-3">
            {[
              { k: "IN VAULT", v: String(count), c: "#eae6f5" },
              { k: "AVAILABLE", v: String(availCount), c: "var(--acid)" },
              { k: "ON LOAN", v: String(onLoanCount), c: "var(--hot)" },
            ].map((s) => (
              <div key={s.k} className="notch px-4 py-2.5 border border-white/10 bg-white/[0.04] min-w-[104px]">
                <p className="font-display text-[9px] tracking-[0.2em] text-white/40">{s.k}</p>
                <p className="font-display text-2xl font-bold tabular leading-none mt-1" style={{ color: s.c }}>{s.v}</p>
              </div>
            ))}
          </div>
        </header>

        {/* ═══ INVENTORY ═══ */}
        <main className="flex-1 px-5 md:px-10 py-9">
          {!isConnected ? (
            <div className="max-w-lg py-14">
              <p className="font-display text-[11px] tracking-[0.28em] mb-4" style={{ color: "var(--acid)" }}>
                ▸ VAULT LOCKED
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold leading-[1.05]">
                Lend your loot.<br />Keep the deed.
              </h2>
              <p className="text-white/45 mt-5 leading-relaxed">
                The vault escrows an item for the length of its term. The timer runs on-chain, and
                when it expires the owner takes it back — no trust, no counterparty.
              </p>
            </div>
          ) : count === 0 ? (
            <div className="py-16 text-center">
              <p className="font-display text-sm tracking-[0.2em] text-white/40 mb-5">VAULT EMPTY</p>
              <button onClick={mint} disabled={busy} className="cta px-7 py-3 rounded font-bold">
                {busy ? "MINTING…" : "MINT FIRST ITEM"}
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {works.map((w) => {
                const isListed = w.owner !== ZERO;
                const onLoan = w.rentedUntil > now;
                const iAmOwner = !!address && w.owner.toLowerCase() === address.toLowerCase();
                const iHoldIt = !!address && w.holder.toLowerCase() === address.toLowerCase();
                const needsApproval = approvals[w.id]?.toLowerCase() !== RENT_MY_NFT_ADDRESS.toLowerCase();
                const hLeft = Math.max(0, Math.ceil((w.rentedUntil - now) / 3600));
                const tier = tierOf(w.id);
                const tierCls = onLoan ? "tier-loan" : isListed ? "tier-available" : "tier-idle";
                const statusColor = onLoan ? "var(--hot)" : isListed ? "var(--acid)" : "rgba(234,230,245,0.45)";

                return (
                  <article key={w.id} className={`slot notch ${tierCls} rounded-lg p-4 flex flex-col`}>
                    {/* tier + status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="tag" style={{ color: tier.c }}>{tier.name}</span>
                      <span className="tag flex items-center gap-1.5" style={{ color: statusColor }}>
                        {onLoan && <span className="cooldown w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />}
                        {onLoan ? "On loan" : isListed ? "Available" : iHoldIt ? "Yours" : "Idle"}
                      </span>
                    </div>

                    {/* artwork */}
                    <div className="relative aspect-square rounded-md overflow-hidden mb-4"
                      style={{ background: "#07040f", border: `1px solid ${tier.c}33` }}>
                      <LootArt id={w.id} />
                      <div className="scanline" />
                      {onLoan && (
                        <div className="absolute inset-x-0 bottom-0 px-3 py-2 flex items-center justify-between"
                          style={{ background: "linear-gradient(0deg, rgba(7,4,15,0.95), transparent)" }}>
                          <span className="font-display text-[10px] tracking-[0.16em]" style={{ color: "var(--hot)" }}>
                            COOLDOWN
                          </span>
                          <span className="font-display text-lg font-bold tabular" style={{ color: "var(--hot)" }}>
                            {hLeft}h
                          </span>
                        </div>
                      )}
                    </div>

                    {/* title + price */}
                    <div className="flex items-baseline justify-between gap-2 mb-3">
                      <h3 className="font-display text-lg font-bold">ITEM #{String(w.id).padStart(2, "0")}</h3>
                      {isListed && (
                        <span className="font-display text-sm tabular" style={{ color: "var(--acid)" }}>
                          {formatEther(w.pricePerDay)} Ξ<span className="text-white/40 text-xs">/day</span>
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-white/35 mb-4">
                      {isListed ? `Max ${w.maxDays} days · ` : ""}
                      {w.holder === RENT_MY_NFT_ADDRESS ? "Held in vault" : `Held by ${short(w.holder)}`}
                    </p>

                    {/* actions */}
                    <div className="mt-auto space-y-2">
                      {!isListed && iHoldIt && (
                        <>
                          <div className="flex gap-2">
                            <input value={f(w.id).price} onChange={(e) => setF(w.id, { price: e.target.value })}
                              className={input} placeholder="Ξ/day" />
                            <input value={f(w.id).days} onChange={(e) => setF(w.id, { days: e.target.value })}
                              className={`${input} w-24`} placeholder="days" />
                          </div>
                          {needsApproval ? (
                            <button onClick={() => approve(w.id)} disabled={busy}
                              className={`${ghost} w-full`} style={{ borderColor: "var(--acid)", color: "var(--acid)" }}>
                              {busy ? "…" : "1 · Approve vault"}
                            </button>
                          ) : (
                            <button onClick={() => list(w.id)} disabled={busy}
                              className="cta w-full py-2.5 rounded font-bold text-[12px]">
                              {busy ? "…" : "LIST FOR RENT"}
                            </button>
                          )}
                        </>
                      )}

                      {isListed && !onLoan && !iAmOwner && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-[10px] tracking-[0.16em] text-white/40 shrink-0">DAYS</span>
                            <input value={f(w.id).rent} onChange={(e) => setF(w.id, { rent: e.target.value })}
                              className={input} />
                          </div>
                          <button onClick={() => rent(w.id, Number(f(w.id).rent || 1), w.pricePerDay)}
                            disabled={busy || !f(w.id).rent}
                            className="cta w-full py-2.5 rounded font-bold text-[12px]">
                            {busy ? "…" : `RENT — ${formatEther(w.pricePerDay * BigInt(f(w.id).rent || 1))} Ξ`}
                          </button>
                        </>
                      )}

                      {isListed && !onLoan && iAmOwner && (
                        <div className="flex gap-2">
                          <button onClick={() => reclaim(w.id)} disabled={busy}
                            className="cta flex-1 py-2.5 rounded font-bold text-[12px]">
                            {busy ? "…" : "RECLAIM"}
                          </button>
                          <button onClick={() => cancel(w.id)} disabled={busy}
                            className={`${ghost} flex-1`} style={{ borderColor: "rgba(255,255,255,0.2)" }}>
                            {busy ? "…" : "Delist"}
                          </button>
                        </div>
                      )}

                      {onLoan && (
                        <p className="font-display text-[10px] tracking-[0.16em] text-center py-2"
                          style={{ color: "var(--hot)" }}>
                          RENTED BY {short(w.renter)}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        {/* ═══ FOOTER ═══ */}
        <footer className="px-5 md:px-10 pb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            {isConnected && (
              <button onClick={mint} disabled={busy}
                className="font-display text-[10px] tracking-[0.18em] uppercase text-white/35 hover:text-[var(--acid)] transition-colors disabled:opacity-30">
                + Mint item to vault
              </button>
            )}
            {txHash && !isSuccess && (
              <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer"
                className="font-display text-[10px] tracking-[0.18em] uppercase" style={{ color: "var(--acid)" }}>
                ◆ Awaiting confirmation
              </a>
            )}
          </div>
          <a href={`https://sepolia.etherscan.io/address/${RENT_MY_NFT_ADDRESS}`} target="_blank" rel="noreferrer"
            className="font-display text-[10px] tracking-[0.18em] uppercase text-white/25 hover:text-white/55 transition-colors">
            Vault {RENT_MY_NFT_ADDRESS.slice(0, 8)}…{RENT_MY_NFT_ADDRESS.slice(-6)}
          </a>
        </footer>
      </div>
    </div>
  );
}
