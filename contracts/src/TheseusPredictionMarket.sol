// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title TheseusPredictionMarket
/// @notice Real on-chain trading for Theseus Predict. One contract holds many
///         binary (YES/NO) markets, collateralized in a single ERC-20 (eUSDC on
///         Base Sepolia). Pricing is the proven Gnosis Fixed-Product Market
///         Maker (FPMM) rule: each unit of collateral mints one YES and one NO,
///         and a buy swaps the unwanted side through a constant-product pool, so
///         YES + NO is always worth exactly 1 collateral. The agent (owner) is
///         the only address that can open and resolve markets; resolution is the
///         Theseus adjudicator's verdict, written here. Winning shares redeem
///         1 collateral each.
///
/// @dev    Decisions (which markets exist, what they resolve to) come from
///         agents on Theseus; the money lives here on an EVM testnet. This is a
///         testnet demo contract: validate with `forge test` before any real use.
contract TheseusPredictionMarket {
    using SafeERC20 for IERC20;

    enum Outcome { YES, NO }

    struct Market {
        uint256 reserveYes; // FPMM pool reserve of YES shares
        uint256 reserveNo;  // FPMM pool reserve of NO shares
        uint256 collateral; // eUSDC held backing this market
        bool open;
        bool resolved;
        Outcome winner;
    }

    IERC20 public immutable usdc;
    address public immutable agent; // sole writer: opens + resolves markets

    mapping(uint256 => Market) public markets;
    // marketId => trader => outcome => shares held
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public shares;

    event MarketOpened(uint256 indexed id, uint256 seed);
    event Bought(uint256 indexed id, address indexed trader, Outcome outcome, uint256 amountIn, uint256 sharesOut);
    event Resolved(uint256 indexed id, Outcome winner);
    event Redeemed(uint256 indexed id, address indexed trader, uint256 payout);

    error NotAgent();
    error MarketClosed();
    error MarketExists();
    error NotResolved();
    error Slippage();
    error ZeroAmount();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(IERC20 _usdc, address _agent) {
        usdc = _usdc;
        agent = _agent;
    }

    /// @notice Open a market, seeding it 50/50 with `seed` collateral. The agent
    ///         must have approved `seed` of usdc to this contract. Reserves start
    ///         equal (price 0.5); trading moves them from there.
    function openMarket(uint256 id, uint256 seed) external onlyAgent {
        if (markets[id].open) revert MarketExists();
        if (seed == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), seed);
        markets[id] = Market({ reserveYes: seed, reserveNo: seed, collateral: seed, open: true, resolved: false, winner: Outcome.YES });
        emit MarketOpened(id, seed);
    }

    /// @notice Buy `outcome` shares with `amountIn` collateral. FPMM: add
    ///         amountIn to both reserves, then hand the buyer the swapped-out
    ///         shares of the chosen side, preserving the constant product.
    function buy(uint256 id, Outcome outcome, uint256 amountIn, uint256 minSharesOut) external returns (uint256 sharesOut) {
        Market storage m = markets[id];
        if (!m.open || m.resolved) revert MarketClosed();
        if (amountIn == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amountIn);

        if (outcome == Outcome.YES) {
            uint256 endingYes = (m.reserveYes * m.reserveNo) / (m.reserveNo + amountIn);
            sharesOut = m.reserveYes + amountIn - endingYes;
            m.reserveYes = endingYes;
            m.reserveNo += amountIn;
        } else {
            uint256 endingNo = (m.reserveYes * m.reserveNo) / (m.reserveYes + amountIn);
            sharesOut = m.reserveNo + amountIn - endingNo;
            m.reserveNo = endingNo;
            m.reserveYes += amountIn;
        }
        if (sharesOut < minSharesOut) revert Slippage();
        m.collateral += amountIn;
        shares[id][msg.sender][uint8(outcome)] += sharesOut;
        emit Bought(id, msg.sender, outcome, amountIn, sharesOut);
    }

    /// @notice Record the agent's verdict. Trading stops.
    function resolve(uint256 id, Outcome winner) external onlyAgent {
        Market storage m = markets[id];
        if (!m.open || m.resolved) revert MarketClosed();
        m.resolved = true;
        m.winner = winner;
        emit Resolved(id, winner);
    }

    /// @notice After resolution, redeem your winning shares for 1 collateral each.
    function redeem(uint256 id) external returns (uint256 payout) {
        Market storage m = markets[id];
        if (!m.resolved) revert NotResolved();
        uint8 w = uint8(m.winner);
        payout = shares[id][msg.sender][w];
        if (payout == 0) revert ZeroAmount();
        shares[id][msg.sender][w] = 0;
        m.collateral -= payout;
        usdc.safeTransfer(msg.sender, payout);
        emit Redeemed(id, msg.sender, payout);
    }

    // ---- views ----

    /// @notice Implied YES probability, scaled to 1e18.
    function priceYes(uint256 id) external view returns (uint256) {
        Market storage m = markets[id];
        uint256 total = m.reserveYes + m.reserveNo;
        if (total == 0) return 5e17;
        return (m.reserveNo * 1e18) / total;
    }

    function sharesOf(uint256 id, address trader) external view returns (uint256 yes, uint256 no) {
        yes = shares[id][trader][uint8(Outcome.YES)];
        no = shares[id][trader][uint8(Outcome.NO)];
    }
}
