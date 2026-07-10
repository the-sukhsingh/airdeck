import { useState } from "react";
import { SaveSlideImage } from "../../wailsjs/go/main/App";

export function usePptxProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const processPptx = async (prezId: string, arrayBuffer: ArrayBuffer): Promise<string[]> => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    const generatedImages: string[] = [];
    let container: HTMLDivElement | null = null;
    let viewer: any = null;

    try {
      // Create hidden rendering container
      container = document.createElement("div");
      container.className = "pptx-render-container pptx-render-container-hidden";
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "-9999px";
      container.style.width = "960px";
      container.style.height = "540px";
      container.style.overflow = "hidden";
      container.style.backgroundColor = "#ffffff";
      container.style.zIndex = "-9999";

      // Inject custom CSS to guarantee pptx-preview's pagination controls and arrows are hidden
      const style = document.createElement("style");
      style.innerHTML = `
        .pptx-render-container-hidden .pptx-preview-wrapper-next,
        .pptx-render-container-hidden .pptx-preview-wrapper-pagination,
        .pptx-render-container-hidden .pptx-preview-wrapper-pre,
        .pptx-render-container-hidden .pptx-preview-wrapper-left,
        .pptx-render-container-hidden .pptx-preview-wrapper-right {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }
        .pptx-render-container-hidden * {
          overflow: visible !important;
        }
      `;
      container.appendChild(style);
      document.body.appendChild(container);

      // Load pptx-preview and html2canvas dynamically
      const pptxPreview = await import("pptx-preview");
      const { default: html2canvas } = await import("html2canvas");

      viewer = pptxPreview.init(container, {
        mode: "slide",
        width: 960,
        height: 540,
      });

      await viewer.preview(arrayBuffer);
      const slideCount = viewer.slideCount;

      if (slideCount <= 0) {
        throw new Error("No slides found in presentation");
      }

      // Sequential asynchronous processing
      for (let i = 0; i < slideCount; i++) {
        try {
          // Render single slide
          viewer.renderSingleSlide(i);

          // 1. Wait for custom web fonts to be fully loaded & applied
          if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
          }

          // 2. Query and wait for all image elements inside the slide to load completely
          if (container) {
            const images = container.querySelectorAll("img");
            await Promise.all(
              Array.from(images).map((img) => {
                if (img.complete) return Promise.resolve();
                return new Promise<void>((resolve) => {
                  img.onload = () => resolve();
                  img.onerror = () => resolve(); // continue even if loading fails
                });
              })
            );
          }

          // 3. Yield control to the event loop to settle dynamic layouts/render styles
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Hide pagination/nav controls if pptx-preview dynamically created them
          if (container) {
            const controls = container.querySelectorAll(
              '[class*="pptx-preview-wrapper-"], [class*="pagination"], [class*="navigation"]'
            );
            controls.forEach((el) => {
              (el as HTMLElement).style.setProperty("display", "none", "important");
            });
          }

          // Capture with html2canvas at high resolution (1920x1080)
          const canvas = await html2canvas(container, {
            width: 960,
            height: 540,
            scale: 2.0, // Scale by 2x for full HD resolution
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            windowWidth: 960,
            windowHeight: 540,
          });

          // Convert to lossless PNG data URL to prevent JPEG compression artifacts
          const dataUrl = canvas.toDataURL("image/png");
          generatedImages.push(dataUrl);

          // Save to Go backend disk storage
          await SaveSlideImage(prezId, i + 1, dataUrl);
        } catch (slideErr) {
          console.error(`Error processing slide ${i + 1}:`, slideErr);
          // Push placeholder to keep sequence indexing intact
          generatedImages.push("");
        }

        // Update progress
        setProgress(Math.round(((i + 1) / slideCount) * 100));
      }

      return generatedImages;
    } catch (err: any) {
      console.error("PPTX conversion failed:", err);
      const errMsg = err.message || "An error occurred during PPTX conversion.";
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      // Cleanup DOM & viewer instances
      if (viewer) {
        try {
          viewer.destroy();
        } catch (e) {
          console.error("Failed to destroy pptx-preview viewer:", e);
        }
      }
      if (container && document.body.contains(container)) {
        document.body.removeChild(container);
      }
      setIsProcessing(false);
    }
  };

  return {
    processPptx,
    isProcessing,
    progress,
    error,
  };
}
