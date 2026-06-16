// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title RentMyNFT — Peer-to-peer NFT rental marketplace with time-locked escrow
contract RentMyNFT is ReentrancyGuard {
    uint256 public constant SECONDS_PER_DAY = 86_400;

    struct Rental {
        address owner;
        uint256 pricePerDay; // wei per day
        uint256 maxDays;
        address renter;
        uint256 rentedUntil; // block.timestamp when rental expires
    }

    // nftAddress => tokenId => Rental
    mapping(address => mapping(uint256 => Rental)) public rentals;

    event Listed(address indexed owner, address indexed nftAddress, uint256 indexed tokenId, uint256 pricePerDay, uint256 maxDays);
    event Rented(address indexed renter, address indexed nftAddress, uint256 indexed tokenId, uint256 numDays, uint256 paid);
    event Reclaimed(address indexed owner, address indexed nftAddress, uint256 indexed tokenId);
    event ListingCancelled(address indexed owner, address indexed nftAddress, uint256 indexed tokenId);

    error ZeroPrice();
    error ZeroMaxDays();
    error NotListed();
    error AlreadyRented();
    error NotOwner();
    error RentalStillActive();
    error ExceedsMaxDays();
    error ZeroDays();
    error IncorrectPayment();
    error TransferFailed();

    /// @notice List an NFT for rent. Transfers NFT to this contract (escrow).
    function listForRent(address nftAddress, uint256 tokenId, uint256 pricePerDay, uint256 maxDays)
        external
        nonReentrant
    {
        if (pricePerDay == 0) revert ZeroPrice();
        if (maxDays == 0) revert ZeroMaxDays();
        if (IERC721(nftAddress).ownerOf(tokenId) != msg.sender) revert NotOwner();

        // escrow: NFT moves to this contract
        IERC721(nftAddress).transferFrom(msg.sender, address(this), tokenId);

        rentals[nftAddress][tokenId] = Rental({
            owner: msg.sender,
            pricePerDay: pricePerDay,
            maxDays: maxDays,
            renter: address(0),
            rentedUntil: 0
        });

        emit Listed(msg.sender, nftAddress, tokenId, pricePerDay, maxDays);
    }

    /// @notice Rent an NFT for `numDays` days. Must send exact payment.
    function rent(address nftAddress, uint256 tokenId, uint256 numDays) external payable nonReentrant {
        if (numDays == 0) revert ZeroDays();

        Rental storage r = rentals[nftAddress][tokenId];
        if (r.owner == address(0)) revert NotListed();
        if (_isActiveRental(r)) revert AlreadyRented();
        if (numDays > r.maxDays) revert ExceedsMaxDays();

        uint256 totalCost = r.pricePerDay * numDays;
        if (msg.value != totalCost) revert IncorrectPayment();

        // CEI: update state before transfer
        r.renter = msg.sender;
        r.rentedUntil = block.timestamp + (numDays * SECONDS_PER_DAY);

        (bool ok,) = r.owner.call{value: msg.value}("");
        if (!ok) revert TransferFailed();

        emit Rented(msg.sender, nftAddress, tokenId, numDays, msg.value);
    }

    /// @notice Owner reclaims NFT after rental expires (or if never rented).
    function reclaimNFT(address nftAddress, uint256 tokenId) external nonReentrant {
        Rental storage r = rentals[nftAddress][tokenId];
        if (r.owner != msg.sender) revert NotOwner();
        if (_isActiveRental(r)) revert RentalStillActive();

        delete rentals[nftAddress][tokenId];

        IERC721(nftAddress).transferFrom(address(this), msg.sender, tokenId);

        emit Reclaimed(msg.sender, nftAddress, tokenId);
    }

    /// @notice Owner cancels listing before any rental starts.
    function cancelListing(address nftAddress, uint256 tokenId) external nonReentrant {
        Rental storage r = rentals[nftAddress][tokenId];
        if (r.owner != msg.sender) revert NotOwner();
        if (_isActiveRental(r)) revert RentalStillActive();

        delete rentals[nftAddress][tokenId];

        IERC721(nftAddress).transferFrom(address(this), msg.sender, tokenId);

        emit ListingCancelled(msg.sender, nftAddress, tokenId);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    function isRented(address nftAddress, uint256 tokenId) external view returns (bool) {
        return _isActiveRental(rentals[nftAddress][tokenId]);
    }

    function _isActiveRental(Rental storage r) internal view returns (bool) {
        return r.renter != address(0) && block.timestamp < r.rentedUntil;
    }
}
