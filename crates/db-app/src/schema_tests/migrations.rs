use super::*;

#[tokio::test]
async fn schema_declares_legacy_migrations_and_cloudsync_registry() {
    let db = test_db().await;

    let tables: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .fetch_all(db.pool())
        .await
        .unwrap();

    assert!(tables.contains(&"_sqlx_migrations".to_string()));
    assert!(tables.contains(&"templates".to_string()));
    assert!(tables.contains(&"sessions".to_string()));
    assert!(tables.contains(&"migration_import_runs".to_string()));
}

#[tokio::test]
async fn legacy_mobile_schema_adopts_preexisting_alter_migrations() {
    let db = Db::connect_memory_plain().await.unwrap();
    sqlx::raw_sql(
        "CREATE TABLE sessions (id TEXT PRIMARY KEY NOT NULL);
         CREATE TABLE calendars (id TEXT PRIMARY KEY NOT NULL, deleted_at TEXT);
         CREATE TABLE events (id TEXT PRIMARY KEY NOT NULL, deleted_at TEXT);
         CREATE TABLE session_attachments (
            id TEXT PRIMARY KEY NOT NULL,
            cloud_sync_enabled INTEGER NOT NULL DEFAULT 0
         );
         PRAGMA user_version = 1;",
    )
    .execute(db.pool())
    .await
    .unwrap();

    adopt_legacy_mobile_schema_migration(db.pool())
        .await
        .unwrap();

    let (success, checksum): (bool, Vec<u8>) = sqlx::query_as(
        "SELECT success, checksum FROM _sqlx_migrations WHERE version = 20260711000000",
    )
    .fetch_one(db.pool())
    .await
    .unwrap();
    assert!(success);
    assert_eq!(
        checksum,
        migration_checksum(include_str!(
            "../../migrations/20260711000000_calendar_event_tombstones.sql"
        ))
    );

    let attachment_checksum: Vec<u8> =
        sqlx::query_scalar("SELECT checksum FROM _sqlx_migrations WHERE version = 20260717170000")
            .fetch_one(db.pool())
            .await
            .unwrap();
    assert_eq!(
        attachment_checksum,
        migration_checksum(include_str!(
            "../../migrations/20260717170000_attachment_cloud_sync_intent.sql"
        ))
    );
}

#[tokio::test]
async fn migrations_apply_cleanly() {
    let db = test_db().await;

    let tables: Vec<String> = sqlx::query_as::<_, (String,)>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .fetch_all(db.pool())
        .await
        .unwrap()
        .into_iter()
        .map(|r| r.0)
        .collect();

    assert_eq!(
        tables,
        vec![
            "_anlg_schema_compat",
            "_sqlx_migrations",
            "action_items",
            "app_settings",
            "attachment_local_state",
            "attachment_transfer_jobs",
            "calendars",
            "chat_groups",
            "chat_messages",
            "cloudsync_session_evictions",
            "cloudsync_writable_workspaces",
            "daily_notes",
            "dialext_account_edits",
            "dialext_accounts",
            "dialext_evidence",
            "dialext_recordings",
            "dialext_source_speakers",
            "dialext_speakers",
            "e2ee_apply_guard",
            "e2ee_ciphertext_archive",
            "e2ee_dirty_rows",
            "e2ee_field_conflicts",
            "e2ee_local_device",
            "e2ee_local_state",
            "e2ee_parked_records",
            "e2ee_records",
            "e2ee_replica_payload_hashes",
            "e2ee_replica_pending",
            "e2ee_witness_pending",
            "e2ee_witness_records",
            "e2ee_witness_repair_pending",
            "e2ee_witness_state",
            "enterprise_session_completion_outbox",
            "enterprise_session_delivery_receipts",
            "enterprise_session_delivery_state",
            "entity_mentions",
            "events",
            "folder_attachments",
            "folders",
            "humans",
            "migration_import_items",
            "migration_import_runs",
            "migration_import_targets",
            "organizations",
            "search_index_dirty",
            "search_index_state",
            "session_attachments",
            "session_disclosure_attempts",
            "session_document_versions",
            "session_documents",
            "session_participant_consent",
            "session_participants",
            "session_proposals",
            "session_share_activation",
            "session_share_sync_state",
            "session_tags",
            "sessions",
            "shared_session_attachment_cache",
            "shared_session_cache",
            "storage_migration_state",
            "synced_preferences",
            "tags",
            "templates",
            "transcript_live_deltas",
            "transcript_live_state",
            "transcripts",
            "voiceprint_candidates",
            "voiceprint_exemplars",
            "webhook_endpoints",
            "workspace_memberships",
            "workspaces",
        ]
    );
}

