(function () {
  "use strict";

  const rootSelector = ".fabricvton-block";

  function attachBlock(root) {
    if (!root || root.dataset.initialized === "true") return;

    const launcher      = root.querySelector(".fabricvton-block__btn");
    const modal         = root.querySelector(".fabricvton-try-on__modal");
    const closeButtons  = root.querySelectorAll("[data-close-modal]");
    const input         = root.querySelector(".fabricvton-try-on__input");
    const dropzone      = root.querySelector("[data-dropzone]");
    const dropzoneIdle  = root.querySelector("[data-dropzone-idle]");
    const uploadThumb   = root.querySelector("[data-upload-thumb]");
    const primaryAction = root.querySelector("[data-primary-action]");

    const stepUpload    = root.querySelector("[data-step='upload']");
    const stepResult    = root.querySelector("[data-step='result']");
    const generatingEl  = root.querySelector("[data-generating]");
    const comparisonEl  = root.querySelector("[data-comparison]");
    const userPhotoImg  = root.querySelector("[data-user-photo]");
    const resultImg     = root.querySelector("[data-result-photo]");
    const resultPlaceholder = root.querySelector("[data-result-placeholder]");
    const retryBtn      = root.querySelector("[data-retry-action]");

    if (!launcher || !modal || !input || !primaryAction || !stepUpload || !stepResult) return;

    let uploadedFile = null;
    let userPhotoUrl = null;

    const setOpen = (isOpen) => {
      modal.hidden = !isOpen;
      launcher.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.classList.toggle("fabricvton-block-open", isOpen);
    };

    const showStep = (step) => {
      stepUpload.hidden = step !== "upload";
      stepResult.hidden = step !== "result";
    };

    const setGenerating = (active) => {
      if (generatingEl) generatingEl.hidden = !active;
      if (comparisonEl) comparisonEl.hidden  = active;
    };

    const resetUpload = () => {
      input.value = "";
      uploadedFile = null;
      if (userPhotoUrl) { URL.revokeObjectURL(userPhotoUrl); userPhotoUrl = null; }
      if (uploadThumb)  { uploadThumb.hidden = true; uploadThumb.removeAttribute("src"); }
      if (dropzoneIdle) { dropzoneIdle.hidden = false; }
      primaryAction.disabled = true;
      primaryAction.textContent = "Generate Try-On";
    };

    // ── Open launcher ────────────────────────────────────────────────
    launcher.addEventListener("click", () => {
      resetUpload();
      showStep("upload");
      setOpen(true);
    });

    // ── Close ────────────────────────────────────────────────────────
    closeButtons.forEach((btn) => btn.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) setOpen(false);
    });

    // ── File input ───────────────────────────────────────────────────
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) { resetUpload(); return; }

      if (userPhotoUrl) URL.revokeObjectURL(userPhotoUrl);
      userPhotoUrl = URL.createObjectURL(file);
      uploadedFile = file;

      if (uploadThumb) { uploadThumb.src = userPhotoUrl; uploadThumb.hidden = false; }
      if (dropzoneIdle) dropzoneIdle.hidden = true;

      primaryAction.disabled = false;
      primaryAction.textContent = "Generate Try-On";
    });

    // ── Drag & Drop ──────────────────────────────────────────────────
    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "rgba(124, 58, 237, 0.80)";
        dropzone.style.background  = "rgba(124, 58, 237, 0.10)";
      });
      dropzone.addEventListener("dragleave", () => {
        dropzone.style.borderColor = "";
        dropzone.style.background  = "";
      });
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "";
        dropzone.style.background  = "";
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    // ── Generate Try-On ──────────────────────────────────────────────
    primaryAction.addEventListener("click", async () => {
      if (!uploadedFile) return;

      const productImageUrl = root.dataset.productImage;
      if (!productImageUrl) { alert("No product image found for this item."); return; }

      showStep("result");
      setGenerating(true);

      if (userPhotoImg) { userPhotoImg.src = userPhotoUrl; userPhotoImg.hidden = false; }
      if (resultImg) resultImg.hidden = true;
      if (resultPlaceholder) resultPlaceholder.hidden = false;

      try {
        const formData = new FormData();
        formData.append("customerImage", uploadedFile);
        formData.append("productImageUrl", productImageUrl);

        const response = await fetch("/apps/fabricvton/tryon", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.resultUrl) throw new Error(data.error || "No result URL returned");

        setGenerating(false);
        if (resultImg) { resultImg.src = data.resultUrl; resultImg.hidden = false; }
        if (resultPlaceholder) resultPlaceholder.hidden = true;

      } catch (err) {
        console.error("[FabricVTON Block] Error:", err);
        setGenerating(false);
        showStep("upload");
        alert("Oops — something went wrong. Please try again.");
      }
    });

    // ── Retry ────────────────────────────────────────────────────────
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        resetUpload();
        showStep("upload");
      });
    }

    root.dataset.initialized = "true";
  }

  document.querySelectorAll(rootSelector).forEach(attachBlock);
})();
