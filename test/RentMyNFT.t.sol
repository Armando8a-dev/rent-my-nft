// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/RentMyNFT.sol";
import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

/// @dev Minimal ERC721 for testing
contract MockNFT is ERC721 {
    constructor() ERC721("MockNFT", "MNFT") {}
    function mint(address to, uint256 tokenId) external { _mint(to, tokenId); }
}

contract RentMyNFTTest is Test {
    RentMyNFT public market;
    MockNFT public nft;

    address owner = address(0x1);
    address renter = address(0x2);
    address stranger = address(0x3);

    uint256 constant TOKEN_ID = 0;
    uint256 constant PRICE_PER_DAY = 0.01 ether;
    uint256 constant MAX_DAYS = 7;

    function setUp() public {
        market = new RentMyNFT();
        nft = new MockNFT();

        nft.mint(owner, TOKEN_ID);
        vm.deal(renter, 10 ether);
        vm.deal(stranger, 10 ether);

        vm.prank(owner);
        nft.approve(address(market), TOKEN_ID);
    }

    // ─── listForRent ──────────────────────────────────────────────────────────

    function test_list_transfersNFTToEscrow() public {
        vm.prank(owner);
        market.listForRent(address(nft), TOKEN_ID, PRICE_PER_DAY, MAX_DAYS);

        assertEq(nft.ownerOf(TOKEN_ID), address(market));
    }

    function test_list_storesRentalData() public {
        vm.prank(owner);
        market.listForRent(address(nft), TOKEN_ID, PRICE_PER_DAY, MAX_DAYS);

        (address _owner, uint256 ppd, uint256 md,,) = market.rentals(address(nft), TOKEN_ID);
        assertEq(_owner, owner);
        assertEq(ppd, PRICE_PER_DAY);
        assertEq(md, MAX_DAYS);
    }

    function test_list_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit RentMyNFT.Listed(owner, address(nft), TOKEN_ID, PRICE_PER_DAY, MAX_DAYS);

        vm.prank(owner);
        market.listForRent(address(nft), TOKEN_ID, PRICE_PER_DAY, MAX_DAYS);
    }

    function test_list_revertsIfNotNFTOwner() public {
        vm.prank(stranger);
        vm.expectRevert(RentMyNFT.NotOwner.selector);
        market.listForRent(address(nft), TOKEN_ID, PRICE_PER_DAY, MAX_DAYS);
    }

    function test_list_revertsIfZeroPrice() public {
        vm.prank(owner);
        vm.expectRevert(RentMyNFT.ZeroPrice.selector);
        market.listForRent(address(nft), TOKEN_ID, 0, MAX_DAYS);
    }

    function test_list_revertsIfZeroMaxDays() public {
        vm.prank(owner);
        vm.expectRevert(RentMyNFT.ZeroMaxDays.selector);
        market.listForRent(address(nft), TOKEN_ID, PRICE_PER_DAY, 0);
    }

    // ─── rent ─────────────────────────────────────────────────────────────────

    function _list() internal {
        vm.prank(owner);
        market.listForRent(address(nft), TOKEN_ID, PRICE_PER_DAY, MAX_DAYS);
    }

    function test_rent_recordsRenterAndExpiry() public {
        _list();

        vm.prank(renter);
        market.rent{value: PRICE_PER_DAY * 3}(address(nft), TOKEN_ID, 3);

        (,,, address _renter, uint256 rentedUntil) = market.rentals(address(nft), TOKEN_ID);
        assertEq(_renter, renter);
        assertEq(rentedUntil, block.timestamp + 3 * 86_400);
    }

    function test_rent_paysOwner() public {
        _list();
        uint256 ownerBefore = owner.balance;

        vm.prank(renter);
        market.rent{value: PRICE_PER_DAY * 2}(address(nft), TOKEN_ID, 2);

        assertEq(owner.balance, ownerBefore + PRICE_PER_DAY * 2);
    }

    function test_rent_emitsEvent() public {
        _list();

        vm.expectEmit(true, true, true, true);
        emit RentMyNFT.Rented(renter, address(nft), TOKEN_ID, 3, PRICE_PER_DAY * 3); // numDays=3

        vm.prank(renter);
        market.rent{value: PRICE_PER_DAY * 3}(address(nft), TOKEN_ID, 3);
    }

    function test_rent_revertsIfNotListed() public {
        vm.prank(renter);
        vm.expectRevert(RentMyNFT.NotListed.selector);
        market.rent{value: PRICE_PER_DAY}(address(nft), TOKEN_ID, 1);
    }

    function test_rent_revertsIfAlreadyRented() public {
        _list();
        vm.prank(renter);
        market.rent{value: PRICE_PER_DAY}(address(nft), TOKEN_ID, 1);

        vm.prank(stranger);
        vm.expectRevert(RentMyNFT.AlreadyRented.selector);
        market.rent{value: PRICE_PER_DAY}(address(nft), TOKEN_ID, 1);
    }

    function test_rent_revertsIfExceedsMaxDays() public {
        _list();
        vm.prank(renter);
        vm.expectRevert(RentMyNFT.ExceedsMaxDays.selector);
        market.rent{value: PRICE_PER_DAY * (MAX_DAYS + 1)}(address(nft), TOKEN_ID, MAX_DAYS + 1);
    }

    function test_rent_revertsIfIncorrectPayment() public {
        _list();
        vm.prank(renter);
        vm.expectRevert(RentMyNFT.IncorrectPayment.selector);
        market.rent{value: PRICE_PER_DAY * 2}(address(nft), TOKEN_ID, 3);
    }

    function test_rent_revertsIfZeroDays() public {
        _list();
        vm.prank(renter);
        vm.expectRevert(RentMyNFT.ZeroDays.selector);
        market.rent{value: 0}(address(nft), TOKEN_ID, 0);
    }

    // ─── isRented ─────────────────────────────────────────────────────────────

    function test_isRented_trueWhileActive() public {
        _list();
        vm.prank(renter);
        market.rent{value: PRICE_PER_DAY}(address(nft), TOKEN_ID, 1);

        assertTrue(market.isRented(address(nft), TOKEN_ID));
    }

    function test_isRented_falseAfterExpiry() public {
        _list();
        vm.prank(renter);
        market.rent{value: PRICE_PER_DAY}(address(nft), TOKEN_ID, 1);

        vm.warp(block.timestamp + 2 days);

        assertFalse(market.isRented(address(nft), TOKEN_ID));
    }

    // ─── reclaimNFT ───────────────────────────────────────────────────────────

    function test_reclaim_returnsNFTAfterExpiry() public {
        _list();
        vm.prank(renter);
        market.rent{value: PRICE_PER_DAY}(address(nft), TOKEN_ID, 1);

        vm.warp(block.timestamp + 2 days);

        vm.prank(owner);
        market.reclaimNFT(address(nft), TOKEN_ID);

        assertEq(nft.ownerOf(TOKEN_ID), owner);
    }

    function test_reclaim_clearsListing() public {
        _list();

        vm.prank(owner);
        market.reclaimNFT(address(nft), TOKEN_ID);

        (address _owner,,,,) = market.rentals(address(nft), TOKEN_ID);
        assertEq(_owner, address(0));
    }

    function test_reclaim_emitsEvent() public {
        _list();

        vm.expectEmit(true, true, true, false);
        emit RentMyNFT.Reclaimed(owner, address(nft), TOKEN_ID);

        vm.prank(owner);
        market.reclaimNFT(address(nft), TOKEN_ID);
    }

    function test_reclaim_revertsIfStillRented() public {
        _list();
        vm.prank(renter);
        market.rent{value: PRICE_PER_DAY}(address(nft), TOKEN_ID, 1);

        vm.prank(owner);
        vm.expectRevert(RentMyNFT.RentalStillActive.selector);
        market.reclaimNFT(address(nft), TOKEN_ID);
    }

    function test_reclaim_revertsIfNotOwner() public {
        _list();

        vm.prank(stranger);
        vm.expectRevert(RentMyNFT.NotOwner.selector);
        market.reclaimNFT(address(nft), TOKEN_ID);
    }

    // ─── cancelListing ────────────────────────────────────────────────────────

    function test_cancel_returnsNFTIfNeverRented() public {
        _list();

        vm.prank(owner);
        market.cancelListing(address(nft), TOKEN_ID);

        assertEq(nft.ownerOf(TOKEN_ID), owner);
    }

    function test_cancel_revertsIfCurrentlyRented() public {
        _list();
        vm.prank(renter);
        market.rent{value: PRICE_PER_DAY}(address(nft), TOKEN_ID, 1);

        vm.prank(owner);
        vm.expectRevert(RentMyNFT.RentalStillActive.selector);
        market.cancelListing(address(nft), TOKEN_ID);
    }

    function test_cancel_allowsReclaimAfterExpiry() public {
        _list();
        vm.prank(renter);
        market.rent{value: PRICE_PER_DAY}(address(nft), TOKEN_ID, 1);

        vm.warp(block.timestamp + 2 days);

        // after expiry, cancel (which also returns NFT)
        vm.prank(owner);
        market.cancelListing(address(nft), TOKEN_ID);

        assertEq(nft.ownerOf(TOKEN_ID), owner);
    }

    // ─── fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_rent_exactPaymentAlwaysSucceeds(uint256 numDays) public {
        numDays = bound(numDays, 1, MAX_DAYS);

        _list();

        uint256 cost = PRICE_PER_DAY * numDays;
        vm.deal(renter, cost);
        vm.prank(renter);
        market.rent{value: cost}(address(nft), TOKEN_ID, numDays);

        assertTrue(market.isRented(address(nft), TOKEN_ID));
    }
}