#[tokio::test]
async fn personal_workspace_migration_preserves_existing_session_workspace_ids() {
    let db = Db::connect_memory_plain().await.unwrap();
    anlg_db_migrate::migrate(
        &db,
        anlg_db_migrate::DbSchema {
            steps: migration_steps_before("20260716120000_personal_workspaces"),
            validate_cloudsync_table: cloudsync_alter_guard_required,
        },
    )
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO sessions (id, workspace_id, owner_user_id, title)
             VALUES ('session-1', 'user-1', 'user-1', 'Existing note')",
    )
    .execute(db.pool())
    .await
    .unwrap();

    anlg_db_migrate::migrate(&db, schema()).await.unwrap();
    sqlx::query(
        "INSERT INTO workspaces (id, owner_user_id, name)
             VALUES ('user-1', 'user-1', 'Personal')",
    )
    .execute(db.pool())
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO workspace_memberships (id, workspace_id, user_id, role)
             VALUES ('membership-1', 'user-1', 'user-1', 'owner')",
    )
    .execute(db.pool())
    .await
    .unwrap();

    let session_workspace_id: String =
        sqlx::query_scalar("SELECT workspace_id FROM sessions WHERE id = 'session-1'")
            .fetch_one(db.pool())
            .await
            .unwrap();
    let workspace: (String, String) =
        sqlx::query_as("SELECT id, kind FROM workspaces WHERE id = 'user-1'")
            .fetch_one(db.pool())
            .await
            .unwrap();
    let membership_role: String =
        sqlx::query_scalar("SELECT role FROM workspace_memberships WHERE id = 'membership-1'")
            .fetch_one(db.pool())
            .await
            .unwrap();

    assert_eq!(session_workspace_id, "user-1");
    assert_eq!(workspace, ("user-1".to_string(), "personal".to_string()));
    assert_eq!(membership_role, "owner");

    let duplicate = sqlx::query(
        "INSERT INTO workspace_memberships (id, workspace_id, user_id)
             VALUES ('membership-2', 'user-1', 'user-1')",
    )
    .execute(db.pool())
    .await;
    assert!(duplicate.is_err());
}

#[cfg(any(
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "macos", target_arch = "x86_64"),
    all(target_os = "linux", target_env = "gnu", target_arch = "aarch64"),
    all(target_os = "linux", target_env = "gnu", target_arch = "x86_64"),
    all(target_os = "linux", target_env = "musl", target_arch = "aarch64"),
    all(target_os = "linux", target_env = "musl", target_arch = "x86_64"),
    all(target_os = "windows", target_arch = "x86_64"),
))]
#[tokio::test]
async fn workspace_tables_can_be_initialized_by_cloudsync() {
    let db = Db::connect_memory().await.unwrap();
    prepare_schema(&db).await.unwrap();

    for table_name in ["workspaces", "workspace_memberships"] {
        db.cloudsync_init(table_name, None, None).await.unwrap();
        assert!(
            anlg_db_core::cloudsync_is_enabled_on(db.pool(), table_name)
                .await
                .unwrap()
        );
    }
}

