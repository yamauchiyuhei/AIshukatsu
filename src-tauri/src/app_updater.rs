//! Signed update packages and installer bytes stay in the native process.
use serde::Serialize;
use std::{sync::{atomic::{AtomicBool, Ordering}, Mutex}, time::Duration};
use tauri::{ipc::Channel, AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};
const MAX_BYTES:usize=256*1024*1024;
#[derive(Default)]
pub struct AppUpdaterState { busy:AtomicBool, pending:Mutex<Option<Pending>> }
struct Pending { update:Update, bytes:Option<Vec<u8>> }
struct Busy<'a>(&'a AtomicBool);
impl Drop for Busy<'_>{fn drop(&mut self){self.0.store(false,Ordering::Release);}}
impl AppUpdaterState {
    fn begin(&self)->Result<Busy<'_>,String>{self.busy.compare_exchange(false,true,Ordering::AcqRel,Ordering::Acquire).map_err(|_|"update_busy".to_string())?;Ok(Busy(&self.busy))}
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct UpdateInfo { current_version:String, version:Option<String>, notes:Option<String> }
#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
pub struct UpdateProgress { downloaded:usize,total:Option<u64>,verifying:bool }
fn validate_artifact(url:&tauri::Url,version:&str)->Result<(),String>{
    let filename=url.path().rsplit('/').next().unwrap_or("");
    let valid_version=version.split('.').count()==3&&version.split('.').all(|s|!s.is_empty()&&s.chars().all(|c|c.is_ascii_digit()));
    if !valid_version||url.scheme()!="https"||url.host_str()!=Some("github.com")||url.port().is_some()||!url.username().is_empty()||url.password().is_some()||url.query().is_some()||url.fragment().is_some()
        ||url.path()!=format!("/yamauchiyuhei/AIshukatsu/releases/download/v{version}/{filename}")
        ||!filename.chars().all(|c|c.is_ascii_alphanumeric()||"_.-".contains(c))||!(filename.ends_with(".app.tar.gz")||filename.ends_with(".exe")) { return Err("update_invalid_release".into()); }
    Ok(())
}
fn redirects()->reqwest::redirect::Policy{
    reqwest::redirect::Policy::custom(|attempt|{
        let host=attempt.url().host_str().unwrap_or("");
        if attempt.previous().len()<5&&attempt.url().scheme()=="https"&&(host=="github.com"||host.ends_with(".githubusercontent.com")){attempt.follow()}else{attempt.stop()}
    })
}
#[tauri::command]
pub async fn app_update_check(app:AppHandle,state:State<'_,AppUpdaterState>)->Result<UpdateInfo,String>{
    let _busy=state.begin()?;
    let update=app.updater_builder().timeout(Duration::from_secs(25)).configure_client(|client|client.https_only(true).redirect(redirects())).build().map_err(|_|"update_unavailable")?.check().await.map_err(|_|"update_check_failed")?;
    let current_version=app.package_info().version.to_string();
    let (pending,version,notes)=if let Some(update)=update{
        validate_artifact(&update.download_url,&update.version)?;
        let version=Some(update.version.clone());let notes=update.body.as_ref().map(|text|text.chars().take(8000).collect());
        (Some(Pending{update,bytes:None}),version,notes)
    }else{(None,None,None)};
    *state.pending.lock().map_err(|_|"update_unavailable")?=pending;
    Ok(UpdateInfo{current_version,version,notes})
}
#[tauri::command]
pub async fn app_update_download(state:State<'_,AppUpdaterState>,progress:Channel<UpdateProgress>)->Result<(),String>{
    let _busy=state.begin()?;
    let update=state.pending.lock().map_err(|_|"update_unavailable")?.as_ref().ok_or("update_check_first")?.update.clone();
    validate_artifact(&update.download_url,&update.version)?;
    let client=reqwest::Client::builder().https_only(true).redirect(redirects()).connect_timeout(Duration::from_secs(20)).timeout(Duration::from_secs(600)).build().map_err(|_|"update_download_failed")?;
    let mut response=client.get(update.download_url.clone()).send().await.map_err(|_|"update_download_failed")?;
    if !response.status().is_success(){return Err("update_download_failed".into());}
    let total=response.content_length();if total.is_some_and(|size|size>MAX_BYTES as u64){return Err("update_invalid_release".into());}
    let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|_|"update_download_failed")?{
        if bytes.len().saturating_add(chunk.len())>MAX_BYTES{return Err("update_invalid_release".into());}
        bytes.extend_from_slice(&chunk);let _=progress.send(UpdateProgress{downloaded:bytes.len(),total,verifying:false});
    }
    let _=progress.send(UpdateProgress{downloaded:bytes.len(),total,verifying:true});
    update.verify(&bytes).map_err(|_|"update_signature_failed")?;
    state.pending.lock().map_err(|_|"update_unavailable")?.as_mut().ok_or("update_check_first")?.bytes=Some(bytes);
    Ok(())
}
#[tauri::command]
pub async fn app_update_install(app:AppHandle,state:State<'_,AppUpdaterState>,confirmed:bool)->Result<(),String>{
    if !confirmed{return Err("update_confirmation_required".into());}
    let _busy=state.begin()?;
    let (update,bytes)={let mut cache=state.pending.lock().map_err(|_|"update_unavailable")?;let pending=cache.as_mut().ok_or("update_download_first")?;(pending.update.clone(),pending.bytes.take().ok_or("update_download_first")?)};
    let (bytes,result)=tauri::async_runtime::spawn_blocking(move||{
        let result=update.install(&bytes).map_err(|_|"update_install_failed".to_string());
        #[cfg(not(windows))]
        if result.is_ok(){crate::approve_update_exit();app.restart();}
        #[cfg(windows)]
        let _=app;
        (bytes,result)
    }).await.map_err(|_|"update_install_failed")?;
    if result.is_err(){if let Some(pending)=state.pending.lock().map_err(|_|"update_unavailable")?.as_mut(){pending.bytes=Some(bytes);}}
    result
}
#[cfg(test)]
mod tests{
    use super::*;
    #[test]fn only_our_versioned_release_is_accepted(){
        for url in ["https://github.com/yamauchiyuhei/AIshukatsu/releases/download/v0.2.18/AIshukatsu_universal.app.tar.gz","https://github.com/yamauchiyuhei/AIshukatsu/releases/download/v0.2.18/AIshukatsu_0.2.18_x64-setup.exe"]{assert!(validate_artifact(&url.parse().unwrap(),"0.2.18").is_ok());}
        for url in ["http://github.com/yamauchiyuhei/AIshukatsu/releases/download/v0.2.18/app.exe","https://evil.invalid/yamauchiyuhei/AIshukatsu/releases/download/v0.2.18/app.exe","https://github.com/other/repo/releases/download/v0.2.18/app.exe","https://github.com/yamauchiyuhei/AIshukatsu/releases/download/v0.2.17/app.exe","https://github.com/yamauchiyuhei/AIshukatsu/releases/download/v0.2.18/app.exe?token=x"]{assert!(validate_artifact(&url.parse().unwrap(),"0.2.18").is_err());}
    }
    #[test]fn operations_are_serial_and_can_retry_after_failure(){let state=AppUpdaterState::default();let busy=state.begin().unwrap();assert!(state.begin().is_err());drop(busy);assert!(state.begin().is_ok());}
}
