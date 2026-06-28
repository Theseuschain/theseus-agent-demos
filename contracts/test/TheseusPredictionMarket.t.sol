// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "../src/TheseusPredictionMarket.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract TheseusPredictionMarketTest is Test {
    TheseusPredictionMarket internal pm;
    MockERC20 internal usdc;

    address internal agent = address(0xA9E47);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant ID = 5200;
    uint256 internal constant SEED = 2_000e6;

    function setUp() public {
        usdc = new MockERC20("Escrow USD (demo)", "eUSDC", 6);
        pm = new TheseusPredictionMarket(IERC20(address(usdc)), agent);

        usdc.mint(agent, SEED);
        vm.startPrank(agent);
        usdc.approve(address(pm), type(uint256).max);
        pm.openMarket(ID, SEED);
        vm.stopPrank();

        usdc.mint(alice, 10_000e6);
        usdc.mint(bob, 10_000e6);
        vm.prank(alice);
        usdc.approve(address(pm), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(pm), type(uint256).max);
    }

    function test_opensAtFiftyFifty() public view {
        assertEq(pm.priceYes(ID), 5e17);
    }

    function test_onlyAgentOpensAndResolves() public {
        vm.expectRevert(TheseusPredictionMarket.NotAgent.selector);
        vm.prank(alice);
        pm.openMarket(9999, SEED);

        vm.expectRevert(TheseusPredictionMarket.NotAgent.selector);
        vm.prank(alice);
        pm.resolve(ID, TheseusPredictionMarket.Outcome.YES);
    }

    function test_buyYesMovesPriceUp_andCostsCollateral() public {
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 got = pm.buy(ID, TheseusPredictionMarket.Outcome.YES, 1_000e6, 0);

        assertEq(before - usdc.balanceOf(alice), 1_000e6, "spent 1000");
        assertGt(got, 1_000e6, "YES shares cheaper than $1, so >1000 shares");
        assertGt(pm.priceYes(ID), 5e17, "YES price rose");
        (uint256 y, uint256 n) = pm.sharesOf(ID, alice);
        assertEq(y, got);
        assertEq(n, 0);
    }

    function test_buyNoMovesPriceDown() public {
        vm.prank(bob);
        pm.buy(ID, TheseusPredictionMarket.Outcome.NO, 1_000e6, 0);
        assertLt(pm.priceYes(ID), 5e17, "YES price fell after NO buy");
    }

    function test_slippageGuard() public {
        vm.expectRevert(TheseusPredictionMarket.Slippage.selector);
        vm.prank(alice);
        pm.buy(ID, TheseusPredictionMarket.Outcome.YES, 1_000e6, 100_000e6);
    }

    function test_resolveAndRedeem_winnerPaid_loserGetsNothing() public {
        vm.prank(alice);
        uint256 aliceYes = pm.buy(ID, TheseusPredictionMarket.Outcome.YES, 1_000e6, 0);
        vm.prank(bob);
        pm.buy(ID, TheseusPredictionMarket.Outcome.NO, 1_000e6, 0);

        vm.prank(agent);
        pm.resolve(ID, TheseusPredictionMarket.Outcome.YES);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 payout = pm.redeem(ID);
        assertEq(payout, aliceYes, "winning YES shares pay 1 each");
        assertEq(usdc.balanceOf(alice) - aliceBefore, aliceYes);

        // loser has no winning shares to redeem
        vm.expectRevert(TheseusPredictionMarket.ZeroAmount.selector);
        vm.prank(bob);
        pm.redeem(ID);
    }

    /// @notice The contract must always hold enough collateral to pay every
    ///         winning share, whichever side wins. (Solvency.)
    function test_solvent_eitherOutcome() public {
        vm.prank(alice);
        uint256 aliceYes = pm.buy(ID, TheseusPredictionMarket.Outcome.YES, 1_500e6, 0);
        vm.prank(bob);
        uint256 bobNo = pm.buy(ID, TheseusPredictionMarket.Outcome.NO, 800e6, 0);

        uint256 held = usdc.balanceOf(address(pm));
        assertGe(held, aliceYes, "solvent if YES wins");
        assertGe(held, bobNo, "solvent if NO wins");
    }
}