#[cfg(any(
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "macos", target_arch = "x86_64"),
    all(target_os = "linux", target_env = "gnu", target_arch = "aarch64"),
    all(target_os = "linux", target_env = "gnu", target_arch = "x86_64"),
    all(target_os = "linux", target_env = "musl", target_arch = "aarch64"),
    all(target_os = "linux", target_env = "musl", target_arch = "x86_64"),
    all(target_os = "windows", target_arch = "x86_64"),
))]
#[tokio::test]
async fn search_index_migrations_apply_before_cloudsync_initialization() {
    let db = Db::connect_memory().await.unwrap();

    prepare_schema(&db).await.unwrap();

    let trigger_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'trigger' AND name LIKE 'search_index_%'",
    )
    .fetch_one(db.pool())
    .await
    .unwrap();
    assert_eq!(trigger_count, 15);

    initialize_enabled_cloudsync_tables(&db).await;

    sqlx::query("INSERT INTO sessions (id, title) VALUES ('session-1', 'Planning')")
        .execute(db.pool())
        .await
        .unwrap();
    let generation: i64 = sqlx::query_scalar(
        "SELECT generation FROM search_index_dirty
             WHERE entity_type = 'session' AND entity_id = 'session-1'",
    )
    .fetch_one(db.pool())
    .await
    .unwrap();
    assert_eq!(generation, 1);
}

#[cfg(any(
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "macos", target_arch = "x86_64"),
    all(target_os = "linux", target_env = "gnu", target_arch = "aarch64"),
    all(target_os = "linux", target_env = "gnu", target_arch = "x86_64"),
    all(target_os = "linux", target_env = "musl", target_arch = "aarch64"),
    all(target_os = "linux", target_env = "musl", target_arch = "x86_64"),
    all(target_os = "windows", target_arch = "x86_64"),
))]
#[tokio::test]
async fn search_index_migrations_apply_to_initialized_cloudsync_tables() {
    let db = Db::connect_memory().await.unwrap();
    anlg_db_migrate::migrate(
        &db,
        anlg_db_migrate::DbSchema {
            steps: migration_steps_before("20260714120000_search_index_queue"),
            validate_cloudsync_table: cloudsync_alter_guard_required,
        },
    )
    .await
    .unwrap();
    // Tables created after this point in the migration history cannot be
    // initialized here; their migrations run below.
    for table_name in E2EE_DOMAIN_TABLES
        .iter()
        .filter(|table_name| !matches!(**table_name, "synced_preferences" | "folders"))
    {
        db.cloudsync_init(table_name, None, None).await.unwrap();
    }

    prepare_schema(&db).await.unwrap();
    initialize_enabled_cloudsync_tables(&db).await;

    sqlx::query("INSERT INTO sessions (id, title) VALUES ('session-1', 'Planning')")
        .execute(db.pool())
        .await
        .unwrap();
    let generation: i64 = sqlx::query_scalar(
        "SELECT generation FROM search_index_dirty
             WHERE entity_type = 'session' AND entity_id = 'session-1'",
    )
    .fetch_one(db.pool())
    .await
    .unwrap();
    assert_eq!(generation, 1);

    for table in cloudsync_table_registry()
        .iter()
        .filter(|table| table.enabled)
    {
        assert!(
            anlg_db_core::cloudsync_is_enabled_on(db.pool(), &table.table_name)
                .await
                .unwrap()
        );
    }
}

#[tokio::test]
async fn migration_repairs_empty_titles_from_summary_headings() {
    let db = Db::connect_memory_plain().await.unwrap();
    anlg_db_migrate::migrate(
        &db,
        anlg_db_migrate::DbSchema {
            steps: migration_steps_before("20260713164500_repair_empty_session_titles"),
            validate_cloudsync_table: cloudsync_alter_guard_required,
        },
    )
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO sessions (id, title)
             VALUES ('json', ''), ('markdown', '   '), ('generic', ''), ('existing', 'Keep Me')",
    )
    .execute(db.pool())
    .await
    .unwrap();
    sqlx::query(
            "INSERT INTO session_documents
             (id, session_id, kind, body_format, body, sort_order)
             VALUES
             ('json-summary', 'json', 'summary', 'prosemirror_json',
              '{\"type\":\"doc\",\"content\":[{\"type\":\"heading\",\"attrs\":{\"level\":1},\"content\":[{\"type\":\"text\",\"text\":\"Transcript Test \"},{\"type\":\"text\",\"text\":\"Utterances\"}]}]}', 0),
             ('markdown-summary', 'markdown', 'summary', 'markdown',
              char(10) || '# Markdown Title' || char(10) || char(10) || 'Details', 0),
             ('generic-summary', 'generic', 'summary', 'markdown', '# Summary' || char(10) || 'Details', 0),
             ('existing-summary', 'existing', 'summary', 'markdown', '# Replacement' || char(10) || 'Details', 0)",
        )
        .execute(db.pool())
        .await
        .unwrap();

    anlg_db_migrate::migrate(&db, schema()).await.unwrap();

    let titles =
        sqlx::query_as::<_, (String, String)>("SELECT id, title FROM sessions ORDER BY id")
            .fetch_all(db.pool())
            .await
            .unwrap()
            .into_iter()
            .collect::<std::collections::HashMap<_, _>>();

    assert_eq!(titles["json"], "Transcript Test Utterances");
    assert_eq!(titles["markdown"], "Markdown Title");
    assert_eq!(titles["generic"], "");
    assert_eq!(titles["existing"], "Keep Me");
}

