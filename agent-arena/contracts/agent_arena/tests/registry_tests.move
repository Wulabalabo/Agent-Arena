#[test_only]
module agent_arena::registry_tests {
    use agent_arena::registry;

    const OWNER: address = @0xA11CE;
    const OTHER_OWNER: address = @0xB0B;
    const WALLET: address = @0xC0FFEE;
    const E_AGENT_ALREADY_REGISTERED: u64 = 0;
    const E_OWNER_MISMATCH: u64 = 2;
    const E_WALLET_ALREADY_BOUND: u64 = 3;

    fun agent_id(): vector<u8> {
        b"agent_1"
    }

    fun metadata_hash(): vector<u8> {
        b"metadata_hash_1"
    }

    fun rotation_hash(): vector<u8> {
        b"rotation_hash_1"
    }

    #[test]
    fun test_init_for_testing_creates_registry_and_admin() {
        let ctx = &mut tx_context::dummy();
        let (_admin, registry) = registry::new_for_testing(ctx);

        assert!(registry::version(&registry) == 0, 0);
        registry::destroy_for_testing(registry);
        registry::destroy_admin_for_testing(_admin);
    }

    #[test]
    fun test_admin_can_register_agent_and_version_increments() {
        let ctx = &mut tx_context::dummy();
        let (admin, mut registry) = registry::new_for_testing(ctx);

        registry::register_agent(&admin, &mut registry, agent_id(), OWNER, metadata_hash(), ctx);

        assert!(registry::version(&registry) == 1, 0);
        assert!(registry::registered_owner(&registry, agent_id()) == OWNER, 0);
        registry::destroy_for_testing(registry);
        registry::destroy_admin_for_testing(admin);
    }

    #[test, expected_failure(abort_code = E_AGENT_ALREADY_REGISTERED, location = agent_arena::registry)]
    fun test_duplicate_register_agent_fails() {
        let ctx = &mut tx_context::dummy();
        let (admin, mut registry) = registry::new_for_testing(ctx);

        registry::register_agent(&admin, &mut registry, agent_id(), OWNER, metadata_hash(), ctx);
        registry::register_agent(&admin, &mut registry, agent_id(), OWNER, metadata_hash(), ctx);

        registry::destroy_for_testing(registry);
        registry::destroy_admin_for_testing(admin);
    }

    #[test, expected_failure(abort_code = E_OWNER_MISMATCH, location = agent_arena::registry)]
    fun test_wrong_owner_bind_trading_wallet_fails() {
        let ctx = &mut tx_context::dummy();
        let (admin, mut registry) = registry::new_for_testing(ctx);

        registry::register_agent(&admin, &mut registry, agent_id(), OWNER, metadata_hash(), ctx);
        registry::bind_trading_wallet(&admin, &mut registry, agent_id(), OTHER_OWNER, WALLET, ctx);

        registry::destroy_for_testing(registry);
        registry::destroy_admin_for_testing(admin);
    }

    #[test, expected_failure(abort_code = E_WALLET_ALREADY_BOUND, location = agent_arena::registry)]
    fun test_duplicate_bind_trading_wallet_fails() {
        let ctx = &mut tx_context::dummy();
        let (admin, mut registry) = registry::new_for_testing(ctx);

        registry::register_agent(&admin, &mut registry, agent_id(), OWNER, metadata_hash(), ctx);
        registry::bind_trading_wallet(&admin, &mut registry, agent_id(), OWNER, WALLET, ctx);
        registry::bind_trading_wallet(&admin, &mut registry, agent_id(), OWNER, WALLET, ctx);

        registry::destroy_for_testing(registry);
        registry::destroy_admin_for_testing(admin);
    }

    #[test, expected_failure(abort_code = E_OWNER_MISMATCH, location = agent_arena::registry)]
    fun test_wrong_owner_record_runtime_credential_rotation_fails() {
        let ctx = &mut tx_context::dummy();
        let (admin, mut registry) = registry::new_for_testing(ctx);

        registry::register_agent(&admin, &mut registry, agent_id(), OWNER, metadata_hash(), ctx);
        registry::record_runtime_credential_rotation(
            &admin,
            &mut registry,
            agent_id(),
            OTHER_OWNER,
            1,
            2,
            rotation_hash(),
            ctx
        );

        registry::destroy_for_testing(registry);
        registry::destroy_admin_for_testing(admin);
    }

    #[test]
    fun test_successful_writes_increment_version() {
        let ctx = &mut tx_context::dummy();
        let (admin, mut registry) = registry::new_for_testing(ctx);

        registry::register_agent(&admin, &mut registry, agent_id(), OWNER, metadata_hash(), ctx);
        registry::bind_trading_wallet(&admin, &mut registry, agent_id(), OWNER, WALLET, ctx);
        registry::record_runtime_credential_rotation(
            &admin,
            &mut registry,
            agent_id(),
            OWNER,
            1,
            2,
            rotation_hash(),
            ctx
        );

        assert!(registry::version(&registry) == 3, 0);
        registry::destroy_for_testing(registry);
        registry::destroy_admin_for_testing(admin);
    }
}
