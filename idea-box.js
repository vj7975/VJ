import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./assets/supabase-config.js";

const form = document.querySelector("#idea-submission-form");
const textField = document.querySelector("#idea-text");
const fileInput = document.querySelector("#idea-files");
const fileList = document.querySelector("#idea-file-list");
const submitButton = document.querySelector("#idea-submit-button");
const statusMessage = document.querySelector("#idea-form-status");
const maxFileSize = 10 * 1024 * 1024;
const maxFiles = 5;
const allowedExtensions = new Set(["pdf", "docx", "txt", "jpg", "jpeg", "png"]);

if (form && textField && fileInput && fileList && submitButton && statusMessage) {
  const configReady = SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_SUPABASE") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  const submitEndpoint = `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/submit-idea`;

  function showStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("is-error", type === "error");
    statusMessage.classList.toggle("is-success", type === "success");
  }

  function selectedFiles() {
    return Array.from(fileInput.files || []);
  }

  function renderFileList() {
    fileList.replaceChildren();

    selectedFiles().forEach((file, index) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      const removeButton = document.createElement("button");
      name.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
      removeButton.className = "idea-file-remove";
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove ${file.name}`);
      removeButton.addEventListener("click", () => {
        const transfer = new DataTransfer();
        selectedFiles().forEach((selected, selectedIndex) => {
          if (selectedIndex !== index) transfer.items.add(selected);
        });
        fileInput.files = transfer.files;
        renderFileList();
      });
      item.append(name, removeButton);
      fileList.append(item);
    });
  }

  function validateFiles(files) {
    if (files.length > maxFiles) return "Choose no more than five files.";
    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !allowedExtensions.has(extension)) {
        return `${file.name} is not an allowed file type.`;
      }
      if (file.size === 0 || file.size > maxFileSize) {
        return `${file.name} must be larger than 0 bytes and no more than 10 MB.`;
      }
    }
    return "";
  }

  fileInput.addEventListener("change", () => {
    renderFileList();
    const error = validateFiles(selectedFiles());
    showStatus(error, error ? "error" : "");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const idea = textField.value.trim();
    const files = selectedFiles();
    const fileError = validateFiles(files);

    if (!idea) {
      showStatus("Write your idea before submitting.", "error");
      textField.focus();
      return;
    }
    if (idea.length > 10000) {
      showStatus("Your idea must be 10,000 characters or fewer.", "error");
      return;
    }
    if (fileError) {
      showStatus(fileError, "error");
      return;
    }
    if (!configReady) {
      submitButton.textContent = "Retry Submission";
      showStatus(
        "Backend setup is missing: set SUPABASE_URL and SUPABASE_ANON_KEY in assets/supabase-config.js, then deploy the database migration and submit-idea function. Your text and files are still here.",
        "error"
      );
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
    showStatus("");

    try {
      const body = new FormData();
      body.set("idea", idea);
      files.forEach((file) => body.append("attachments", file, file.name));
      const response = await fetch(submitEndpoint, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY },
        body
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`The submission service returned an unreadable response (HTTP ${response.status}).`);
      }
      if (!response.ok) throw new Error(data?.error || "The submission could not be saved.");
      if (!data || data.success !== true) throw new Error("The submission was not confirmed by the server.");

      form.reset();
      renderFileList();
      submitButton.textContent = "Submit Idea";
      showStatus("Idea submitted successfully", "success");
    } catch (error) {
      console.error("Idea submission failed.", error);
      submitButton.textContent = "Retry Submission";
      showStatus(
        error instanceof TypeError
          ? "Could not reach the submission server. Check the Supabase URL, function deployment, and connection. Your text and files are still here."
          : error?.message || "Submission failed. Your text and files are still here; please retry.",
        "error"
      );
    } finally {
      submitButton.disabled = false;
    }
  });
}
