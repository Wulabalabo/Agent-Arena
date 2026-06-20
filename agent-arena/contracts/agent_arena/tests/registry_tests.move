#[test_only]
module agent_arena::registry_tests {
    use agent_arena::registry;

    const OWNER: address = @0xA11CE;
    const OTHER_OWNER: address = @0xB0B;
    const WALLET: address = @0xC0FFEE;
    const E_AGENT_ALREADY_REGISTERED: u64 = 0;
    const E_OWNER_MISMATCH: u64 = 2;
    const E_INVALID_SIGNATURE: u64 = 5;
    const E_AUTHORIZATION_REPLAYED: u64 = 6;
    const E_SENDER_MISMATCH: u64 = 7;

    fun agent_id(): vector<u8> {
        b"agent_1"
    }

    fun metadata_hash(): vector<u8> {
        b"metadata_hash_1"
    }

    fun rotation_hash(): vector<u8> {
        b"rotation_hash_1"
    }

    fun register_nonce_1(): vector<u8> {
        b"register_nonce_1"
    }

    fun register_nonce_2(): vector<u8> {
        b"register_nonce_2"
    }

    fun rotation_nonce_1(): vector<u8> {
        b"rotation_nonce_1"
    }

    fun rotation_nonce_other_owner(): vector<u8> {
        b"rotation_nonce_other_owner"
    }

    fun ctx_with_sender(sender: address): tx_context::TxContext {
        tx_context::new(
            sender,
            x"3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532",
            0,
            0,
            0,
        )
    }

    fun owner_ctx(): tx_context::TxContext {
        ctx_with_sender(OWNER)
    }

    fun other_owner_ctx(): tx_context::TxContext {
        ctx_with_sender(OTHER_OWNER)
    }

    fun register_sig_1(): vector<u8> {
        vector[
            236, 183, 118, 157, 160, 230, 38, 57, 206, 178, 45, 19, 218, 202, 100, 214,
            251, 22, 226, 90, 140, 255, 133, 121, 142, 173, 105, 80, 156, 94, 7, 186,
            124, 67, 92, 107, 154, 229, 118, 117, 131, 74, 163, 49, 211, 162, 146, 16,
            209, 172, 139, 3, 59, 79, 99, 214, 9, 50, 242, 122, 217, 115, 234, 9
        ]
    }

    fun register_sig_2(): vector<u8> {
        vector[
            172, 66, 140, 46, 62, 229, 119, 39, 83, 136, 177, 163, 190, 122, 131, 255,
            103, 174, 8, 69, 185, 81, 244, 30, 128, 228, 82, 149, 177, 227, 114, 199,
            122, 66, 139, 165, 150, 148, 160, 115, 12, 211, 206, 228, 47, 193, 213, 80,
            50, 166, 36, 118, 188, 184, 187, 199, 174, 25, 47, 243, 192, 41, 234, 7
        ]
    }

    fun rotation_sig_1(): vector<u8> {
        vector[
            211, 254, 129, 121, 14, 163, 145, 162, 104, 209, 140, 35, 8, 163, 103, 7,
            101, 225, 239, 212, 129, 240, 90, 143, 36, 156, 29, 66, 219, 85, 137, 171,
            253, 204, 168, 131, 99, 14, 38, 206, 3, 10, 152, 130, 33, 23, 80, 83,
            226, 226, 44, 47, 234, 38, 241, 80, 214, 12, 201, 235, 3, 126, 74, 10
        ]
    }

    fun rotation_sig_other_owner(): vector<u8> {
        vector[
            148, 134, 67, 96, 99, 69, 16, 243, 92, 193, 71, 102, 61, 184, 22, 83,
            168, 147, 191, 12, 90, 140, 47, 128, 108, 137, 53, 187, 218, 135, 29, 209,
            166, 71, 140, 55, 90, 23, 245, 242, 144, 237, 179, 13, 32, 234, 14, 168,
            40, 83, 152, 65, 84, 1, 206, 194, 94, 196, 252, 123, 45, 131, 11, 8
        ]
    }

    fun invalid_sig(): vector<u8> {
        vector[
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        ]
    }

    #[test]
    fun test_init_for_testing_creates_registry() {
        let ctx = &mut tx_context::dummy();
        let registry = registry::new_for_testing(ctx);

        assert!(registry::version(&registry) == 0, 0);
        registry::destroy_for_testing(registry);
    }

    #[test]
    fun test_authorized_register_agent_binds_wallet_and_version_increments() {
        let ctx = &mut owner_ctx();
        let mut registry = registry::new_for_testing(ctx);

        registry::register_agent(
            &mut registry,
            agent_id(),
            OWNER,
            WALLET,
            metadata_hash(),
            register_nonce_1(),
            register_sig_1(),
            ctx
        );

        assert!(registry::version(&registry) == 2, 0);
        assert!(registry::registered_owner(&registry, agent_id()) == OWNER, 0);
        registry::destroy_for_testing(registry);
    }

