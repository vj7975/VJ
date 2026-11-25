import { OWNER_EMAIL, SUPABASE_ANON_KEY, SUPABASE_URL } from "./assets/supabase-config.js";

const authPanel = document.querySelector("#inbox-auth-panel");
const loginForm = document.querySelector("#inbox-login-form");
const loginButton = document.querySelector("#inbox-login-button");
const ownerEmailInput = document.querySelector("#inbox-owner-email");
const authMessage = document.querySelector("#inbox-auth-message");
const dashboard = document.querySelector("#inbox-dashboard");
const dashboardMessage = document.querySelector("#inbox-dashboard-message");
const list = document.querySelector("#inbox-list");
const emptyMessage = document.querySelector("#inbox-empty");
const detail = document.querySelector("#inbox-detail");
const signOutButton = document.querySelector("#inbox-signout");
const refreshButton = document.querySelector("#inbox-refresh");
const createBackupButton = document.querySelector("#inbox-create-backup");
const backupMessage = document.querySelector("#inbox-backup-message");
const backupProgress = document.querySelector("#inbox-backup-progress");
const backupProgressMessage = document.querySelector("#inbox-backup-progress-message");
const backupHistory = document.querySelector("#inbox-backup-history");
const backupEmpty = document.querySelector("#inbox-backup-empty");
const lastBackup = document.querySelector("#inbox-last-backup");
const backupUsage = document.querySelector("#inbox-backup-usage");
const restoreFileInput = document.querySelector("#inbox-restore-file");
const selectRestoreButton = document.querySelector("#inbox-select-restore");
const restorePreview = document.querySelector("#inbox-restore-preview");
const restoreSummary = document.querySelector("#inbox-restore-summary");
const restoreDuplicates = document.querySelector("#inbox-restore-duplicates");
const restoreRecords = document.querySelector("#inbox-restore-records");
const confirmRestoreButton = document.querySelector("#inbox-confirm-restore");
const instagramIcebreakerButton = document.querySelector("#inbox-configure-instagram-icebreaker");
const instagramIcebreakerMessage = document.querySelector("#inbox-instagram-icebreaker-message");
const bucketName = "idea-attachments";
const backupEndpoint = `${SUPABASE_URL}/functions/v1/manage-idea-backups`;
const instagramIcebreakerEndpoint = `${SUPABASE_URL}/functions/v1/manage-instagram-icebreaker`;
const backupSetupHelp =
  "Backup setup needed: apply all Supabase migrations, deploy manage-idea-backups, and verify the private backup buckets and the function's SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY server variables.";

