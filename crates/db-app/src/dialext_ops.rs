use sqlx::SqlitePool;

#[derive(Debug, thiserror::Error)]
pub enum DialextSelectionError {
    #[error("The reading changed in another window. Refresh and review your selection.")]
    StaleSelection,
    #[error("This language account is unavailable.")]
    Unavailable,
    #[error(transparent)]
    Database(#[from] sqlx::Error),
}

pub async fn select_dialext_account(
    pool: &SqlitePool,
    session_id: &str,
    account_id: &str,
    expected_previous_account_id: Option<&str>,
) -> Result<(), DialextSelectionError> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let Some((previous,)) = sqlx::query_as::<_, (Option<String>,)>(
        "SELECT r.active_account_id FROM dialext_recordings r
         JOIN sessions s ON s.id = r.id AND s.deleted_at IS NULL WHERE r.id = ?",
    )
    .bind(session_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Err(DialextSelectionError::Unavailable);
    };
    if previous.as_deref() != expected_previous_account_id {
        return Err(DialextSelectionError::StaleSelection);
    }
    let Some(language) = sqlx::query_scalar::<_,String>(
        "SELECT a.target_language FROM dialext_accounts a JOIN transcripts t ON t.id = a.transcript_id
         WHERE a.id = ? AND a.session_id = ? AND t.session_id = a.session_id AND t.deleted_at IS NULL
           AND json_valid(t.words_json) AND json_type(t.words_json) = 'array' AND json_array_length(t.words_json) > 0",
    ).bind(account_id).bind(session_id).fetch_optional(&mut *tx).await? else {
        return Err(DialextSelectionError::Unavailable);
    };
    if previous.as_deref() == Some(account_id) {
        return Ok(());
    }
    sqlx::query("UPDATE dialext_recordings SET active_account_id = ?, preferred_language = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
        .bind(account_id).bind(&language).bind(session_id).execute(&mut *tx).await?;
    // Existing snapshot/context listeners observe session timestamps; summary documents are untouched.
    sqlx::query("UPDATE sessions SET language = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
        .bind(language).bind(session_id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}
