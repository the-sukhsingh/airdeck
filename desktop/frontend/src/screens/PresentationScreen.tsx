import React, { useState, useEffect, useRef } from "react";
import {
  GetPresentationBytes,
  AcceptPairingRequest,
  DenyPairingRequest,
  UpdateCurrentSlide,
  WriteDebugFile,
} from "../../wailsjs/go/main/App";
import { QRCodeSVG } from "qrcode.react";
import {
  Loader2,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { Presentation, SessionInfo, ConnectionRequest } from "../types";

interface PresentationScreenProps {
  activeSession: SessionInfo;
  activePrez: Presentation;
  currentSlide: number;
  setCurrentSlide: (slide: number) => void;
  connState: string;
  pairedDevice: string;
  pendingRequest: ConnectionRequest | null;
  setPendingRequest: (req: ConnectionRequest | null) => void;
  laserPos: { x: number; y: number } | null;
  theme: "light" | "dark";
  toggleTheme: () => void;
  onEndPresentation: () => void;
}

export default function PresentationScreen({
  activeSession,
  activePrez,
  currentSlide,
  setCurrentSlide,
  connState,
  pairedDevice,
  pendingRequest,
  setPendingRequest,
  laserPos,
  theme,
  toggleTheme,
  onEndPresentation,
}: PresentationScreenProps) {
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const presentationContainerRef = useRef<HTMLDivElement>(null);
  const pptxContainerRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<any>(null);

  const [pptxLoading, setPptxLoading] = useState<boolean>(false);
  const [pptxError, setPptxError] = useState<string>(
    window.sessionStorage.getItem("pptxError") || ""
  );
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(
    null
  );
  const [pptxBuffer, setPptxBuffer] = useState<ArrayBuffer | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Capture slide container dimensions for responsive scaling preserving 16:9 aspect ratio
  useEffect(() => {
    if (activePrez.source !== "pptx") return;

    let timeoutId: any = null;

    const handleResize = () => {
      if (slideAreaRef.current) {
        const containerWidth = slideAreaRef.current.clientWidth || 800;
        const containerHeight = slideAreaRef.current.clientHeight || 450;

        // Assume 16:9 aspect ratio for standard widescreen slides
        const targetRatio = 16 / 9;
        const containerRatio = containerWidth / containerHeight;

        let width = containerWidth;
        let height = containerHeight;

        if (containerRatio > targetRatio) {
          // Container is wider than 16:9, limit by height
          width = containerHeight * targetRatio;
          height = containerHeight;
        } else {
          // Container is taller than 16:9, limit by width
          width = containerWidth;
          height = containerWidth / targetRatio;
        }

        setDimensions({ width, height });
      }
    };

    const debouncedResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleResize();
      }, 50);
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      debouncedResize();
    });

    if (slideAreaRef.current) {
      resizeObserver.observe(slideAreaRef.current);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [activePrez]);

  // Load PPTX file bytes from Go backend once when active presentation changes
  useEffect(() => {
    if (activePrez.source !== "pptx") {
      setPptxBuffer(null);
      return;
    }

    let active = true;

    const fetchBytes = async () => {
      setPptxLoading(true);
      setPptxError("");
      try {
        const fileBytes = await GetPresentationBytes(activePrez.id);
        if (!active) return;

        let arrayBuffer: ArrayBuffer;
        if (typeof fileBytes === "string") {
          const binaryString = atob(fileBytes);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer;
        } else {
          const bytes = new Uint8Array(fileBytes);
          arrayBuffer = bytes.buffer;
        }

        setPptxBuffer(arrayBuffer);
      } catch (err: any) {
        console.error("Failed to load PPTX bytes:", err);
        if (active) {
          setPptxError(err.message || "Failed to render PPTX file.");
        }
      } finally {
        if (active) {
          setPptxLoading(false);
        }
      }
    };

    fetchBytes();

    return () => {
      active = false;
    };
  }, [activePrez.id]);

  // Initialize and update pptx-preview viewer when buffer or dimensions change
  useEffect(() => {
    if (!pptxBuffer || !dimensions) return;

    let viewer: any = null;

    const renderPptx = async () => {
      try {
        const pptxPreview = await import("pptx-preview");
        if (pptxContainerRef.current) {
          pptxContainerRef.current.innerHTML = "";

          viewer = pptxPreview.init(pptxContainerRef.current, {
            mode: "slide",
            width: dimensions.width,
            height: dimensions.height,
          });
          previewerRef.current = viewer;

          await viewer.preview(pptxBuffer);
          viewer.renderSingleSlide(currentSlide - 1);
        }
      } catch (err: any) {
        console.error("Failed to render PPTX:", err);
        setPptxError(err.message || "Failed to render PPTX file.");
      }
    };

    renderPptx();

    return () => {
      if (viewer) {
        try {
          viewer.destroy();
        } catch {}
      }
      previewerRef.current = null;
    };
  }, [pptxBuffer, dimensions]);

  // Sync slide change
  useEffect(() => {
    if (
      previewerRef.current &&
      activePrez.source === "pptx" &&
      !pptxLoading &&
      !pptxError
    ) {
      try {
        previewerRef.current.renderSingleSlide(currentSlide - 1);
      } catch (err) {
        console.error("Error rendering slide:", err);
      }
    }
  }, [currentSlide, activePrez, pptxLoading, pptxError]);

  // Debug helper: dump DOM of the slide preview container to a file
  useEffect(() => {
    if (!pptxLoading && !pptxError && pptxContainerRef.current) {
      const timer = setTimeout(() => {
        const html = pptxContainerRef.current?.innerHTML || "";
        WriteDebugFile("dom_dump.html", html).catch((err) =>
          console.error("failed to write debug file", err)
        );
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [pptxLoading, pptxError, currentSlide]);

  const toggleFullscreen = () => {
    if (!slideAreaRef.current) return;

    if (!document.fullscreenElement) {
      slideAreaRef.current.requestFullscreen().catch((err) => {
        console.error("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error("Exit fullscreen error:", err);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const nextSlide = () => {
    const nextIdx = Math.min(activePrez.totalSlides, currentSlide + 1);
    UpdateCurrentSlide(nextIdx);
    setCurrentSlide(nextIdx);
  };

  const prevSlide = () => {
    const prevIdx = Math.max(1, currentSlide - 1);
    UpdateCurrentSlide(prevIdx);
    setCurrentSlide(prevIdx);
  };

  // Keyboard navigation during presentation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Space") {
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        prevSlide();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onEndPresentation();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePrez, currentSlide]);

  const currentSlideData = activePrez.slides.find(
    (s) => s.index === currentSlide
  );
  const progressPercent =
    activePrez.totalSlides > 0
      ? (currentSlide / activePrez.totalSlides) * 100
      : 0;

  return (
    <div
      ref={presentationContainerRef}
      className="container"
      style={{ flexDirection: "column", position: "relative" }}
    >
      {/* Presenter Top Bar */}
      <div
        style={{
          height: "64px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--space-xl)",
          backgroundColor: "var(--bg-secondary)",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            ACTIVE SESSION
          </span>
          <span style={{ fontWeight: "600", fontSize: "14px" }}>
            {activePrez.name}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <span className={`badge ${connState === "connected" ? "badge-active" : ""}`}>
              {connState}
            </span>
            {connState === "connected" && (
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                remote: <strong>{pairedDevice}</strong>
              </span>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            className="btn-icon"
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            style={{ width: "32px", height: "32px" }}
          >
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          </button>

          <button className="btn btn-danger btn-small" onClick={onEndPresentation}>
            End Presentation
          </button>
        </div>
      </div>

      {/* Presenter Layout Split */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Slide Visualizer */}
        <div
          style={{
            flex: 1.6,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            padding: "var(--space-xl)",
            backgroundColor: "var(--bg-primary)",
            gap: "var(--space-lg)",
            transition: "background-color 0.2s ease",
          }}
        >
          {/* Visualizer Frame */}
          <div
            ref={slideAreaRef}
            onDoubleClick={toggleFullscreen}
            style={
              isFullscreen
                ? {
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "zoom-out",
                  }
                : {
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    backgroundColor: "#000",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-medium)",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "zoom-in",
                  }
            }
          >
            {/* Floating Fullscreen Toggle Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                zIndex: 99,
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                borderRadius: "var(--radius-subtle)",
              }}
              title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            {activePrez.source === "google" && activePrez.googleSlidesUrl ? (
              <iframe
                src={activePrez.googleSlidesUrl}
                frameBorder="0"
                width="100%"
                height="100%"
                allowFullScreen={true}
                style={{ pointerEvents: "none" }}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              /* pptx-preview visual container */
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {pptxLoading && (
                  <div
                    style={{
                      position: "absolute",
                      zIndex: 10,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Loader2 className="animate-spin" size={24} style={{ color: "#fff" }} />
                    <span style={{ fontSize: "12px" }}>Loading slide...</span>
                  </div>
                )}
                {pptxError && (
                  <div
                    style={{
                      color: "var(--accent-red)",
                      padding: "var(--space-md)",
                      fontSize: "12px",
                      textAlign: "center",
                    }}
                  >
                    {pptxError}
                  </div>
                )}
                <div
                  ref={pptxContainerRef}
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  className="pptx-render-container"
                />
              </div>
            )}

            {/* Laser Pointer overlay */}
            {laserPos && slideAreaRef.current && dimensions && (
              <div
                style={{
                  position: "absolute",
                  left: `${
                    (slideAreaRef.current.clientWidth - dimensions.width) / 2 +
                    laserPos.x * dimensions.width
                  }px`,
                  top: `${
                    (slideAreaRef.current.clientHeight - dimensions.height) / 2 +
                    laserPos.y * dimensions.height
                  }px`,
                  width: "12px",
                  height: "12px",
                  backgroundColor: "red",
                  borderRadius: "50%",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  zIndex: 9999,
                }}
              />
            )}
          </div>

          {/* Slide Navigation & Progress */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {/* Flat Progress bar */}
            <div style={{ height: "3px", backgroundColor: "var(--bg-tertiary)", width: "100%" }}>
              <div
                style={{
                  height: "100%",
                  backgroundColor: "var(--text-primary)",
                  width: `${progressPercent}%`,
                  transition: "width 0.2s ease",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                <button
                  className="btn btn-small"
                  onClick={prevSlide}
                  disabled={currentSlide === 1}
                >
                  <ChevronLeft size={16} /> PREV
                </button>
                <button
                  className="btn btn-small"
                  onClick={nextSlide}
                  disabled={currentSlide === activePrez.totalSlides}
                >
                  NEXT <ChevronRight size={16} />
                </button>
              </div>

              <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}>
                SLIDE {currentSlide} OF {activePrez.totalSlides}
              </div>
            </div>
          </div>
        </div>

        {/* Presenter Metadata, Room, and Notes Panel */}
        <div
          style={{
            width: "360px",
            borderLeft: "1px solid var(--border-color)",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--bg-secondary)",
            padding: "var(--space-xl)",
            gap: "var(--space-xl)",
            overflowY: "auto",
            transition: "background-color 0.2s ease, border-color 0.2s ease",
          }}
        >
          {/* Session Pairing details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <h3 style={{ fontSize: "10px" }}>Pair Mobile App</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
              <div
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-subtle)",
                  padding: "var(--space-md)",
                  backgroundColor: "var(--bg-primary)",
                  transition: "background-color 0.2s ease, border-color 0.2s ease",
                }}
              >
                <span style={{ fontSize: "9px", color: "var(--text-secondary)", fontWeight: 500 }}>
                  ROOM ID
                </span>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "600",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-primary)",
                    marginTop: "4px",
                  }}
                >
                  {activeSession.roomId}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-subtle)",
                  padding: "var(--space-md)",
                  backgroundColor: "var(--bg-primary)",
                  transition: "background-color 0.2s ease, border-color 0.2s ease",
                }}
              >
                <span style={{ fontSize: "9px", color: "var(--text-secondary)", fontWeight: 500 }}>
                  PASSCODE
                </span>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "600",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-primary)",
                    marginTop: "4px",
                  }}
                >
                  {activeSession.passcode}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-medium)",
                padding: "12px",
                backgroundColor: "#ffffff",
                alignSelf: "center",
                margin: "8px 0",
              }}
            >
              <QRCodeSVG
                value={JSON.stringify({
                  ips: activeSession.localIps,
                  port: activeSession.signalingPort,
                  roomId: activeSession.roomId,
                  passcode: activeSession.passcode,
                })}
                size={120}
                level="M"
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-xs)",
                marginTop: "var(--space-xs)",
              }}
            >
              <span style={{ fontSize: "9px", color: "var(--text-secondary)", fontWeight: 500 }}>
                WiFi LOCAL IPs
              </span>
              {activeSession.localIps.map((ip) => (
                <code key={ip} style={{ fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                  {ip}:{activeSession.signalingPort}
                </code>
              ))}
            </div>
          </div>

          {/* Speaker Notes */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <h3 style={{ fontSize: "10px" }}>Speaker Notes</h3>
            <div
              style={{
                flex: 1,
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-subtle)",
                padding: "var(--space-md)",
                backgroundColor: "var(--bg-tertiary)",
                fontSize: "13px",
                lineHeight: "1.6",
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                overflowY: "auto",
                transition: "background-color 0.2s ease, border-color 0.2s ease",
              }}
            >
              {currentSlideData?.notes || "No notes available for this slide."}
            </div>
          </div>
        </div>
      </div>

      {/* Pairing Request Dialog Prompt */}
      {pendingRequest && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px" }}>
            <h2 style={{ letterSpacing: "-0.01em" }}>Connection Request</h2>
            <p>
              A device named <strong>{pendingRequest.deviceName}</strong> is trying to connect.
            </p>
            <div
              style={{
                border: "1px solid var(--border-color)",
                padding: "var(--space-md)",
                backgroundColor: "var(--bg-tertiary)",
                borderRadius: "var(--radius-subtle)",
              }}
            >
              <span style={{ fontSize: "9px", color: "var(--text-secondary)", fontWeight: 500 }}>
                SECURITY FINGERPRINT
              </span>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  fontFamily: "var(--font-mono)",
                  marginTop: "4px",
                }}
              >
                {pendingRequest.fingerprint}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-md)" }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  AcceptPairingRequest();
                  setPendingRequest(null);
                }}
              >
                Accept
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => {
                  DenyPairingRequest();
                  setPendingRequest(null);
                }}
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
