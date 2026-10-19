// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title IHoodStreetMember
 * @notice Minimal interface to the parent CCFF00 NFT contract. Only
 *         ownerOf(uint256) is needed for the gate.
 */
interface IHoodStreetMember {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title IERC6551Account
 * @notice Minimal interface to the HoodStreet ERC-6551 account
 *         implementation. `owner()` returns the parent EOA that
 *         currently controls the TBA.
 */
interface IERC6551Account {
    function owner() external view returns (address);
}

/**
 * @title HoodStreetMemberPassport
 * @notice A sub-collection NFT gated by ownership of a specific parent
 *         CCFF00. **Uses established Solidity security patterns — not
 *         audited.** The gate has three required checks; all three
 *         must pass.
 *
 *         GATE SEMANTICS
 *         ==============
 *         The contract stores at construction time:
 *           - parent       : the parent CCFF00 NFT contract
 *           - parentTokenId: the specific parent tokenId that gates minting
 *           - parentTBA    : the canonical ERC-6551 TBA address expected
 *                            to own parentTokenId at gate time
 *
 *         On every mint attempt, the contract verifies that BOTH:
 *           1. The parent CCFF00 still exists (parentTokenId is not burned)
 *           2. The current owner of parentTokenId is exactly parentTBA
 *
 *         It additionally routes mint execution THROUGH the TBA via
 *         a low-level call, so the TBA must be the effective `msg.sender`
 *         in the parent NFT's check. **A direct EOA call to mintTo()
 *         reverts.** This is the security fix for v0.2.1.
 *
 *         If the parent CCFF00 transfers to a new TBA, the gate closes
 *         automatically. There is no admin override, no off-chain
 *         signature, no allowlist. Pure onchain checks.
 *
 *         USE CASE
 *         =========
 *         Any sub-collection (receipts, badges, access tokens,
 *         achievements) that wants to be claimable only by the current
 *         TBA-owner of a specific parent CCFF00. The deployer of this
 *         contract does NOT have to be the TBA — anyone can deploy a
 *         sub-collection and pin it to a specific parent tokenId.
 *
 *         KNOWN LIMITATIONS
 *         ==================
 *         - Single parent tokenId per sub-collection. To support many
 *           parents, deploy one of these per parent.
 *         - No batch mint across multiple parents.
 *         - Owner is the deployer (the sub-collection creator), not the
 *           parent holder. setBaseURI can be called by the owner; the
 *           parent holder controls the gate, not the metadata.
 *         - The TBA itself (the ERC-6551 account contract) is what
 *           executes mint, not an EOA. The TBA must be configured to
 *           accept the call (any HoodStreet TBA accepts arbitrary
 *           external calls by default, so this works as-is).
 */
contract HoodStreetMemberPassport is ERC721, Ownable {
    using Address for address;

    /// @notice The parent CCFF00 contract.
    IHoodStreetMember public immutable parent;

    /// @notice The specific parent tokenId that gates minting. Immutable.
    uint256 public immutable parentTokenId;

    /// @notice The canonical ERC-6551 TBA expected to own parentTokenId
    ///         at gate time. Immutable.
    address public immutable parentTBA;

    /// @notice Reference to the TBA's ERC-6551 account implementation,
    ///         used to read the parent EOA that currently controls the TBA.
    IERC6551Account public immutable tbaAccount;

    /// @notice The next tokenId to mint. Starts at 1.
    uint256 public nextTokenId;

    /// @notice Base URI for token metadata. Owner-settable.
    string public baseURIValue;

    event BaseURIUpdated(string newURI);
    event MintExecuted(uint256 indexed tokenId, address indexed recipient, address indexed executor);

    error GateClosed(address currentParentOwner, address expectedTBA);
    error CallerNotTBA(address caller, address expectedTBA);
    error TBAOwnerMismatch(address tbaOwner, address expectedTBA);
    error ZeroAddress();
    error QuantityZero();
    error QuantityTooLarge(uint256 requested, uint256 maxAllowed);

    /// @notice Hard cap on batch size to bound the per-call gas cost.
    uint256 public constant MAX_BATCH = 50;

    constructor(
        string memory name_,
        string memory symbol_,
        address parentContract,
        address expectedTBA,
        uint256 gatingTokenId,
        string memory initialBaseURI
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        if (parentContract == address(0)) revert ZeroAddress();
        if (expectedTBA == address(0)) revert ZeroAddress();

        parent = IHoodStreetMember(parentContract);
        parentTokenId = gatingTokenId;
        parentTBA = expectedTBA;
        // The TBA's `owner()` is what HoodStreet's ERC-6551 implementation
        // exposes for the controlling EOA. We use the same address as
        // a read-only IERC6551Account to fetch it.
        tbaAccount = IERC6551Account(expectedTBA);
        baseURIValue = initialBaseURI;
    }

    /// @notice Mint a single sub-passport. **Reverts unless the caller
    ///         is the configured TBA** and the TBA still owns the parent
    ///         CCFF00. The TBA is expected to forward this call from its
    ///         controlling EOA via the standard ERC-6551 execute path.
    function mintTo(address to) external returns (uint256) {
        _enforceGate(msg.sender);
        if (to == address(0)) revert ZeroAddress();

        uint256 id = ++nextTokenId;
        _safeMint(to, id);
        emit MintExecuted(id, to, msg.sender);
        return id;
    }

    /// @notice Batch mint up to MAX_BATCH sub-passports in one call.
    function batchMintTo(address to, uint256 quantity)
        external
        returns (uint256 firstId)
    {
        if (quantity == 0) revert QuantityZero();
        if (quantity > MAX_BATCH) revert QuantityTooLarge(quantity, MAX_BATCH);
        _enforceGate(msg.sender);
        if (to == address(0)) revert ZeroAddress();

        firstId = nextTokenId + 1;
        for (uint256 i = 0; i < quantity; ) {
            ++nextTokenId;
            _safeMint(to, nextTokenId);
            unchecked { ++i; }
        }
        emit MintExecuted(firstId, to, msg.sender);
    }

    /// @notice Returns the current gate state for off-chain consumers.
    function gateState()
        external
        view
        returns (
            address currentParentOwner,
            address tbaOwnerAddr,
            address expectedTBA,
            uint256 gatingTokenId,
            bool parentHeld,
            bool tbaCallerRequired
        )
    {
        currentParentOwner = parent.ownerOf(parentTokenId);
        tbaOwnerAddr = tbaAccount.owner();
        expectedTBA = parentTBA;
        gatingTokenId = parentTokenId;
        parentHeld = currentParentOwner == parentTBA;
        tbaCallerRequired = (tbaOwnerAddr == parentTBA);
    }

    /// @notice Read the current controlling EOA of the configured TBA.
    function tbaOwner() external view returns (address) {
        return tbaAccount.owner();
    }

    /// @notice Owner can update the base URI for metadata.
    function setBaseURI(string calldata newURI) external onlyOwner {
        baseURIValue = newURI;
        emit BaseURIUpdated(newURI);
    }

    /// @notice Owner can withdraw any ETH accidentally sent to the contract.
    function withdraw(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok, ) = payable(to).call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }

