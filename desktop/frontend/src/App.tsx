import React, { useState, useEffect, useRef } from "react";
import {
  IsStorageInitialized,
  InitializeStorage,
  UnlockStorage,
  LockStorage,
  GetLibrary,
  StarPresentation,
  DeletePresentation,
  MovePresentationToFolder,
  SelectAndUploadPresentation,
  AddGoogleSlidesLink,
  GetPresentationBytes,
  StartPresentationSession,
  EndPresentationSession,
  AcceptPairingRequest,
  DenyPairingRequest,
  UpdateCurrentSlide,
  WriteDebugFile
} from "../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../wailsjs/runtime/runtime";
import { QRCodeSVG } from "qrcode.react";
import { 
  Tv, 
  FolderPlus, 
  Trash2, 
  Star, 
  Upload, 
  Link2, 
  Lock, 
  Unlock, 
  Settings, 
  ArrowRight, 
  Play, 
  X, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Compass,
  Loader2,
  Maximize2,
  Minimize2
} from "lucide-react";

// Types corresponding to Go storage module
interface SlideData {
  index: number;
  title: string;
  notes: string;
  texts?: string[];
}

interface Presentation {
  id: string;
  name: string;
  source: string;
  filePath?: string;
  googleSlidesUrl?: string;
  isStarred: boolean;
  folder: string;
  totalSlides: number;
  slides: SlideData[];
  createdAt: number;
}

interface ConnectionRequest {
  deviceName: string;
  fingerprint: string;
}

interface SessionInfo {
  roomId: string;
  passcode: string;
  localIps: string[];
  signalingPort: number;
  presentationName: string;
}

