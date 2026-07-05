import React, { useState, useEffect, useRef } from "react";
import {
  GetPresentationBytes,
  AcceptPairingRequest,
  DenyPairingRequest,
  UpdateCurrentSlide,
  WriteDebugFile,
  GetSlideImage,
} from "../../wailsjs/go/main/App";
import { QRCodeSVG } from "qrcode.react";
import { WindowFullscreen, WindowUnfullscreen, EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
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

interface Point {
  x: number;
  y: number;
}

interface DrawPath {
  id: string;
  tool: "pen" | "highlighter" | "eraser";
  color: string;
  points: Point[];
}

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
  const [slideImage, setSlideImage] = useState<string>("");
  const [imageLoading, setImageLoading] = useState<boolean>(false);

  const [slideDrawings, setSlideDrawings] = useState<Record<number, DrawPath[]>>({});
  const [activePath, setActivePath] = useState<DrawPath | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Laser Pointer with glowing trail history
  const [laserHistory, setLaserHistory] = useState<{ x: number; y: number }[]>([]);
  const [localLaserPos, setLocalLaserPos] = useState<{ x: number; y: number } | null>(null);

  const currentSlideRef = useRef(currentSlide);
  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  const activePathRef = useRef<DrawPath | null>(null);
  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  // Listen for Laser events
  useEffect(() => {
    EventsOn("laser-move", (pos: { x: number; y: number }) => {
      setLocalLaserPos(pos);
      setLaserHistory((prev) => {
        const next = [...prev, pos];
        if (next.length > 8) {
          next.shift();
        }
        return next;
      });
    });

    EventsOn("laser-hide", () => {
      setLocalLaserPos(null);
      setLaserHistory([]);
    });

    return () => {
      EventsOff("laser-move");
      EventsOff("laser-hide");
    };
  }, []);

  function distanceToSegment(
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) {
      return Math.hypot(p.x - a.x, p.y - a.y);
    }
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    if (t < 0) return Math.hypot(p.x - a.x, p.y - a.y);
    if (t > 1) return Math.hypot(p.x - b.x, p.y - b.y);
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  const erasePathsNear = (x: number, y: number, slideIdx: number) => {
    const threshold = 0.03; // 3%
    setSlideDrawings((prev) => {
      const paths = prev[slideIdx] || [];
      const filtered = paths.filter((path) => {
        for (let i = 0; i < path.points.length - 1; i++) {
          const dist = distanceToSegment({ x, y }, path.points[i], path.points[i + 1]);
          if (dist < threshold) return false;
        }
        if (path.points.length === 1) {
          const dist = Math.hypot(path.points[0].x - x, path.points[0].y - y);
          if (dist < threshold) return false;
        }
        return true;
      });
      return {
        ...prev,
        [slideIdx]: filtered,
      };
    });
  };

  // Listen for Draw events
  useEffect(() => {
    EventsOn("draw-start", (data: any) => {
      const slideIdx = currentSlideRef.current;
      if (data.tool === "eraser") {
        erasePathsNear(data.x, data.y, slideIdx);
      } else {
        const id = Math.random().toString(36).substr(2, 9);
        const newPath: DrawPath = {
          id,
          tool: data.tool || "pen",
          color: data.color || "red",
          points: [{ x: data.x, y: data.y }]
        };
        setActivePath(newPath);
      }
    });

    EventsOn("draw-move", (data: any) => {
      const slideIdx = currentSlideRef.current;
      if (activePathRef.current) {
        setActivePath((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            points: [...prev.points, { x: data.x, y: data.y }]
          };
        });
      } else {
        erasePathsNear(data.x, data.y, slideIdx);
      }
    });

    EventsOn("draw-end", () => {
      const slideIdx = currentSlideRef.current;
      if (activePathRef.current) {
        const path = activePathRef.current;
        setSlideDrawings((prev) => {
          const paths = prev[slideIdx] || [];
          return {
            ...prev,
            [slideIdx]: [...paths, path]
          };
        });
        setActivePath(null);
      }
    });

    EventsOn("draw-clear", () => {
      const slideIdx = currentSlideRef.current;
      setSlideDrawings((prev) => ({
        ...prev,
        [slideIdx]: []
      }));
    });

    return () => {
      EventsOff("draw-start");
      EventsOff("draw-move");
      EventsOff("draw-end");
      EventsOff("draw-clear");
    };
  }, []);

  // Redraw Canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dimensions) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const paths = slideDrawings[currentSlide] || [];
    const allPaths = activePath ? [...paths, activePath] : paths;

    allPaths.forEach((path) => {
      if (path.points.length === 0) return;
      ctx.beginPath();

      if (path.tool === "highlighter") {
        ctx.strokeStyle = "rgba(254, 240, 138, 0.4)"; // highlighter yellow
        ctx.lineWidth = 18;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = 0.5;
        ctx.globalCompositeOperation = "multiply";
      } else {
        const colorMap: Record<string, string> = {
          red: "#ef4444",
          blue: "#3b82f6",
          green: "#22c55e",
        };
        ctx.strokeStyle = colorMap[path.color] || path.color || "#ef4444";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = "source-over";
      }

      const p0 = path.points[0];
      ctx.moveTo(p0.x * dimensions.width, p0.y * dimensions.height);
      for (let i = 1; i < path.points.length; i++) {
        const p = path.points[i];
        ctx.lineTo(p.x * dimensions.width, p.y * dimensions.height);
      }
      ctx.stroke();
    });

    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";
  }, [slideDrawings, activePath, currentSlide, dimensions]);

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

  // Load slide image if available
  useEffect(() => {
    if (activePrez.source !== "pptx") return;

    let active = true;
    const fetchImage = async () => {
      setImageLoading(true);
      try {
        const base64Data = await GetSlideImage(activePrez.id, currentSlide);
        if (active) {
          setSlideImage(`data:image/png;base64,${base64Data}`);
        }
      } catch (err) {
        console.log("Slide image not available, falling back to pptx-preview:", err);
        if (active) {
          setSlideImage("");
        }
      } finally {
        if (active) {
          setImageLoading(false);
        }
      }
    };

    fetchImage();
    return () => {
      active = false;
    };
  }, [activePrez.id, currentSlide]);

  // Initialize and update pptx-preview viewer when buffer or dimensions change
  useEffect(() => {
    if (slideImage) return; // Skip if we have an image
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
        const errMsg = err.message || "";
        const isNonFatal = errMsg.includes("undefined") || errMsg.includes("null") || errMsg.includes("background");
        if (!isNonFatal) {
          setPptxError(errMsg || "Failed to render PPTX file.");
        } else {
          console.warn("Muted non-fatal rendering layout error:", errMsg);
        }
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
    if (slideImage) return; // Skip if we have an image
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
    if (isFullscreen) {
      WindowUnfullscreen();
      setIsFullscreen(false);
    } else {
      WindowFullscreen();
      setIsFullscreen(true);
    }
  };

  // Reset native window fullscreen on unmount
  useEffect(() => {
    return () => {
      WindowUnfullscreen();
    };
  }, []);

  // Listen to remote fullscreen toggle events
  useEffect(() => {
    EventsOn("toggle-fullscreen", () => {
      toggleFullscreen();
    });
    return () => {
      EventsOff("toggle-fullscreen");
    };
  }, [isFullscreen]);

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
        if (isFullscreen) {
          WindowUnfullscreen();
          setIsFullscreen(false);
        } else {
          onEndPresentation();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePrez, currentSlide, isFullscreen]);

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
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    backgroundColor: "#000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "none",
                    zIndex: 9999,
                  }
                : {
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    backgroundColor: "#000",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-large)",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "none",
                  }
            }
          >
            {/* Floating Fullscreen Toggle Button */}
            {!isFullscreen && (
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
                borderRadius: "var(--radius-full)",
              }}
              title={"Enter Fullscreen (F)"}
            >
              <Maximize2 size={14} />
            </button>
            )}
            {activePrez.source === "google" && activePrez.googleSlidesUrl ? (
              <iframe
                src={`${activePrez.googleSlidesUrl.split('#')[0]}#slide=${currentSlide}`}
                frameBorder="0"
                width="100%"
                height="100%"
                allowFullScreen={true}
                style={{ pointerEvents: "auto" }}
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
                {slideImage ? (
                  <img
                    src={slideImage}
                    alt={`Slide ${currentSlide}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                ) : (
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
                )}
              </div>
            )}

            {/* Drawing Canvas Overlay */}
            {dimensions && slideAreaRef.current && (
              <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                style={{
                  position: "absolute",
                  left: `${(slideAreaRef.current.clientWidth - dimensions.width) / 2}px`,
                  top: `${(slideAreaRef.current.clientHeight - dimensions.height) / 2}px`,
                  width: `${dimensions.width}px`,
                  height: `${dimensions.height}px`,
                  pointerEvents: "none",
                  zIndex: 9990,
                }}
              />
            )}

            {/* Laser Pointer & Glowing Tail Overlay */}
            {slideAreaRef.current && dimensions && (laserHistory.length > 0 || localLaserPos) && (
              <svg
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  zIndex: 9995,
                }}
              >
                {/* Laser Tail */}
                {laserHistory.map((point, index) => {
                  if (index === 0) return null;
                  const prevPoint = laserHistory[index - 1];
                  const x1 = (slideAreaRef.current!.clientWidth - dimensions.width) / 2 + prevPoint.x * dimensions.width;
                  const y1 = (slideAreaRef.current!.clientHeight - dimensions.height) / 2 + prevPoint.y * dimensions.height;
                  const x2 = (slideAreaRef.current!.clientWidth - dimensions.width) / 2 + point.x * dimensions.width;
                  const y2 = (slideAreaRef.current!.clientHeight - dimensions.height) / 2 + point.y * dimensions.height;

                  const opacity = (index / laserHistory.length) * 0.7;
                  const strokeWidth = (index / laserHistory.length) * 5 + 1.5;

                  return (
                    <line
                      key={index}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="red"
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      opacity={opacity}
                      style={{ filter: "drop-shadow(0px 0px 3px rgba(255, 0, 0, 0.8))" }}
                    />
                  );
                })}

                {/* Glowing Laser Dot */}
                {localLaserPos && (
                  <>
                    <circle
                      cx={(slideAreaRef.current.clientWidth - dimensions.width) / 2 + localLaserPos.x * dimensions.width}
                      cy={(slideAreaRef.current.clientHeight - dimensions.height) / 2 + localLaserPos.y * dimensions.height}
                      r={7}
                      fill="red"
                      style={{ filter: "drop-shadow(0px 0px 5px rgba(255, 0, 0, 0.9))" }}
                    />
                    <circle
                      cx={(slideAreaRef.current.clientWidth - dimensions.width) / 2 + localLaserPos.x * dimensions.width}
                      cy={(slideAreaRef.current.clientHeight - dimensions.height) / 2 + localLaserPos.y * dimensions.height}
                      r={2}
                      fill="white"
                    />
                  </>
                )}
              </svg>
            )}
          </div>

          {/* Slide Navigation & Progress */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {/* Rounded Progress bar */}
            <div style={{ height: "4px", backgroundColor: "var(--bg-tertiary)", width: "100%", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  backgroundColor: "var(--text-primary)",
                  width: `${progressPercent}%`,
                  transition: "width 0.2s ease",
                  borderRadius: "var(--radius-full)",
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
            width: "400px",
            borderLeft: "1px solid var(--border-color)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            backgroundColor: "var(--bg-secondary)",
            padding: "var(--space-lg)",
            gap: "var(--space-lg)",
            overflowY: "auto",
            transition: "background-color 0.2s ease, border-color 0.2s ease",
          }}

        >
          {/* QR Code Container */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-xs)" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Pair Remote
            </span>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-large)",
                padding: "12px",
                backgroundColor: "#ffffff",
                marginTop: "4px",
              }}
            >
              <QRCodeSVG
                value={JSON.stringify({
                  ips: activeSession.localIps,
                  port: activeSession.signalingPort,
                  roomId: activeSession.roomId,
                  passcode: activeSession.passcode,
                })}
                size={160}
                level="M"
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>
          </div>

          {/* Connection Request Area / Status */}
          <div style={{ width: "100%", marginTop: "var(--space-md)" }}>
            {pendingRequest ? (
              <div
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-large)",
                  padding: "var(--space-md)",
                  backgroundColor: "var(--bg-primary)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-sm)",
                  boxShadow: "var(--shadow-subtle)",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>
                  Pairing Request
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  Device: <strong>{pendingRequest.deviceName}</strong>
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    fontFamily: "var(--font-mono)",
                    backgroundColor: "var(--bg-tertiary)",
                    padding: "4px 8px",
                    borderRadius: "var(--radius-subtle)",
                    textAlign: "center",
                  }}
                >
                  Code: {pendingRequest.fingerprint}
                </div>
                <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "4px" }}>
                  <button
                    className="btn btn-primary btn-small"
                    style={{ flex: 1, padding: "6px" }}
                    onClick={() => {
                      AcceptPairingRequest();
                      setPendingRequest(null);
                    }}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    style={{ flex: 1, padding: "6px" }}
                    onClick={() => {
                      DenyPairingRequest();
                      setPendingRequest(null);
                    }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ) : connState === "connected" ? (
              <div style={{ textAlign: "center", color: "var(--accent-green)", fontSize: "12px", fontWeight: 500 }}>
                ✓ Connected to {pairedDevice}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "11px" }}>
                Scan to control slides
              </div>
            )}
          </div>

          {/* Speaker Notes Area */}
          <div style={{ width: "100%", marginTop: "var(--space-md)", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>
              Speaker Notes
            </span>
            <div
              style={{
                flex: 1,
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-large)",
                padding: "var(--space-md)",
                backgroundColor: "var(--bg-primary)",
                overflowY: "auto",
              }}
            >
              <p style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
                {currentSlideData?.notes || "No notes for this slide."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