#[tokio::test]
async fn repair_migration_recreates_missing_templates_table() {
    let db = Db::connect_memory_plain().await.unwrap();
    anlg_db_migrate::migrate(
        &db,
        anlg_db_migrate::DbSchema {
            steps: &APP_MIGRATION_STEPS[..3],
            validate_cloudsync_table: cloudsync_alter_guard_required,
        },
    )
    .await
    .unwrap();

    sqlx::query("DROP TABLE templates")
        .execute(db.pool())
        .await
        .unwrap();

    anlg_db_migrate::migrate(&db, schema()).await.unwrap();

    let row_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM templates")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(row_count, 0);
}

#[tokio::test]
async fn prepare_schema_recreates_templates_after_repair_migration_was_already_applied() {
    let db = test_db().await;

    sqlx::query("DROP TABLE templates")
        .execute(db.pool())
        .await
        .unwrap();

    prepare_schema(&db).await.unwrap();

    let row_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM templates")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert!(row_count > 0);

    let icon_json: String =
        sqlx::query_scalar("SELECT icon_json FROM templates ORDER BY id LIMIT 1")
            .fetch_one(db.pool())
            .await
            .unwrap();
    assert_eq!(
        icon_json,
        r##"{"type":"icon","value":"notebook-tabs","color":"#9ca3af"}"##
    );
}

#[tokio::test]
async fn synced_preferences_backfill_reads_legacy_documents() {
    let db = Db::connect_memory_plain().await.unwrap();
    anlg_db_migrate::migrate(
        &db,
        anlg_db_migrate::DbSchema {
            steps: migration_steps_before("20260810120000_synced_preferences"),
            validate_cloudsync_table: cloudsync_alter_guard_required,
        },
    )
    .await
    .unwrap();

    sqlx::query(
        r#"INSERT INTO app_settings (id, value_json, updated_at) VALUES
             ('cloudsync_workspace_binding', '{"workspace_id":"ws-1"}', '2026-08-01T00:00:00.000Z'),
             ('theme', '"dark"', '2026-08-02T00:00:00.000Z'),
             ('legacy_settings_document',
              '{"general":{"theme":"light","app_icon":"classic"}}',
              '2026-08-03T00:00:00.000Z'),
             ('legacy_main_values_document',
              '{"app_icon":"shadowed","week_start":"monday"}',
              '2026-08-04T00:00:00.000Z')"#,
    )
    .execute(db.pool())
    .await
    .unwrap();

    anlg_db_migrate::migrate(&db, schema()).await.unwrap();

    let rows = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, workspace_id, value_json, updated_at FROM synced_preferences ORDER BY id",
    )
    .fetch_all(db.pool())
    .await
    .unwrap();

    assert_eq!(
        rows,
        vec![
            (
                "app_icon".to_string(),
                "ws-1".to_string(),
                "\"classic\"".to_string(),
                "2026-08-03T00:00:00.000Z".to_string(),
            ),
            (
                "theme".to_string(),
                "ws-1".to_string(),
                "\"dark\"".to_string(),
                "2026-08-02T00:00:00.000Z".to_string(),
            ),
            (
                "week_start".to_string(),
                "ws-1".to_string(),
                "\"monday\"".to_string(),
                "2026-08-04T00:00:00.000Z".to_string(),
            ),
        ],
        "direct rows win, then the settings document, then the main values document"
    );
}