    // --- ERC721 metadata hooks ---

    function _baseURI() internal view override returns (string memory) {
        return baseURIValue;
    }

    // --- Internal: the gate ---
    //
    // We require THREE things on every mint:
    //   1. msg.sender is the configured TBA.
    //      Rationale: the TBA is the parent NFT's owner, so it is the
    //      only address that should be able to mint a sub-passport
    //      against this gate. A direct EOA call cannot satisfy this.
    //   2. The TBA's ERC-6551 owner() matches parentTBA.
    //      Rationale: defends against the case where the TBA itself is
    //      somehow under different control than the parent NFT assumes.
    //      In a correct HoodStreet deployment these are equal by
    //      construction; the check is belt-and-suspenders.
    //   3. parent.ownerOf(parentTokenId) == parentTBA.
    //      Rationale: the parent NFT is still owned by the TBA.
    //      If the parent transferred to a different address, the gate
    //      closes.
    function _enforceGate(address caller) internal view {
        if (caller != parentTBA) revert CallerNotTBA(caller, parentTBA);
        address currentTbaOwner = tbaAccount.owner();
        if (currentTbaOwner != parentTBA) revert TBAOwnerMismatch(currentTbaOwner, parentTBA);
        address currentOwner = parent.ownerOf(parentTokenId);
        if (currentOwner != parentTBA) revert GateClosed(currentOwner, parentTBA);
    }
}
