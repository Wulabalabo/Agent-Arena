module agent_arena::registry;

use sui::bcs;
use sui::ed25519;
use sui::event;
use sui::hash;
use sui::table::{Self, Table};

const E_AGENT_ALREADY_REGISTERED: u64 = 0;
const E_AGENT_NOT_REGISTERED: u64 = 1;
const E_OWNER_MISMATCH: u64 = 2;
const E_WALLET_ALREADY_BOUND: u64 = 3;
const E_INVALID_VERSION: u64 = 4;
const E_INVALID_SIGNATURE: u64 = 5;
const E_AUTHORIZATION_REPLAYED: u64 = 6;

const AUTHORIZATION_DOMAIN: vector<u8> = vector[
    97, 103, 101, 110, 116, 45, 97, 114,
    101, 110, 97, 45, 114, 101, 103, 105,
    115, 116, 114, 121, 58, 118, 49, 58,
    116, 101, 115, 116, 110, 101, 116
];

const AUTHORITY_PK: vector<u8> = vector[
    228, 40, 134, 211, 184, 39, 184, 81,
    52, 36, 182, 96, 48, 13, 13, 251,
    251, 169, 141, 62, 58, 28, 177, 29,
    56, 44, 45, 71, 234, 252, 236, 237
];

public struct Registry has key {
    id: UID,
    version: u64,
    registered_agents: Table<vector<u8>, address>,
    bound_wallets: Table<vector<u8>, address>,
    consumed_authorizations: Table<vector<u8>, bool>,
}

public struct RegisterAgentAuthorization has drop {
    domain: vector<u8>,
    registry: ID,
    agent_id: vector<u8>,
    owner: address,
    wallet: address,
    metadata_hash: vector<u8>,
    nonce: vector<u8>,
}

public struct RuntimeCredentialRotationAuthorization has drop {
    domain: vector<u8>,
    registry: ID,
    agent_id: vector<u8>,
    owner: address,
    previous_version: u64,
    next_version: u64,
    rotation_hash: vector<u8>,
    nonce: vector<u8>,
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

    transfer::share_object(registry);
}

public fun version(registry: &Registry): u64 {
    registry.version
}

public fun registered_owner(registry: &Registry, agent_id: vector<u8>): address {
    assert!(table::contains(&registry.registered_agents, agent_id), E_AGENT_NOT_REGISTERED);
    *table::borrow(&registry.registered_agents, agent_id)
}

public fun register_agent(
    registry: &mut Registry,
    agent_id: vector<u8>,
    owner: address,
    wallet: address,
    metadata_hash: vector<u8>,
    nonce: vector<u8>,
    sig: vector<u8>,
    _ctx: &mut TxContext,
) {
    verify_register_agent_authorization(
        registry,
        agent_id,
        owner,
        wallet,
        metadata_hash,
        nonce,
        &sig,
    );
    assert!(!table::contains(&registry.registered_agents, agent_id), E_AGENT_ALREADY_REGISTERED);
    assert!(!table::contains(&registry.bound_wallets, agent_id), E_WALLET_ALREADY_BOUND);

    registry.version = registry.version + 1;
    table::add(&mut registry.registered_agents, agent_id, owner);
    event::emit(AgentRegistered {
        agent_id,
        owner,
        metadata_hash,
        version: registry.version,
    });

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
    registry: &mut Registry,
    agent_id: vector<u8>,
    owner: address,
    previous_version: u64,
    next_version: u64,
    rotation_hash: vector<u8>,
    nonce: vector<u8>,
    sig: vector<u8>,
    _ctx: &mut TxContext,
) {
    verify_runtime_credential_rotation_authorization(
        registry,
        agent_id,
        owner,
        previous_version,
        next_version,
        rotation_hash,
        nonce,
        &sig,
    );
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

fun verify_register_agent_authorization(
    registry: &mut Registry,
    agent_id: vector<u8>,
    owner: address,
    wallet: address,
    metadata_hash: vector<u8>,
    nonce: vector<u8>,
    sig: &vector<u8>,
) {
    let authorization = RegisterAgentAuthorization {
        domain: AUTHORIZATION_DOMAIN,
        registry: object::id(registry),
        agent_id,
        owner,
        wallet,
        metadata_hash,
        nonce,
    };
    verify_authorization(registry, authorization, sig);
}

fun verify_runtime_credential_rotation_authorization(
    registry: &mut Registry,
    agent_id: vector<u8>,
    owner: address,
    previous_version: u64,
    next_version: u64,
    rotation_hash: vector<u8>,
    nonce: vector<u8>,
    sig: &vector<u8>,
) {
    let authorization = RuntimeCredentialRotationAuthorization {
        domain: AUTHORIZATION_DOMAIN,
        registry: object::id(registry),
        agent_id,
        owner,
        previous_version,
        next_version,
        rotation_hash,
        nonce,
    };
    verify_authorization(registry, authorization, sig);
}

fun verify_authorization<Authorization: drop>(
    registry: &mut Registry,
    authorization: Authorization,
    sig: &vector<u8>,
) {
    let byte_data = bcs::to_bytes(&authorization);
    let authorization_hash = hash::keccak256(&byte_data);
    assert!(
        !table::contains(&registry.consumed_authorizations, authorization_hash),
        E_AUTHORIZATION_REPLAYED,
    );

    let pk = AUTHORITY_PK;
    let verify = ed25519::ed25519_verify(sig, &pk, &authorization_hash);
    assert!(verify == true, E_INVALID_SIGNATURE);

    table::add(&mut registry.consumed_authorizations, authorization_hash, true);
}

fun new_registry(ctx: &mut TxContext): Registry {
    Registry {
        id: object::new(ctx),
        version: 0,
        registered_agents: table::new<vector<u8>, address>(ctx),
        bound_wallets: table::new<vector<u8>, address>(ctx),
        consumed_authorizations: table::new<vector<u8>, bool>(ctx),
    }
}

#[test_only]
public fun new_for_testing(ctx: &mut TxContext): Registry {
    new_registry(ctx)
}

#[test_only]
public fun destroy_for_testing(registry: Registry) {
    let Registry { id, version: _, registered_agents, bound_wallets, consumed_authorizations } = registry;
    table::drop(registered_agents);
    table::drop(bound_wallets);
    table::drop(consumed_authorizations);
    id.delete();
}