#[tokio::test]
async fn prepare_schema_seeds_templates_when_repair_migration_creates_missing_table() {
    let db = Db::connect_memory_plain().await.unwrap();
    anlg_db_migrate::migrate(
        &db,
        anlg_db_migrate::DbSchema {
            steps: &APP_MIGRATION_STEPS[..3],
            validate_cloudsync_table: cloudsync_alter_guard_required,
        },
    )
    .await
    .unwrap();

    sqlx::query("DROP TABLE templates")
        .execute(db.pool())
        .await
        .unwrap();

    prepare_schema(&db).await.unwrap();

    let row_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM templates")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert!(row_count > 0);
}

#[tokio::test]
async fn enterprise_session_delivery_tables_are_registered() {
    let migration = APP_MIGRATION_STEPS
        .iter()
        .find(|step| step.id == "20260814090000_enterprise_session_delivery")
        .unwrap();
    assert_eq!(migration.scope, anlg_db_migrate::MigrationScope::Plain);

    let db = test_db().await;
    let tables: Vec<String> = sqlx::query_scalar(
        r#"SELECT name
           FROM sqlite_master
           WHERE type = 'table'
             AND name IN (
               'enterprise_session_delivery_state',
               'enterprise_session_delivery_receipts',
               'enterprise_session_completion_outbox'
             )
           ORDER BY name"#,
    )
    .fetch_all(db.pool())
    .await
    .unwrap();

    assert_eq!(
        tables,
        vec![
            "enterprise_session_completion_outbox",
            "enterprise_session_delivery_receipts",
            "enterprise_session_delivery_state",
        ]
    );
}

#[tokio::test]
async fn dialext_schema_upgrades_previous_database_without_changing_saved_prose() {
    let db = Db::connect_memory_plain().await.unwrap();
    let old = anlg_db_migrate::DbSchema {
        steps: migration_steps_before("20260917120000_dialext_accounts"),
        ..schema()
    };
    anlg_db_migrate::migrate(&db, old).await.unwrap();
    sqlx::query("INSERT INTO sessions(id) VALUES('saved')")
        .execute(db.pool())
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO transcripts(id,session_id,words_json) VALUES('saved-reading','saved','[1]')",
    )
    .execute(db.pool())
    .await
    .unwrap();
    prepare_schema(&db).await.unwrap();
    let saved: String =
        sqlx::query_scalar("SELECT words_json FROM transcripts WHERE id = 'saved-reading'")
            .fetch_one(db.pool())
            .await
            .unwrap();
    assert_eq!(saved, "[1]");
    for name in [
        "dialext_recordings",
        "dialext_accounts",
        "dialext_account_edits",
        "dialext_evidence",
        "dialext_speakers",
        "dialext_source_speakers",
    ] {
        assert!(
            !cloudsync_table_registry()
                .iter()
                .find(|s| s.table_name == name)
                .unwrap()
                .enabled
        );
    }
}