    #[test, expected_failure(abort_code = E_AGENT_ALREADY_REGISTERED, location = agent_arena::registry)]
    fun test_duplicate_register_agent_fails() {
        let ctx = &mut owner_ctx();
        let mut registry = registry::new_for_testing(ctx);

        registry::register_agent(
            &mut registry,
            agent_id(),
            OWNER,
            WALLET,
            metadata_hash(),
            register_nonce_1(),
            register_sig_1(),
            ctx
        );
        registry::register_agent(
            &mut registry,
            agent_id(),
            OWNER,
            WALLET,
            metadata_hash(),
            register_nonce_2(),
            register_sig_2(),
            ctx
        );

        registry::destroy_for_testing(registry);
    }

    #[test, expected_failure(abort_code = E_AUTHORIZATION_REPLAYED, location = agent_arena::registry)]
    fun test_replayed_authorization_fails() {
        let ctx = &mut owner_ctx();
        let mut registry = registry::new_for_testing(ctx);

        registry::register_agent(
            &mut registry,
            agent_id(),
            OWNER,
            WALLET,
            metadata_hash(),
            register_nonce_1(),
            register_sig_1(),
            ctx
        );
        registry::register_agent(
            &mut registry,
            agent_id(),
            OWNER,
            WALLET,
            metadata_hash(),
            register_nonce_1(),
            register_sig_1(),
            ctx
        );

        registry::destroy_for_testing(registry);
    }

    #[test, expected_failure(abort_code = E_INVALID_SIGNATURE, location = agent_arena::registry)]
    fun test_invalid_register_signature_fails() {
        let ctx = &mut owner_ctx();
        let mut registry = registry::new_for_testing(ctx);

        registry::register_agent(
            &mut registry,
            agent_id(),
            OWNER,
            WALLET,
            metadata_hash(),
            register_nonce_1(),
            invalid_sig(),
            ctx
        );

        registry::destroy_for_testing(registry);
    }

    #[test, expected_failure(abort_code = E_SENDER_MISMATCH, location = agent_arena::registry)]
    fun test_register_agent_requires_owner_sender() {
        let ctx = &mut tx_context::dummy();
        let mut registry = registry::new_for_testing(ctx);

        registry::register_agent(
            &mut registry,
            agent_id(),
            OWNER,
            WALLET,
            metadata_hash(),
            register_nonce_1(),
            register_sig_1(),
            ctx
        );

        registry::destroy_for_testing(registry);
    }

    #[test, expected_failure(abort_code = E_OWNER_MISMATCH, location = agent_arena::registry)]
    fun test_wrong_owner_record_runtime_credential_rotation_fails() {
        let ctx = &mut owner_ctx();
        let mut registry = registry::new_for_testing(ctx);

        registry::register_agent(
            &mut registry,
            agent_id(),
            OWNER,
            WALLET,
            metadata_hash(),
            register_nonce_1(),
            register_sig_1(),
            ctx
        );
        let other_ctx = &mut other_owner_ctx();
        registry::record_runtime_credential_rotation(
            &mut registry,
            agent_id(),
            OTHER_OWNER,
            1,
            2,
            rotation_hash(),
            rotation_nonce_other_owner(),
            rotation_sig_other_owner(),
            other_ctx
        );

        registry::destroy_for_testing(registry);
    }

    #[test, expected_failure(abort_code = E_SENDER_MISMATCH, location = agent_arena::registry)]
    fun test_rotation_requires_owner_sender() {
        let ctx = &mut tx_context::dummy();
        let mut registry = registry::new_for_testing(ctx);

        registry::record_runtime_credential_rotation(
            &mut registry,
            agent_id(),
            OWNER,
            1,
            2,
            rotation_hash(),
            rotation_nonce_1(),
            rotation_sig_1(),
            ctx
        );

        registry::destroy_for_testing(registry);
    }

    #[test]
    fun test_successful_writes_increment_version() {
        let ctx = &mut owner_ctx();
        let mut registry = registry::new_for_testing(ctx);

        registry::register_agent(
            &mut registry,
            agent_id(),
            OWNER,
            WALLET,
            metadata_hash(),
            register_nonce_1(),
            register_sig_1(),
            ctx
        );
        registry::record_runtime_credential_rotation(
            &mut registry,
            agent_id(),
            OWNER,
            1,
            2,
            rotation_hash(),
            rotation_nonce_1(),
            rotation_sig_1(),
            ctx
        );

        assert!(registry::version(&registry) == 3, 0);
        registry::destroy_for_testing(registry);
    }
}
