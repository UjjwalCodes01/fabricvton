(function () {
  "use strict";

  const rootSelector = ".fabricvton-try-on";

  function attachTryOn(root) {
    if (!root || root.dataset.initialized === "true") return;

    // ── DOM refs ────────────────────────────────────────────────────
    const launcher      = root.querySelector(".fabricvton-try-on__launcher");
    const modal         = root.querySelector(".fabricvton-try-on__modal");
    const closeButtons  = root.querySelectorAll("[data-close-modal]");
    const input         = root.querySelector(".fabricvton-try-on__input");
    const dropzone      = root.querySelector("[data-dropzone]");
    const dropzoneIdle  = root.querySelector("[data-dropzone-idle]");
    const uploadThumb   = root.querySelector("[data-upload-thumb]");
    const primaryAction = root.querySelector("[data-primary-action]");

    // Step panels
    const stepUpload = root.querySelector("[data-step='upload']");
    const stepResult = root.querySelector("[data-step='result']");

    // Result step nodes
    const generatingEl  = root.querySelector("[data-generating]");
    const comparisonEl  = root.querySelector("[data-comparison]");
    const userPhotoImg  = root.querySelector("[data-user-photo]");
    const resultImg     = root.querySelector("[data-result-photo]");
    const resultPlaceholder = root.querySelector("[data-result-placeholder]");
    const retryBtn      = root.querySelector("[data-retry-action]");

    // Guard: bail if essential elements are missing
    if (
      !launcher || !modal || !input || !primaryAction ||
      !stepUpload || !stepResult || !generatingEl || !comparisonEl
    ) return;

    // ── State ────────────────────────────────────────────────────────
    let uploadedFile = null;
    let userPhotoUrl = null; // object URL for uploaded photo

    // ── Helpers ──────────────────────────────────────────────────────
    const setOpen = (isOpen) => {
      modal.hidden = !isOpen;
      launcher.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.classList.toggle("fabricvton-try-on-open", isOpen);
    };

    const showStep = (step) => {
      stepUpload.hidden = step !== "upload";
      stepResult.hidden = step !== "result";
    };

    const setGenerating = (active) => {
      generatingEl.hidden = !active;
      comparisonEl.hidden  = active;
    };

    const resetUpload = () => {
      // Clear the file input
      input.value = "";
      uploadedFile = null;
      if (userPhotoUrl) URL.revokeObjectURL(userPhotoUrl);
      userPhotoUrl = null;

      // Reset the dropzone to idle
      if (uploadThumb)   { uploadThumb.hidden = true; uploadThumb.removeAttribute("src"); }
      if (dropzoneIdle)  { dropzoneIdle.hidden = false; }

      // Disable primary action
      primaryAction.disabled = true;
      primaryAction.textContent = "Generate Try-On";
      primaryAction.prepend(makePlusSvg());
    };

    function makePlusSvg() {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 20 20");
      svg.setAttribute("fill", "currentColor");
      svg.setAttribute("aria-hidden", "true");
      svg.innerHTML = '<path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z"/>';
      return svg;
    }

    // ── Launcher ────────────────────────────────────────────────────
    launcher.addEventListener("click", () => {
      resetUpload();
      showStep("upload");
      setOpen(true);
    });

    // ── Close ───────────────────────────────────────────────────────
    closeButtons.forEach((btn) => btn.addEventListener("click", () => setOpen(false)));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) setOpen(false);
    });

    // ── File input: show thumb preview ──────────────────────────────
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) { resetUpload(); return; }

      // Revoke previous object URL to avoid memory leak
      if (userPhotoUrl) URL.revokeObjectURL(userPhotoUrl);
      userPhotoUrl = URL.createObjectURL(file);
      uploadedFile = file;

      // Show thumbnail inside dropzone
      if (uploadThumb) {
        uploadThumb.src = userPhotoUrl;
        uploadThumb.hidden = false;
      }
      if (dropzoneIdle) dropzoneIdle.hidden = true;

      // Enable the generate button
      primaryAction.disabled = false;
      primaryAction.innerHTML = "";
      primaryAction.textContent = "Generate Try-On";
    });

    // ── Drag-and-drop onto the label ────────────────────────────────
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
          // Assign to the hidden input and fire its change event
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    // ── Generate Try-On ─────────────────────────────────────────────
    primaryAction.addEventListener("click", async () => {
      if (!uploadedFile) return;

      const productImageUrl = root.dataset.productImage;
      if (!productImageUrl) {
        alert("No product image found for this item.");
        return;
      }

      // 1️⃣ Show result step with generating overlay
      showStep("result");
      setGenerating(true);

      // Pre-fill user photo panel immediately (instant feedback)
      if (userPhotoImg) {
        userPhotoImg.src = userPhotoUrl;
        userPhotoImg.hidden = false;
      }

      // Keep result placeholder shimmering while we wait
      if (resultImg) resultImg.hidden = true;
      if (resultPlaceholder) resultPlaceholder.hidden = false;

      try {
        // 2️⃣ POST to Shopify App Proxy → our backend
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

        // 3️⃣ Reveal the comparison panels
        setGenerating(false);
        if (resultImg) {
          resultImg.src = data.resultUrl;
          resultImg.hidden = false;
        }
        if (resultPlaceholder) resultPlaceholder.hidden = true;

      } catch (err) {
        console.error("[FabricVTON] Try-On error:", err);
        setGenerating(false);
        showStep("upload");
        alert("Oops — something went wrong generating your try-on. Please try again.");
      }
    });

    // ── Retry → go back to upload step ─────────────────────────────
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        resetUpload();
        showStep("upload");
      });
    }

    root.dataset.initialized = "true";
  }

  document.querySelectorAll(rootSelector).forEach(attachTryOn);
})();
