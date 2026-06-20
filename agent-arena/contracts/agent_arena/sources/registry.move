module agent_arena::registry;

use sui::event;
use sui::table::{Self, Table};

const E_AGENT_ALREADY_REGISTERED: u64 = 0;
const E_AGENT_NOT_REGISTERED: u64 = 1;
const E_OWNER_MISMATCH: u64 = 2;
const E_WALLET_ALREADY_BOUND: u64 = 3;
const E_INVALID_VERSION: u64 = 4;

public struct AdminCap has key, store {
    id: UID,
}

public struct Registry has key {
    id: UID,
    version: u64,
    registered_agents: Table<vector<u8>, address>,
    bound_wallets: Table<vector<u8>, address>,
}

public struct AgentRegistered has copy, drop {
    agent_id: vector<u8>,
    owner: address,
    metadata_hash: vector<u8>,
    version: u64,
}

public struct TradingWalletBound has copy, drop {
    agent_id: vector<u8>,
    owner: address,
    wallet: address,
    version: u64,
}

public struct RuntimeCredentialRotated has copy, drop {
    agent_id: vector<u8>,
    owner: address,
    previous_version: u64,
    next_version: u64,
    rotation_hash: vector<u8>,
    version: u64,
}

fun init(ctx: &mut TxContext) {
    let registry = new_registry(ctx);
    let admin = AdminCap { id: object::new(ctx) };

    transfer::share_object(registry);
    transfer::transfer(admin, ctx.sender());
}

public fun version(registry: &Registry): u64 {
    registry.version
}

public fun registered_owner(registry: &Registry, agent_id: vector<u8>): address {
    assert!(table::contains(&registry.registered_agents, agent_id), E_AGENT_NOT_REGISTERED);
    *table::borrow(&registry.registered_agents, agent_id)
}

public fun register_agent(
    _admin: &AdminCap,
    registry: &mut Registry,
    agent_id: vector<u8>,
    owner: address,
    metadata_hash: vector<u8>,
    _ctx: &mut TxContext,
) {
    assert!(!table::contains(&registry.registered_agents, agent_id), E_AGENT_ALREADY_REGISTERED);

    registry.version = registry.version + 1;
    table::add(&mut registry.registered_agents, agent_id, owner);
    event::emit(AgentRegistered {
        agent_id,
        owner,
        metadata_hash,
        version: registry.version,
    });
}

public fun bind_trading_wallet(
    _admin: &AdminCap,
    registry: &mut Registry,
    agent_id: vector<u8>,
    owner: address,
    wallet: address,
    _ctx: &mut TxContext,
) {
    assert!(table::contains(&registry.registered_agents, agent_id), E_AGENT_NOT_REGISTERED);
    assert!(*table::borrow(&registry.registered_agents, agent_id) == owner, E_OWNER_MISMATCH);
    assert!(!table::contains(&registry.bound_wallets, agent_id), E_WALLET_ALREADY_BOUND);

    registry.version = registry.version + 1;
    table::add(&mut registry.bound_wallets, agent_id, wallet);
    event::emit(TradingWalletBound {
        agent_id,
        owner,
        wallet,
        version: registry.version,
    });
}

public fun record_runtime_credential_rotation(
    _admin: &AdminCap,
    registry: &mut Registry,
    agent_id: vector<u8>,
    owner: address,
    previous_version: u64,
    next_version: u64,
    rotation_hash: vector<u8>,
    _ctx: &mut TxContext,
) {
    assert!(table::contains(&registry.registered_agents, agent_id), E_AGENT_NOT_REGISTERED);
    assert!(*table::borrow(&registry.registered_agents, agent_id) == owner, E_OWNER_MISMATCH);
    assert!(next_version == previous_version + 1, E_INVALID_VERSION);

    registry.version = registry.version + 1;
    event::emit(RuntimeCredentialRotated {
        agent_id,
        owner,
        previous_version,
        next_version,
        rotation_hash,
        version: registry.version,
    });
}

fun new_registry(ctx: &mut TxContext): Registry {
    Registry {
        id: object::new(ctx),
        version: 0,
        registered_agents: table::new<vector<u8>, address>(ctx),
        bound_wallets: table::new<vector<u8>, address>(ctx),
    }
}

#[test_only]
public fun new_for_testing(ctx: &mut TxContext): (AdminCap, Registry) {
    (AdminCap { id: object::new(ctx) }, new_registry(ctx))
}

#[test_only]
public fun destroy_for_testing(registry: Registry) {
    let Registry { id, version: _, registered_agents, bound_wallets } = registry;
    table::drop(registered_agents);
    table::drop(bound_wallets);
    id.delete();
}

#[test_only]
public fun destroy_admin_for_testing(admin: AdminCap) {
    let AdminCap { id } = admin;
    id.delete();
}