export default function App() {
  // App States
  const [locked, setLocked] = useState<boolean>(true);
  const [hasDb, setHasDb] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  
  // Library States
  const [library, setLibrary] = useState<Presentation[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [folders, setFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [showAddFolderModal, setShowAddFolderModal] = useState<boolean>(false);
  const [showGoogleLinkModal, setShowGoogleLinkModal] = useState<boolean>(false);
  
  // Google Slides Form
  const [gSlidesName, setGSlidesName] = useState<string>("");
  const [gSlidesUrl, setGSlidesUrl] = useState<string>("");
  
  // Active Presentation Session State
  const [activeSession, setActiveSession] = useState<SessionInfo | null>(null);
  const [activePrez, setActivePrez] = useState<Presentation | null>(null);
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const [pairedDevice, setPairedDevice] = useState<string>("");
  const [connState, setConnState] = useState<string>("disconnected"); // "disconnected", "connecting", "connected"
  const [pendingRequest, setPendingRequest] = useState<ConnectionRequest | null>(null);
  const [laserPos, setLaserPos] = useState<{x: number, y: number} | null>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const presentationContainerRef = useRef<HTMLDivElement>(null);
  
  // pptx-preview states & refs
  const pptxContainerRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<any>(null);
  const [pptxLoading, setPptxLoading] = useState<boolean>(false);
  const [pptxError, setPptxError] = useState<string>(window.sessionStorage.getItem("pptxError") || "");
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [pptxBuffer, setPptxBuffer] = useState<ArrayBuffer | null>(null);

  // Capture slide container dimensions for responsive scaling preserving 16:9 aspect ratio
  useEffect(() => {
    if (!activeSession || activePrez?.source !== "pptx") return;

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

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (slideAreaRef.current) {
      resizeObserver.observe(slideAreaRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeSession, activePrez]);

  // Load PPTX file bytes from Go backend once when active presentation changes
  useEffect(() => {
    if (!activeSession || !activePrez || activePrez.source !== "pptx") {
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
  }, [activeSession, activePrez?.id]);

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
            height: dimensions.height
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
    if (previewerRef.current && activePrez?.source === "pptx" && !pptxLoading && !pptxError) {
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
        WriteDebugFile("dom_dump.html", html).catch(err => console.error("failed to write debug file", err));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [pptxLoading, pptxError, currentSlide]);

  // Initial check on boot
  useEffect(() => {
    checkStorageStatus();
  }, []);

  const checkStorageStatus = async () => {
    try {
      const initialized = await IsStorageInitialized();
      setHasDb(initialized);
    } catch (err) {
      console.error(err);
    }
  };

  // Set up listeners for events broadcasted by Go backend
  useEffect(() => {
    if (!locked) {
      EventsOn("connection-request", (data: ConnectionRequest) => {
        setPendingRequest(data);
      });

      EventsOn("paired-device", (name: string) => {
        setPairedDevice(name);
        if (name) {
          setConnState("connected");
        } else {
          setConnState("disconnected");
        }
      });

      EventsOn("connection-state", (state: string) => {
        setConnState(state);
      });

      EventsOn("slide-change", (index: number) => {
        setCurrentSlide(index);
      });

      EventsOn("laser-move", (pos: {x: number, y: number}) => {
        setLaserPos(pos);
      });

      EventsOn("laser-hide", () => {
        setLaserPos(null);
      });

      return () => {
        EventsOff("connection-request");
        EventsOff("paired-device");
        EventsOff("connection-state");
        EventsOff("slide-change");
        EventsOff("laser-move");
        EventsOff("laser-hide");
      };
    }
  }, [locked]);

  // Load Library Data
  const loadLibrary = async () => {
    try {
      const list = await GetLibrary();
      setLibrary(list || []);
      
      // Extract unique folder names
      const folderSet = new Set<string>();
      list?.forEach(p => {
        if (p.folder) folderSet.add(p.folder);
      });
      setFolders(Array.from(folderSet));
    } catch (err) {
      console.error("Failed to load library", err);
    }
  };

  // Auth Handlers
  const handleCreateStorage = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Passphrase must be at least 6 characters.");
      return;
    }
    try {
      await InitializeStorage(password);
      setLocked(false);
      setHasDb(true);
      loadLibrary();
    } catch (err: any) {
      setAuthError(err.message || "Failed to initialize storage.");
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const success = await UnlockStorage(password);
      if (success) {
        setLocked(false);
        loadLibrary();
      } else {
        setAuthError("Invalid passphrase.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to unlock.");
    }
  };

  const handleLock = async () => {
    await LockStorage();
    setLocked(true);
    setPassword("");
    setConfirmPassword("");
    setLibrary([]);
  };

  // Library Handlers
  const handleUpload = async () => {
    try {
      await SelectAndUploadPresentation();
      loadLibrary();
    } catch (err: any) {
      console.error("Upload failed:", err);
    }
  };

  const handleAddGoogleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gSlidesName || !gSlidesUrl) return;
    
    try {
      // Clean up google url if needed (make sure it's embed format)
      let cleanedUrl = gSlidesUrl;
      const match = gSlidesUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        cleanedUrl = `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
      }
      
      await AddGoogleSlidesLink(gSlidesName, cleanedUrl);
      setShowGoogleLinkModal(false);
      setGSlidesName("");
      setGSlidesUrl("");
      loadLibrary();
    } catch (err: any) {
      console.error("Add Google Slides URL failed:", err);
    }
  };

  const handleStar = async (id: string, starState: boolean) => {
    try {
      await StarPresentation(id, !starState);
      loadLibrary();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await DeletePresentation(id);
      loadLibrary();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveToFolder = async (id: string, folder: string) => {
    try {
      await MovePresentationToFolder(id, folder);
      loadLibrary();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddFolder = () => {
    if (!newFolderName.trim()) return;
    if (!folders.includes(newFolderName)) {
      setFolders([...folders, newFolderName]);
    }
    setNewFolderName("");
    setShowAddFolderModal(false);
  };

  // Presentation Session Handlers
  const startPresenting = async (p: Presentation) => {
    try {
      const session = await StartPresentationSession(p.id);
      setActivePrez(p);
      setActiveSession(session);
      setCurrentSlide(1);
      setPairedDevice("");
      setConnState("disconnected");
      setLaserPos(null);
    } catch (err: any) {
      console.error(err);
      alert("Failed to start presentation: " + (err.message || err));
    }
  };

  const endPresenting = () => {
    EndPresentationSession();
    setActiveSession(null);
    setActivePrez(null);
    loadLibrary();
  };

  const nextSlide = () => {
    if (!activePrez) return;
    const nextIdx = Math.min(activePrez.totalSlides, currentSlide + 1);
    UpdateCurrentSlide(nextIdx);
    setCurrentSlide(nextIdx);
  };

  const prevSlide = () => {
    if (!activePrez) return;
    const prevIdx = Math.max(1, currentSlide - 1);
    UpdateCurrentSlide(prevIdx);
    setCurrentSlide(prevIdx);
  };

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = () => {
    if (!presentationContainerRef.current) return;

    if (!document.fullscreenElement) {
      presentationContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Fullscreen error:", err);
      });
    } else {
      const promise = document.exitFullscreen();
      if (promise && typeof promise.then === "function") {
        promise.then(() => {
          setTimeout(() => setIsFullscreen(false), 150);
        }).catch(() => {
          setIsFullscreen(false);
        });
      } else {
        setTimeout(() => setIsFullscreen(false), 150);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      if (!isFull) {
        setTimeout(() => setIsFullscreen(false), 150);
      } else {
        setIsFullscreen(true);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keyboard navigation during presentation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activePrez) return;
      if (e.key === "ArrowRight" || e.key === "Space") {
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        prevSlide();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) {
          const promise = document.exitFullscreen();
          if (promise && typeof promise.then === "function") {
            promise.then(() => {
              setTimeout(() => setIsFullscreen(false), 150);
            }).catch(() => {
              setIsFullscreen(false);
            });
          } else {
            setTimeout(() => setIsFullscreen(false), 150);
          }
        } else {
          endPresenting();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePrez, currentSlide]);

  // Filtering Library
  const filteredLibrary = library.filter(p => {
    if (currentFolder === "") return true;
    if (currentFolder === "starred") return p.isStarred;
    return p.folder === currentFolder;
  });

  // Render LOCK SCREEN
  if (locked) {
    return (
      <div className="modal-overlay" style={{ background: "var(--bg-primary)" }}>
        <div className="modal-content" style={{ maxWidth: "380px", padding: "var(--space-xxl) var(--space-xl)" }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
            <h1 style={{ letterSpacing: "-0.04em", fontSize: "36px" }}>AIRDECK</h1>
            <p style={{ textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.15em", color: "var(--text-secondary)" }}>
              Secure Presentation Controller
            </p>
          </div>

          {!hasDb ? (
            <form onSubmit={handleCreateStorage} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <h3 style={{ fontSize: "10px" }}>Set AES Encryption Key</h3>
                <input
                  type="password"
                  placeholder="Enter passphrase (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <h3 style={{ fontSize: "10px" }}>Confirm Encryption Key</h3>
                <input
                  type="password"
                  placeholder="Confirm passphrase"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {authError && <p style={{ color: "var(--accent-red)", fontSize: "12px", textTransform: "uppercase" }}>{authError}</p>}
              <button type="submit" className="btn btn-primary" style={{ marginTop: "var(--space-md)" }}>
                Initialize Storage
              </button>
            </form>
          ) : (
            <form onSubmit={handleUnlock} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <h3 style={{ fontSize: "10px" }}>Unlock Encrypted Database</h3>
                <input
                  type="password"
                  placeholder="Enter access passphrase"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {authError && <p style={{ color: "var(--accent-red)", fontSize: "12px", textTransform: "uppercase" }}>{authError}</p>}
              <button type="submit" className="btn btn-primary" style={{ marginTop: "var(--space-md)" }}>
                Unlock App
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Render PRESENTATION SCREEN (Player Mode)
  if (activeSession && activePrez) {
    const currentSlideData = activePrez.slides.find(s => s.index === currentSlide);
    const progressPercent = activePrez.totalSlides > 0 ? (currentSlide / activePrez.totalSlides) * 100 : 0;

    return (
      <div ref={presentationContainerRef} className="container" style={{ flexDirection: "column", position: "relative" }}>
        
        {/* Presenter Top Bar */}
        <div style={{ 
          height: "64px", 
          borderBottom: "1px solid var(--border-color)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          padding: "0 var(--space-xl)",
          backgroundColor: "var(--bg-secondary)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
              ACTIVE SESSION
            </span>
            <span style={{ fontWeight: "700", fontSize: "14px" }}>{activePrez.name}</span>
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
            <button className="btn btn-danger btn-small" onClick={endPresenting}>
              End Presentation
            </button>
          </div>
        </div>

        {/* Presenter Layout Split */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          
          {/* Slide Visualizer */}
          <div style={{ 
            flex: 1.6, 
            display: "flex", 
            flexDirection: "column", 
            padding: "var(--space-xl)", 
            backgroundColor: "var(--bg-primary)",
            gap: "var(--space-lg)"
          }}>
            
            {/* Visualizer Frame */}
            <div 
              ref={slideAreaRef}
              onDoubleClick={toggleFullscreen}
              style={isFullscreen ? {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "#000",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                cursor: "zoom-out"
              } : { 
                flex: 1, 
                backgroundColor: "#000", 
                border: "1px solid var(--border-color)", 
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                cursor: "zoom-in"
              }}
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
                  backgroundColor: "rgba(10, 10, 10, 0.75)",
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
                <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {pptxLoading && (
                    <div style={{ position: "absolute", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                      <Loader2 className="animate-spin" size={24} style={{ color: "#fff" }} />
                      <span style={{ fontSize: "12px" }}>Loading slide...</span>
                    </div>
                  )}
                  {pptxError && (
                    <div style={{ color: "var(--accent-red)", padding: "var(--space-md)", fontSize: "12px", textAlign: "center" }}>
                      {pptxError}
                    </div>
                  )}
                  <div 
                    ref={pptxContainerRef} 
                    style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                    className="pptx-render-container"
                  />
                </div>
              )}

              {/* Laser Pointer overlay */}
              {laserPos && slideAreaRef.current && dimensions && (
                <div style={{
                  position: "absolute",
                  left: `${(slideAreaRef.current.clientWidth - dimensions.width) / 2 + laserPos.x * dimensions.width}px`,
                  top: `${(slideAreaRef.current.clientHeight - dimensions.height) / 2 + laserPos.y * dimensions.height}px`,
                  width: "12px",
                  height: "12px",
                  backgroundColor: "red",
                  borderRadius: "50%",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  zIndex: 9999
                }} />
              )}
            </div>

            {/* Slide Navigation & Progress */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              {/* Flat Progress bar */}
              <div style={{ height: "3px", backgroundColor: "var(--bg-tertiary)", width: "100%" }}>
                <div style={{ height: "100%", backgroundColor: "var(--text-primary)", width: `${progressPercent}%` }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                  <button className="btn btn-small" onClick={prevSlide} disabled={currentSlide === 1}>
                    <ChevronLeft size={16} /> PREV
                  </button>
                  <button className="btn btn-small" onClick={nextSlide} disabled={currentSlide === activePrez.totalSlides}>
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
          <div style={{ 
            width: "360px", 
            borderLeft: "1px solid var(--border-color)", 
            display: "flex", 
            flexDirection: "column",
            backgroundColor: "var(--bg-secondary)",
            padding: "var(--space-xl)",
            gap: "var(--space-xl)",
            overflowY: "auto"
          }}>
            
            {/* Session Pairing details */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <h3 style={{ fontSize: "10px" }}>Pair Mobile App</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                <div style={{ border: "1px solid var(--border-color)", padding: "var(--space-md)" }}>
                  <span style={{ fontSize: "9px", color: "var(--text-secondary)" }}>ROOM ID</span>
                  <div style={{ fontSize: "20px", fontWeight: "700", fontFamily: "var(--font-mono)", color: "var(--text-primary)", marginTop: "4px" }}>
                    {activeSession.roomId}
                  </div>
                </div>

                <div style={{ border: "1px solid var(--border-color)", padding: "var(--space-md)" }}>
                  <span style={{ fontSize: "9px", color: "var(--text-secondary)" }}>PASSCODE</span>
                  <div style={{ fontSize: "20px", fontWeight: "700", fontFamily: "var(--font-mono)", color: "var(--text-primary)", marginTop: "4px" }}>
                    {activeSession.passcode}
                  </div>
                </div>
              </div>

              <div style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                border: "1px solid var(--border-color)", 
                padding: "8px", 
                backgroundColor: "#ffffff",
                alignSelf: "center", 
                margin: "8px 0"
              }}>
                <QRCodeSVG
                  value={JSON.stringify({
                    ips: activeSession.localIps,
                    port: activeSession.signalingPort,
                    roomId: activeSession.roomId,
                    passcode: activeSession.passcode
                  })}
                  size={120}
                  level="M"
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", marginTop: "var(--space-xs)" }}>
                <span style={{ fontSize: "9px", color: "var(--text-secondary)" }}>WiFi LOCAL IPs</span>
                {activeSession.localIps.map(ip => (
                  <code key={ip} style={{ fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                    {ip}:{activeSession.signalingPort}
                  </code>
                ))}
              </div>
            </div>

            {/* Speaker Notes */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              <h3 style={{ fontSize: "10px" }}>Speaker Notes</h3>
              <div style={{ 
                flex: 1, 
                border: "1px solid var(--border-color)", 
                padding: "var(--space-md)", 
                backgroundColor: "var(--bg-tertiary)",
                fontSize: "13px",
                lineHeight: "1.6",
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                overflowY: "auto"
              }}>
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
              <div style={{ border: "1px solid var(--border-color)", padding: "var(--space-md)", backgroundColor: "var(--bg-tertiary)" }}>
                <span style={{ fontSize: "9px", color: "var(--text-secondary)" }}>SECURITY FINGERPRINT</span>
                <div style={{ fontSize: "16px", fontWeight: "700", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                  {pendingRequest.fingerprint}
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-md)" }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                  AcceptPairingRequest();
                  setPendingRequest(null);
                }}>
                  Accept
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => {
                  DenyPairingRequest();
                  setPendingRequest(null);
                }}>
                  Deny
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // Render DASHBOARD (Standard Library Screen)
  return (
    <div className="container">
      
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div>
          <h2 style={{ letterSpacing: "-0.03em", fontSize: "22px", marginBottom: "4px" }}>AIRDECK</h2>
          <span style={{ fontSize: "9px", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Slide Companion
          </span>
        </div>

        {/* Sidebar folder selections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", flex: 1 }}>
          <h3 style={{ fontSize: "10px", marginBottom: "var(--space-xs)" }}>Folders</h3>
          <button 
            style={{ 
              background: "none", 
              border: "none", 
              color: currentFolder === "" ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: currentFolder === "" ? "700" : "400",
              textAlign: "left",
              fontSize: "13px",
              cursor: "pointer"
            }}
            onClick={() => setCurrentFolder("")}
          >
            All Decks
          </button>
          
          <button 
            style={{ 
              background: "none", 
              border: "none", 
              color: currentFolder === "starred" ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: currentFolder === "starred" ? "700" : "400",
              textAlign: "left",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer"
            }}
            onClick={() => setCurrentFolder("starred")}
          >
            <Star size={12} fill={currentFolder === "starred" ? "var(--text-primary)" : "none"} /> Starred
          </button>

          {/* Custom folders */}
          {folders.map(folder => (
            <button 
              key={folder}
              style={{ 
                background: "none", 
                border: "none", 
                color: currentFolder === folder ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: currentFolder === folder ? "700" : "400",
                textAlign: "left",
                fontSize: "13px",
                cursor: "pointer"
              }}
              onClick={() => setCurrentFolder(folder)}
            >
              {folder}
            </button>
          ))}

          {/* New folder trigger button */}
          <button 
            className="btn btn-small" 
            style={{ marginTop: "var(--space-md)", width: "fit-content" }}
            onClick={() => setShowAddFolderModal(true)}
          >
            <Plus size={12} /> New Folder
          </button>
        </div>

        {/* Lock controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <button className="btn btn-small" onClick={handleLock} style={{ width: "100%" }}>
            <Lock size={12} /> Lock Database
          </button>
        </div>
      </div>

      {/* Main Library Dashboard Area */}
      <div className="content">
        
        {/* Actions panel */}
        <div className="flex-between">
          <div>
            <h1>Library</h1>
            <p style={{ textTransform: "uppercase", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
              {currentFolder === "" ? "All presentations" : currentFolder === "starred" ? "Starred presentations" : `${currentFolder} Folder`}
            </p>
          </div>

          <div style={{ display: "flex", gap: "var(--space-md)" }}>
            <button className="btn btn-primary" onClick={handleUpload}>
              <Upload size={14} /> Upload PPTX
            </button>
            <button className="btn" onClick={() => setShowGoogleLinkModal(true)}>
              <Link2 size={14} /> Link Google Slides
            </button>
          </div>
        </div>

        {/* Slides Library Grid */}
        {filteredLibrary.length === 0 ? (
          <div style={{ 
            flex: 1, 
            border: "1px dashed var(--border-color)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            flexDirection: "column",
            gap: "var(--space-md)",
            padding: "var(--space-xl)"
          }}>
            <Tv size={48} strokeWidth={1} style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>No presentations found.</p>
            <button className="btn btn-small" onClick={handleUpload}>Upload a .pptx file to begin</button>
          </div>
        ) : (
          <div className="library-grid">
            {filteredLibrary.map(p => (
              <div className="card" key={p.id}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-sm)" }}>
                  <span className="badge">{p.source}</span>
                  <button 
                    style={{ background: "none", border: "none", cursor: "pointer", color: p.isStarred ? "var(--text-primary)" : "var(--text-muted)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStar(p.id, p.isStarred);
                    }}
                  >
                    <Star size={14} fill={p.isStarred ? "currentColor" : "none"} />
                  </button>
                </div>

                <div style={{ margin: "var(--space-sm) 0" }}>
                  <h3 style={{ 
                    fontSize: "14px", 
                    fontWeight: "700", 
                    textTransform: "none", 
                    color: "var(--text-primary)", 
                    display: "-webkit-box", 
                    WebkitLineClamp: 2, 
                    WebkitBoxOrient: "vertical", 
                    overflow: "hidden", 
                    lineHeight: "1.4" 
                  }}>
                    {p.name}
                  </h3>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {p.totalSlides} slides
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: "var(--space-sm)", marginTop: "auto" }}>
                  <button className="btn btn-small btn-primary" onClick={() => startPresenting(p)}>
                    <Play size={10} /> Present
                  </button>

                  <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                    {/* Move to folder dropdown selector */}
                    <select 
                      style={{ padding: "4px", fontSize: "10px", width: "auto", border: "none", background: "none", color: "var(--text-secondary)" }}
                      value={p.folder}
                      onChange={(e) => handleMoveToFolder(p.id, e.target.value)}
                    >
                      <option value="">No Folder</option>
                      {folders.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>

                    <button 
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* MODAL: ADD FOLDER */}
        {showAddFolderModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "340px" }}>
              <h2>Create Folder</h2>
              <input
                type="text"
                placeholder="Folder Name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
              />
              <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "flex-end" }}>
                <button className="btn btn-small" onClick={() => setShowAddFolderModal(false)}>Cancel</button>
                <button className="btn btn-small btn-primary" onClick={handleAddFolder}>Create</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: LINK GOOGLE SLIDES */}
        {showGoogleLinkModal && (
          <div className="modal-overlay">
            <form className="modal-content" onSubmit={handleAddGoogleLink}>
              <h2>Link Google Slides</h2>
              <p style={{ fontSize: "11px" }}>
                Before linking, make sure you publish your slides web-link via:<br />
                <strong>File &gt; Share &gt; Publish to web</strong>.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <h3 style={{ fontSize: "10px" }}>Presentation Title</h3>
                <input
                  type="text"
                  placeholder="e.g. Sales Quarter Review"
                  value={gSlidesName}
                  onChange={(e) => setGSlidesName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <h3 style={{ fontSize: "10px" }}>Published URL</h3>
                <input
                  type="url"
                  placeholder="https://docs.google.com/presentation/d/.../pub"
                  value={gSlidesUrl}
                  onChange={(e) => setGSlidesUrl(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "flex-end", marginTop: "var(--space-md)" }}>
                <button type="button" className="btn btn-small" onClick={() => setShowGoogleLinkModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-small btn-primary">Link Slides</button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