if (authPanel && loginForm && dashboard && list && detail) {
  const configReady = SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_SUPABASE") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE") &&
    OWNER_EMAIL.includes("@");

  if (ownerEmailInput) ownerEmailInput.value = OWNER_EMAIL;

  function setMessage(element, message, isError = false) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-error", isError);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function clearDetail() {
    detail.replaceChildren();
    detail.hidden = true;
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return "Size unavailable";
    if (bytes < 1024) return `${bytes} bytes`;
    const units = ["KB", "MB", "GB", "TB"];
    let size = bytes / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unit]}`;
  }

  function setBackupProgress(message = "") {
    backupProgress.hidden = !message;
    backupProgressMessage.textContent = message;
  }

  async function backupRequest(action, { confirmed = false, id, restorePath } = {}) {
    if (!supabaseClient) throw new Error("The owner sign-in service is unavailable. Reload and sign in again.");
    const { data, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Your owner session has expired. Sign in again.");

    const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` };
    headers["Content-Type"] = "application/json";
    const body = JSON.stringify({ action, id, restorePath, confirmed });
    let response;
    try {
      response = await fetch(backupEndpoint, { method: "POST", headers, body });
    } catch (error) {
      console.error("Could not reach the private backup service.", error);
      throw new Error(backupSetupHelp);
    }
    if (!response.ok) {
      let message = backupSetupHelp;
      try {
        const result = await response.json();
        if (result.error) message = result.error;
      } catch {
        // Keep the actionable default when the server does not return JSON.
      }
      throw new Error(message);
    }
    return response;
  }

  async function configureInstagramIcebreaker() {
    if (!supabaseClient) throw new Error("The owner sign-in service is unavailable. Reload and sign in again.");
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Your owner session has expired. Sign in again.");

    let response;
    try {
      response = await fetch(instagramIcebreakerEndpoint, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "configure" })
      });
    } catch (error) {
      console.error("Could not reach the Instagram Icebreaker service.", error);
      throw new Error("Could not reach the Instagram setup service. Verify that manage-instagram-icebreaker is deployed.");
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      console.error("The Instagram Icebreaker service returned an unreadable response.", error);
      throw new Error("Instagram setup could not be verified. Check the Edge Function deployment and retry.");
    }
    if (!response.ok || result.success !== true || result.verified !== true) {
      throw new Error(result.error || "Meta did not confirm the Icebreaker configuration.");
    }
    return result;
  }

  async function loadBackupHistory() {
    backupHistory.replaceChildren();
    backupEmpty.hidden = true;
    const response = await backupRequest("list");
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Could not load backup history.");

    backupUsage.textContent = formatBytes(result.storageUsageBytes);
    lastBackup.textContent = result.lastSuccessful
      ? `${formatDate(result.lastSuccessful.created_at)} · ${formatBytes(result.lastSuccessful.size_bytes)}`
      : "Not yet backed up";
    backupEmpty.hidden = result.history.length > 0;

    result.history.forEach((backup) => {
      const row = document.createElement("tr");
      const date = document.createElement("td");
      const size = document.createElement("td");
      const status = document.createElement("td");
      const action = document.createElement("td");
      const statusLabel = document.createElement("span");
      date.dataset.label = "Date & time";
      size.dataset.label = "Size";
      status.dataset.label = "Status";
      action.dataset.label = "Action";
      date.textContent = formatDate(backup.created_at);
      size.textContent = formatBytes(backup.size_bytes);
      statusLabel.className = `inbox-backup-status is-${backup.status}`;
      statusLabel.textContent = backup.status === "successful" ? "Successful" : backup.status === "failed" ? "Failed" : "In progress";
      status.append(statusLabel);
      if (backup.status === "successful") {
        const downloadButton = document.createElement("button");
        downloadButton.className = "inbox-backup-download";
        downloadButton.type = "button";
        downloadButton.textContent = "Download Backup";
        downloadButton.addEventListener("click", () => {
          void downloadBackup(backup.id, downloadButton);
        });
        action.append(downloadButton);
      } else if (backup.error_message) {
        statusLabel.title = backup.error_message;
      }
      row.append(date, size, status, action);
      backupHistory.append(row);
    });
  }

  async function downloadBackup(id, button) {
    button.disabled = true;
    setMessage(backupMessage, "Downloading the private backup...");
    try {
      const response = await backupRequest("download", { id });
      const result = await response.json();
      if (!result.success || !result.downloadUrl) throw new Error(result.error || "Could not create a private download link.");
      window.location.assign(result.downloadUrl);
      setMessage(backupMessage, `Starting download: ${result.filename}.`);
    } catch (error) {
      console.error("Could not download the private backup.", error);
      setMessage(backupMessage, error.message || "Could not download the backup.", true);
    } finally {
      button.disabled = false;
    }
  }

  let selectedRestoreFile = null;
  let selectedRestorePath = null;

  let supabaseClient = null;
  if (configReady) {
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true
        }
      });
    } catch (error) {
      console.error("Could not load the owner sign-in service.", error);
    }
  }

  async function renderDetail(idea) {
    detail.replaceChildren();
    const header = document.createElement("div");
    header.className = "inbox-detail-header";
    const title = document.createElement("div");
    const heading = document.createElement("h2");
    const date = document.createElement("p");
    const status = document.createElement("select");
    const newOption = document.createElement("option");
    const reviewedOption = document.createElement("option");
    heading.textContent = "Submitted idea";
    date.className = "inbox-detail-copy";
    date.textContent = formatDate(idea.created_at);
    status.className = "inbox-status-select";
    status.setAttribute("aria-label", "Submission status");
    newOption.value = "new";
    newOption.textContent = "New";
    reviewedOption.value = "reviewed";
    reviewedOption.textContent = "Reviewed";
    status.append(newOption, reviewedOption);
    status.value = idea.status;
    title.append(heading, date);
    header.append(title, status);

    const copy = document.createElement("p");
    copy.className = "inbox-detail-copy";
    copy.style.whiteSpace = "pre-wrap";
    copy.textContent = idea.idea_text;
    const attachmentList = document.createElement("ul");
    attachmentList.className = "inbox-attachments";

    detail.append(header, copy);
    if (idea.idea_attachments?.length) {
      const attachmentHeading = document.createElement("h3");
      attachmentHeading.textContent = "Attachments";
      detail.append(attachmentHeading, attachmentList);
    } else {
      const noAttachments = document.createElement("p");
      noAttachments.className = "inbox-detail-copy";
      noAttachments.textContent = "No attachments.";
      detail.append(noAttachments);
    }
    detail.hidden = false;
    setMessage(dashboardMessage, "");

    status.addEventListener("change", async () => {
      status.disabled = true;
      const { data, error } = await supabaseClient
        .from("ideas")
        .update({ status: status.value })
        .eq("id", idea.id)
        .select("id")
        .maybeSingle();
      status.disabled = false;
      if (error || !data) {
        status.value = idea.status;
        setMessage(dashboardMessage, "Could not update this status. Please retry.", true);
        console.error("Could not update idea status.", error || new Error("No authorized submission row was updated."));
        return;
      }
      idea.status = status.value;
      setMessage(dashboardMessage, "Status updated.");
      await loadIdeas(idea.id);
    });

    for (const attachment of idea.idea_attachments || []) {
      const row = document.createElement("li");
      const fileName = document.createElement("span");
      fileName.textContent = `${attachment.original_filename} · ${(attachment.size_bytes / (1024 * 1024)).toFixed(1)} MB`;
      row.append(fileName);
      try {
        const { data: previewData, error: previewError } = await supabaseClient
          .storage.from(bucketName).createSignedUrl(attachment.storage_path, 300);
        if (previewError) throw previewError;
        if (attachment.mime_type === "application/pdf" || attachment.mime_type.startsWith("image/")) {
          const previewLink = document.createElement("a");
          previewLink.href = previewData.signedUrl;
          previewLink.target = "_blank";
          previewLink.rel = "noopener noreferrer";
          previewLink.textContent = "Preview";
          row.append(previewLink);
        }
        const { data: downloadData, error: downloadError } = await supabaseClient
          .storage.from(bucketName)
          .createSignedUrl(attachment.storage_path, 300, { download: attachment.original_filename });
        if (downloadError) throw downloadError;
        const downloadLink = document.createElement("a");
        downloadLink.href = downloadData.signedUrl;
        downloadLink.target = "_blank";
        downloadLink.rel = "noopener noreferrer";
        downloadLink.textContent = "Download";
        row.append(downloadLink);
      } catch (error) {
        console.error("Could not create an attachment link.", error);
        setMessage(dashboardMessage, "Could not create a private attachment link. Refresh and retry.", true);
      }
      attachmentList.append(row);
    }
  }

  async function loadIdeas(selectedId = "") {
    if (!supabaseClient) return;
    clearDetail();
    setMessage(dashboardMessage, "Loading submissions...");
    list.replaceChildren();
    emptyMessage.hidden = true;
    const { data, error } = await supabaseClient
      .from("ideas")
      .select("id, idea_text, created_at, status, idea_attachments(id, original_filename, mime_type, size_bytes, storage_path)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load private idea submissions.", error);
      setMessage(dashboardMessage, "Could not load submissions. Check your owner access and backend setup.", true);
      return;
    }

    setMessage(dashboardMessage, "");
    emptyMessage.hidden = data.length > 0;
    data.forEach((idea) => {
      const item = document.createElement("button");
      const summary = document.createElement("span");
      const date = document.createElement("small");
      const status = document.createElement("span");
      item.type = "button";
      item.className = "inbox-list-item";
      summary.textContent = idea.idea_text.length > 120 ? `${idea.idea_text.slice(0, 120)}…` : idea.idea_text;
      date.textContent = formatDate(idea.created_at);
      status.className = "inbox-status";
      status.textContent = idea.status === "reviewed" ? "Reviewed" : "New";
      item.append(summary, date, status);
      item.addEventListener("click", () => renderDetail(idea));
      list.append(item);
    });
    if (selectedId) {
      const selectedIdea = data.find((idea) => idea.id === selectedId);
      if (selectedIdea) await renderDetail(selectedIdea);
    }
  }

  async function applySession(session) {
    const user = session?.user;
    if (!user) {
      authPanel.hidden = false;
      dashboard.hidden = true;
      signOutButton.hidden = true;
      selectedRestoreFile = null;
      restoreFileInput.value = "";
      restorePreview.hidden = true;
      return;
    }

    if ((user.email || "").toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      await supabaseClient.auth.signOut();
      authPanel.hidden = false;
      dashboard.hidden = true;
      signOutButton.hidden = true;
      setMessage(authMessage, "This account is not authorized to view the Idea Inbox.", true);
      return;
    }

    authPanel.hidden = true;
    dashboard.hidden = false;
    signOutButton.hidden = false;
    await loadIdeas();
    try {
      await loadBackupHistory();
      setMessage(backupMessage, "");
    } catch (error) {
      console.error("Could not load private backup history.", error);
      setMessage(backupMessage, error.message || "Could not load backup history.", true);
    }
  }

  if (!configReady) {
    setMessage(
      authMessage,
      "Backend setup is missing: set SUPABASE_URL and SUPABASE_ANON_KEY in assets/supabase-config.js, apply all database migrations, deploy submit-idea and manage-idea-backups, configure the backup function's SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY server variables, and allowlist this page in Supabase Auth.",
      true
    );
  } else if (!supabaseClient) {
    setMessage(authMessage, "Could not load the Supabase sign-in client. Check your connection and reload.", true);
  } else {
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      setMessage(authMessage, "Could not check the sign-in session. Please reload and try again.", true);
      console.error("Could not read the owner session.", error);
    } else {
      await applySession(data.session);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseClient || !configReady) {
      setMessage(
        authMessage,
        "Configure the Supabase URL and public anon/publishable key, deploy the migration and function, then reload this page.",
        true
      );
      return;
    }
    loginButton.disabled = true;
    setMessage(authMessage, "Sending a secure sign-in link...");
    try {
      const { error } = await supabaseClient.auth.signInWithOtp({
        email: OWNER_EMAIL,
        options: { emailRedirectTo: window.location.href.split("#")[0] }
      });
      if (error) {
        console.error("Could not send the owner sign-in link.", error);
        setMessage(authMessage, "Could not send the sign-in link. Check the Supabase Auth email settings and retry.", true);
        return;
      }
      setMessage(authMessage, "Check your email for the secure sign-in link.");
    } catch (error) {
      console.error("Could not send the owner sign-in link.", error);
      setMessage(authMessage, "Could not send the sign-in link. Check your connection and retry.", true);
    } finally {
      loginButton.disabled = false;
    }
  });

  signOutButton?.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      setMessage(dashboardMessage, "Could not sign out. Please try again.", true);
      console.error("Could not sign out of the Idea Inbox.", error);
      return;
    }
    clearDetail();
    setMessage(authMessage, "You have signed out.");
  });

  refreshButton?.addEventListener("click", () => {
    void Promise.all([
      loadIdeas(),
      loadBackupHistory().catch((error) => {
        console.error("Could not refresh private backup history.", error);
        setMessage(backupMessage, error.message || "Could not refresh backup history.", true);
      })
    ]);
  });

  createBackupButton?.addEventListener("click", async () => {
    createBackupButton.disabled = true;
    setMessage(backupMessage, "");
    setBackupProgress("Collecting submissions and copying their attachments into private storage...");
    try {
      const response = await backupRequest("create");
      const result = await response.json();
      if (!result.success || result.backup?.status !== "successful") {
        throw new Error(result.error || "The backup was not confirmed as saved.");
      }
      setMessage(backupMessage, `Backup saved successfully: ${result.backup.filename} · ${formatBytes(result.backup.size_bytes)}.`);
      try {
        await loadBackupHistory();
      } catch (error) {
        console.error("The backup succeeded but its history could not be refreshed.", error);
        setMessage(backupMessage, `Backup saved successfully: ${result.backup.filename}. History refresh failed; use Refresh to retry.`, true);
      }
    } catch (error) {
      console.error("Could not create a private Idea Inbox backup.", error);
      setMessage(backupMessage, error.message || "Backup failed. No success was reported.", true);
    } finally {
      setBackupProgress();
      createBackupButton.disabled = false;
    }
  });

  instagramIcebreakerButton?.addEventListener("click", async () => {
    if (!window.confirm("Configure this Icebreaker on your connected Instagram professional account? Existing Icebreakers will be preserved.")) {
      return;
    }
    instagramIcebreakerButton.disabled = true;
    setMessage(instagramIcebreakerMessage, "Checking the current Meta configuration...");
    try {
      const result = await configureInstagramIcebreaker();
      setMessage(instagramIcebreakerMessage, result.message);
    } catch (error) {
      console.error("Could not configure the Instagram Icebreaker.", error);
      setMessage(
        instagramIcebreakerMessage,
        error.message || "Meta did not confirm the Icebreaker configuration.",
        true
      );
    } finally {
      instagramIcebreakerButton.disabled = false;
    }
  });

  selectRestoreButton?.addEventListener("click", () => {
    restoreFileInput.value = "";
    restoreFileInput.click();
  });

  restoreFileInput?.addEventListener("change", async () => {
    if (selectedRestorePath) {
      try {
        await backupRequest("discard_restore", { restorePath: selectedRestorePath });
      } catch (error) {
        console.error("Could not remove the previous restore staging file.", error);
      }
      selectedRestorePath = null;
    }
    selectedRestoreFile = restoreFileInput.files?.[0] || null;
    restorePreview.hidden = true;
    if (!selectedRestoreFile) return;
    selectRestoreButton.disabled = true;
    confirmRestoreButton.disabled = true;
    setMessage(backupMessage, "");
    setBackupProgress("Validating the ZIP, manifest, records, and attachment files...");
    try {
      if (selectedRestoreFile.size > 100 * 1024 * 1024) {
        throw new Error("Choose a ZIP file no larger than 100 MB.");
      }
      setBackupProgress("Uploading the ZIP to private restore staging...");
      const prepareResponse = await backupRequest("prepare_restore");
      const prepared = await prepareResponse.json();
      if (!prepared.success || !prepared.path) {
        throw new Error(prepared.error || "Could not prepare private restore storage.");
      }
      selectedRestorePath = prepared.path;
      const { error: uploadError } = await supabaseClient.storage
        .from("idea-restore-staging")
        .upload(prepared.path, selectedRestoreFile, {
          contentType: "application/zip",
          upsert: false
        });
      if (uploadError) throw new Error("Could not upload the ZIP to private restore staging. Check storage configuration and retry.");
      setBackupProgress("Validating the ZIP, manifest, records, and attachment files...");
      const response = await backupRequest("preview_restore", { restorePath: selectedRestorePath });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "The backup could not be validated.");
      restoreSummary.textContent =
        `${result.ideas} idea record(s), ${result.attachments} attachment file(s); ${result.newIdeas} new record(s) ready to restore.`;
      restoreDuplicates.textContent = result.duplicateCount
        ? `${result.duplicateCount} duplicate idea ID(s) will be skipped; existing records will not be overwritten. IDs: ${result.duplicates.slice(0, 20).join(", ")}${result.duplicateCount > 20 ? ", and more" : ""}.`
        : "No duplicate idea IDs. All previewed records can be added.";
      restoreRecords.replaceChildren();
      result.preview.forEach((idea) => {
        const item = document.createElement("li");
        const attachmentNames = idea.attachments.length
          ? `Files: ${idea.attachments.join(", ")}`
          : "No attachments";
        item.textContent = `${formatDate(idea.created_at)} · ${idea.status} · ${idea.idea_text} · ${attachmentNames}`;
        restoreRecords.append(item);
      });
      if (result.moreIdeas > 0) {
        const more = document.createElement("li");
        more.textContent = `${result.moreIdeas} more idea record(s) not shown in this preview.`;
        restoreRecords.append(more);
      }
      restorePreview.hidden = false;
      setMessage(backupMessage, `Validated ${selectedRestoreFile.name}. Review the preview before confirming.`);
    } catch (error) {
      console.error("Could not validate the selected backup archive.", error);
      if (selectedRestorePath) {
        try {
          await backupRequest("discard_restore", { restorePath: selectedRestorePath });
        } catch (cleanupError) {
          console.error("Could not clean up the invalid restore staging file.", cleanupError);
        }
      }
      selectedRestorePath = null;
      selectedRestoreFile = null;
      restoreFileInput.value = "";
      setMessage(backupMessage, error.message || "Could not validate this backup archive.", true);
    } finally {
      setBackupProgress();
      selectRestoreButton.disabled = false;
      confirmRestoreButton.disabled = false;
    }
  });

  confirmRestoreButton?.addEventListener("click", async () => {
    if (!selectedRestoreFile || !selectedRestorePath) {
      setMessage(backupMessage, "Choose and preview a ZIP backup before restoring.", true);
      return;
    }
    const confirmed = window.confirm(
      "Restore the previewed records now? A private backup of the current submissions will be saved first. Duplicate idea IDs will be skipped; existing records will not be replaced."
    );
    if (!confirmed) return;

    confirmRestoreButton.disabled = true;
    selectRestoreButton.disabled = true;
    setMessage(backupMessage, "");
    setBackupProgress("Saving a safety backup of current data, then restoring validated records...");
    try {
      const response = await backupRequest("restore", { restorePath: selectedRestorePath, confirmed: true });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "The restore could not be completed.");
      const safetyCopy = result.safetyBackup
        ? ` Safety backup: ${result.safetyBackup.filename}.`
        : "";
      setMessage(
        backupMessage,
        `Restore complete. Added ${result.restored} idea record(s); skipped ${result.duplicateCount} duplicate(s).${safetyCopy}`
      );
      selectedRestoreFile = null;
      selectedRestorePath = null;
      restoreFileInput.value = "";
      restorePreview.hidden = true;
      await Promise.all([
        loadIdeas(),
        loadBackupHistory().catch((error) => {
          console.error("Restore succeeded but backup history could not be refreshed.", error);
          setMessage(backupMessage, "Restore completed, but backup history could not be refreshed. Use Refresh to retry.", true);
        })
      ]);
    } catch (error) {
      console.error("Could not restore the validated backup.", error);
      setMessage(backupMessage, error.message || "Restore failed. Existing records were preserved.", true);
      if (selectedRestorePath) {
        try {
          await backupRequest("discard_restore", { restorePath: selectedRestorePath });
        } catch (cleanupError) {
          console.error("Could not clean up the restore staging file.", cleanupError);
        }
      }
      selectedRestorePath = null;
      selectedRestoreFile = null;
      restoreFileInput.value = "";
      restorePreview.hidden = true;
      try {
        await loadBackupHistory();
      } catch (historyError) {
        console.error("Could not refresh backup history after the restore attempt.", historyError);
      }
    } finally {
      setBackupProgress();
      confirmRestoreButton.disabled = false;
      selectRestoreButton.disabled = false;
    }
  });
}