#[tokio::test]
async fn dialext_speaker_identity_upgrades_and_keeps_attribution_immutable() {
    let db = Db::connect_memory_plain().await.unwrap();
    let old = anlg_db_migrate::DbSchema {
        steps: migration_steps_before("20260920120000_dialext_speakers"),
        ..schema()
    };
    anlg_db_migrate::migrate(&db, old).await.unwrap();
    sqlx::query("INSERT INTO sessions(id) VALUES('kept')")
        .execute(db.pool())
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO transcripts(id,session_id,words_json) VALUES('kept-reading','kept','[2]')",
    )
    .execute(db.pool())
    .await
    .unwrap();
    prepare_schema(&db).await.unwrap();
    let saved: String =
        sqlx::query_scalar("SELECT words_json FROM transcripts WHERE id = 'kept-reading'")
            .fetch_one(db.pool())
            .await
            .unwrap();
    assert_eq!(saved, "[2]");

    sqlx::query("INSERT INTO humans(id,name) VALUES('gary','Gary')")
        .execute(db.pool())
        .await
        .unwrap();
    sqlx::query("INSERT INTO dialext_speakers(id,session_id,speaker_key,display_index) VALUES('s1','kept','irish-asr/voice-a',0)")
        .execute(db.pool())
        .await
        .unwrap();
    sqlx::query("INSERT INTO dialext_source_speakers(id,session_id,source_id,provider_label,speaker_id) VALUES('m1','kept','irish-asr','voice-a','s1')")
        .execute(db.pool())
        .await
        .unwrap();

    // Naming a person is the one thing that may change; who they spoke as is not.
    sqlx::query("UPDATE dialext_speakers SET human_id = 'gary' WHERE id = 's1'")
        .execute(db.pool())
        .await
        .unwrap();
    assert!(
        sqlx::query("UPDATE dialext_speakers SET speaker_key = 'other' WHERE id = 's1'")
            .execute(db.pool())
            .await
            .is_err()
    );
    assert!(
        sqlx::query("UPDATE dialext_source_speakers SET speaker_id = 's1' WHERE id = 'm1'")
            .execute(db.pool())
            .await
            .is_err()
    );
    assert!(
        sqlx::query("INSERT INTO dialext_source_speakers(id,session_id,source_id,provider_label,speaker_id) VALUES('m2','other','irish-asr','voice-b','s1')")
            .execute(db.pool())
            .await
            .is_err(),
        "an attribution may not borrow another recording's speaker"
    );
}

#[tokio::test]
async fn dialext_edit_history_upgrades_and_stays_append_only() {
    let db = Db::connect_memory_plain().await.unwrap();
    let old = anlg_db_migrate::DbSchema {
        steps: migration_steps_before("20260921120000_dialext_account_edits"),
        ..schema()
    };
    anlg_db_migrate::migrate(&db, old).await.unwrap();
    sqlx::query("INSERT INTO sessions(id) VALUES('kept')")
        .execute(db.pool())
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO transcripts(id,session_id,words_json) VALUES('kept-reading','kept','[3]')",
    )
    .execute(db.pool())
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO dialext_accounts(id,session_id,transcript_id,target_language,
            input_evidence_digest,original_sha256)
         VALUES('account-1','kept','kept-reading','en',
            'aa00000000000000000000000000000000000000000000000000000000000001',
            'aa00000000000000000000000000000000000000000000000000000000000002')",
    )
    .execute(db.pool())
    .await
    .unwrap();

    prepare_schema(&db).await.unwrap();
    let saved: String =
        sqlx::query_scalar("SELECT words_json FROM transcripts WHERE id = 'kept-reading'")
            .fetch_one(db.pool())
            .await
            .unwrap();
    assert_eq!(saved, "[3]", "adding history must not touch saved prose");

    sqlx::query(
        "INSERT INTO dialext_account_edits(id,session_id,account_id,sequence,changes_json)
         VALUES('e1','kept','account-1',1,'[]')",
    )
    .execute(db.pool())
    .await
    .unwrap();
    assert!(
        sqlx::query("UPDATE dialext_account_edits SET changes_json = '[9]' WHERE id = 'e1'")
            .execute(db.pool())
            .await
            .is_err(),
        "history is evidence of what the reader did; it may not be rewritten"
    );

    sqlx::query(
        "INSERT INTO dialext_account_edits(id,session_id,account_id,sequence,changes_json,undoes_edit_id)
         VALUES('e2','kept','account-1',2,'[]','e1')",
    )
    .execute(db.pool())
    .await
    .unwrap();
    assert!(
        sqlx::query(
            "INSERT INTO dialext_account_edits(id,session_id,account_id,sequence,changes_json,undoes_edit_id)
             VALUES('e3','kept','account-1',3,'[]','e1')",
        )
        .execute(db.pool())
        .await
        .is_err(),
        "one edit may be undone once, so an undo stack cannot double-revert it"
    );
    assert!(
        sqlx::query(
            "INSERT INTO dialext_account_edits(id,session_id,account_id,sequence,changes_json)
             VALUES('e4','kept','account-1',2,'[]')",
        )
        .execute(db.pool())
        .await
        .is_err(),
        "an account's edit sequence is dense and unique"
    );
}
