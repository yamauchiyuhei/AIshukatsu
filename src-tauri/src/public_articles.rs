use serde_json::Value;
use std::time::Duration;

fn valid_slug(slug: &str) -> bool {
    !slug.is_empty() && slug.len() <= 100
        && slug.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        && !slug.starts_with('-') && !slug.ends_with('-') && !slug.contains("--")
}
fn validate_body(bytes: &[u8], slug: &str) -> Result<Value, String> {
    if bytes.len() > 262_144 { return Err("記事のサイズが上限を超えています".into()); }
    let body: Value = serde_json::from_slice(bytes).map_err(|_| "記事の形式を確認できませんでした")?;
    if body.get("slug").and_then(Value::as_str) != Some(slug)
        || body.get("status").and_then(Value::as_str) != Some("published") {
        return Err("公開記事を確認できませんでした".into());
    }
    Ok(body)
}
/// Fetch only the public article endpoint. URLs and local paths cannot be supplied.
#[tauri::command]
pub async fn load_public_article(slug: String) -> Result<Value, String> {
    if !valid_slug(&slug) { return Err("記事の識別情報が不正です".into()); }
    let client = reqwest::Client::builder().https_only(true)
        .redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(15))
        .build().map_err(|_| "記事への接続を準備できませんでした")?;
    let response = client.get(format!("https://aishukatsu.net/magazine/articles/{slug}.json"))
        .header("Accept", "application/json").send().await
        .map_err(|_| "記事を読み込めませんでした。接続を確認して再試行してください")?;
    if !response.status().is_success() { return Err("公開記事が見つかりませんでした".into()); }
    if response.content_length().is_some_and(|size| size > 262_144) { return Err("記事のサイズが上限を超えています".into()); }
    let bytes = response.bytes().await.map_err(|_| "記事を受信できませんでした")?;
    validate_body(&bytes, &slug)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn article_identity_cannot_be_a_url_or_file_path() {
        for value in ["", "../secret", "a/b", "a\\b", "https://evil.test", "-test", "test-", "a--b", "a?x=1", "a%2fb", "a#b"] { assert!(!valid_slug(value), "{value}"); }
        assert!(valid_slug("company-analysis-7203"));
        assert!(valid_slug("company-analysis-unlisted-company"));
    }
    #[test]
    fn only_matching_published_article_is_returned() {
        assert!(validate_body(br#"{"slug":"company-analysis-7203","status":"published"}"#, "company-analysis-7203").is_ok());
        for body in [br#"{"slug":"other","status":"published"}"#.as_slice(), br#"{"slug":"company-analysis-7203","status":"draft"}"#.as_slice(), b"not json"] { assert!(validate_body(body, "company-analysis-7203").is_err()); }
        assert!(validate_body(&vec![b' '; 262_145], "company-analysis-7203").is_err());
    }
}
