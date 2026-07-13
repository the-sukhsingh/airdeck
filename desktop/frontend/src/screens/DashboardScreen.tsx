import React, { useState, useEffect } from "react";
import {
  StarPresentation,
  DeletePresentation,
  MovePresentationToFolder,
  SelectAndUploadPresentation,
  AddGoogleSlidesLink,
} from "../../wailsjs/go/main/App";
import {
  Tv,
  Trash2,
  Star,
  Upload,
  Link2,
  Lock,
  Plus,
  Play,
  Sun,
  Moon,
  Loader2,
  FileText,
  ChevronDown,
} from "lucide-react";
import { Presentation } from "../types";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import WindowControls from "../components/WindowControls";

interface DashboardScreenProps {
  library: Presentation[];
  theme: "light" | "dark";
  toggleTheme: () => void;
  onRefresh: () => void;
  onPresent: (p: Presentation) => void;
  onLock: () => void;
}

export default function DashboardScreen({
  library,
  theme,
  toggleTheme,
  onRefresh,
  onPresent,
  onLock,
}: DashboardScreenProps) {
  // Folder & filter states
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [folders, setFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [showAddFolderModal, setShowAddFolderModal] = useState<boolean>(false);
  const [showGoogleLinkModal, setShowGoogleLinkModal] = useState<boolean>(false);
  const [activeFolderDropdown, setActiveFolderDropdown] = useState<string | null>(null);

  // Google Slides Form
  const [gSlidesName, setGSlidesName] = useState<string>("");
  const [gSlidesUrl, setGSlidesUrl] = useState<string>("");



  const [exportingProgress, setExportingProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    EventsOn("export-progress", (data: any) => {
      setExportingProgress((prev) => ({
        ...prev,
        [data.id]: data.percent,
      }));
    });

    EventsOn("export-complete", (data: any) => {
      setExportingProgress((prev) => {
        const next = { ...prev };
        delete next[data.id];
        return next;
      });
      onRefresh();
    });

    EventsOn("export-error", (data: any) => {
      setExportingProgress((prev) => {
        const o = { ...prev };
        delete o[data.id];
        return o;
      });
    });

    return () => {
      EventsOff("export-progress");
      EventsOff("export-complete");
      EventsOff("export-error");
    };
  }, [onRefresh]);

  // Extract unique folder names whenever library updates
  useEffect(() => {
    const folderSet = new Set<string>();
    library.forEach((p) => {
      if (p.folder) folderSet.add(p.folder);
    });
    setFolders(Array.from(folderSet));
  }, [library]);

  const handleUpload = async () => {
    try {
      await SelectAndUploadPresentation();
      onRefresh();
    } catch (err) {
      console.error("Upload failed:", err);
    }
  };

  const handleAddGoogleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gSlidesUrl) return;

    try {
      let cleanedUrl = gSlidesUrl;
      // Try matching published link /d/e/ID first
      const pubMatch = gSlidesUrl.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
      if (pubMatch && pubMatch[1]) {
        cleanedUrl = `https://docs.google.com/presentation/d/e/${pubMatch[1]}/embed?start=false&loop=false&delayms=3000`;
      } else {
        // Try matching standard link /d/ID
        const stdMatch = gSlidesUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (stdMatch && stdMatch[1]) {
          cleanedUrl = `https://docs.google.com/presentation/d/${stdMatch[1]}/embed?start=false&loop=false&delayms=3000`;
        }
      }

      await AddGoogleSlidesLink(gSlidesName || "", cleanedUrl);
      setShowGoogleLinkModal(false);
      setGSlidesName("");
      setGSlidesUrl("");
      onRefresh();
    } catch (err) {
      console.error("Add Google Slides URL failed:", err);
    }
  };

  const handleStar = async (id: string, starState: boolean) => {
    try {
      await StarPresentation(id, !starState);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await DeletePresentation(id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveToFolder = async (id: string, folder: string) => {
    try {
      await MovePresentationToFolder(id, folder);
      onRefresh();
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

  // Filter Decks
  const filteredLibrary = library.filter((p) => {
    if (currentFolder === "") return true;
    if (currentFolder === "starred") return p.isStarred;
    return p.folder === currentFolder;
  });

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "pdf":
        return { label: "PDF", icon: <FileText size={11} />, className: "badge-pdf" };
      case "google":
        return { label: "Google Slides", icon: <Link2 size={11} />, className: "badge-google" };
      default:
        return { label: "PPTX", icon: <Tv size={11} />, className: "badge-pptx" };
    }
  };

  const getSlideLabel = (source: string, totalSlides: number) =>
    source === "pdf"
      ? `${totalSlides} page${totalSlides !== 1 ? "s" : ""}`
      : `${totalSlides} slide${totalSlides !== 1 ? "s" : ""}`;

  return (
    <div className="container">
      <WindowControls />
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="draggable-area">
          <h2
            style={{
              letterSpacing: "-0.03em",
              fontSize: "18px",
              fontWeight: 500,
              marginBottom: "4px",
            }}
          >
            AIRDECK
          </h2>
          <span
            style={{
              fontSize: "9px",
              letterSpacing: "0.05em",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Secure Companion
          </span>
        </div>

        {/* Sidebar folder selections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
          <h3 style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "var(--space-sm)" }}>
            Folders
          </h3>
          
          <button
            className={`sidebar-nav-btn ${currentFolder === "" ? "active" : ""}`}
            onClick={() => setCurrentFolder("")}
          >
            All Decks
          </button>

          <button
            className={`sidebar-nav-btn ${currentFolder === "starred" ? "active" : ""}`}
            onClick={() => setCurrentFolder("starred")}
          >
            <Star
              size={12}
              fill={currentFolder === "starred" ? "currentColor" : "none"}
            />
            Starred
          </button>

          {/* Custom folders */}
          {folders.map((folder) => (
            <button
              key={folder}
              className={`sidebar-nav-btn ${currentFolder === folder ? "active" : ""}`}
              onClick={() => setCurrentFolder(folder)}
            >
              {folder}
            </button>
          ))}

          {/* New folder trigger button */}
          <button
            className="btn btn-small"
            style={{ marginTop: "var(--space-md)", width: "100%" }}
            onClick={() => setShowAddFolderModal(true)}
          >
            <Plus size={12} /> New Folder
          </button>
        </div>
      </div>

      {/* Main Library Dashboard Area */}
      <div className="content">
        {/* Actions panel - draggable area for frameless window */}
        <div className="draggable-area flex-between">
          <div>
            <h1>Library</h1>
            <p
              style={{
                textTransform: "uppercase",
                fontSize: "9px",
                color: "var(--text-muted)",
                marginTop: "4px",
                fontWeight: 500,
                letterSpacing: "0.05em",
              }}
            >
              {currentFolder === ""
                ? "All presentations"
                : currentFolder === "starred"
                ? "Starred presentations"
                : `${currentFolder} Folder`}
            </p>
          </div>

          <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center" }}>
            {/* Theme Toggle Button */}
            <button
              type="button"
              className="theme-button"
              onClick={toggleTheme}
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
            </button>

            <button className="btn btn-primary" onClick={handleUpload}>
              <Upload size={13} /> Upload PPTX / PDF
            </button>
            <button className="btn" onClick={() => setShowGoogleLinkModal(true)}>
              <Link2 size={13} /> Link Google Slides
            </button>
          </div>
        </div>

        {/* Slides Library Grid / List Showcase */}
        {filteredLibrary.length === 0 ? (
          <div
            style={{
              flex: 1,
              border: "1.5px dashed var(--border-color)",
              borderRadius: "var(--radius-large)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "var(--space-md)",
              padding: "var(--space-xl)",
            }}
          >
            <div
              style={{
                backgroundColor: "var(--bg-tertiary)",
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "4px",
              }}
            >
              <Tv size={24} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              No presentations found in this folder.
            </p>
            <button className="btn btn-small" onClick={handleUpload}>
              Upload a .pptx or .pdf file to begin
            </button>
          </div>
        ) : (
          <div className="library-table-container">
            <table className="library-table">
              <thead>
                <tr>
                  <th style={{ width: "48px", textAlign: "center" }}></th> {/* Star */}
                  <th>Name</th>
                  <th style={{ width: "160px" }}>Source</th>
                  <th style={{ width: "120px" }}>Slides</th>
                  <th style={{ width: "180px" }}>Folder</th>
                  <th style={{ width: "180px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLibrary.map((p) => {
                  const badge = getSourceBadge(p.source);
                  const isProcessing = exportingProgress[p.id] !== undefined;

                  return (
                    <tr 
                      key={p.id}
                      style={{
                        cursor: isProcessing ? "not-allowed" : "pointer"
                      }}
                      onClick={() => {
                        if (!isProcessing) {
                          onPresent(p);
                        }
                      }}
                    >
                      {/* Star Cell */}
                      <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className={`btn-star ${p.isStarred ? "starred" : ""}`}
                          onClick={() => handleStar(p.id, p.isStarred)}
                          title={p.isStarred ? "Unstar presentation" : "Star presentation"}
                        >
                          <Star
                            size={16}
                            fill={p.isStarred ? "currentColor" : "none"}
                          />
                        </button>
                      </td>

                      {/* Name Cell */}
                      <td>
                        <div className="prez-name-cell">
                          <span className="prez-name">{p.name}</span>
                          {isProcessing && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxWidth: "240px", marginTop: "4px" }}>
                              <span style={{ fontSize: "10px", color: "var(--accent-blue)", fontWeight: "500", display: "flex", gap: "6px", alignItems: "center" }}>
                                <Loader2 className="animate-spin" size={10} style={{ color: "var(--accent-blue)" }} /> 
                                Generating previews... {exportingProgress[p.id]}%
                              </span>
                              <div
                                style={{
                                  width: "100%",
                                  height: "4px",
                                  backgroundColor: "var(--bg-tertiary)",
                                  borderRadius: "2px",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${exportingProgress[p.id]}%`,
                                    height: "100%",
                                    backgroundColor: "var(--accent-blue)",
                                    transition: "width 0.2s ease",
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Source badge Cell */}
                      <td>
                        <span className={`source-badge ${badge.className}`}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>

                      {/* Slides count Cell */}
                      <td style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                        {getSlideLabel(p.source, p.totalSlides)}
                      </td>

                      {/* Folder selection Cell */}
                      <td onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
                        <button
                          className="folder-select-btn"
                          onClick={() => setActiveFolderDropdown(activeFolderDropdown === p.id ? null : p.id)}
                          title="Move to folder"
                        >
                          <span>{p.folder || "No Folder"}</span>
                          <ChevronDown size={12} style={{ opacity: 0.7 }} />
                        </button>
                        
                        {activeFolderDropdown === p.id && (
                          <>
                            <div 
                              className="dropdown-backdrop" 
                              onClick={() => setActiveFolderDropdown(null)} 
                            />
                            <div className="dropdown-menu">
                              <button 
                                className={`dropdown-item ${!p.folder ? "active" : ""}`}
                                onClick={() => {
                                  handleMoveToFolder(p.id, "");
                                  setActiveFolderDropdown(null);
                                }}
                              >
                                No Folder
                              </button>
                              {folders.map((f) => (
                                <button
                                  key={f}
                                  className={`dropdown-item ${p.folder === f ? "active" : ""}`}
                                  onClick={() => {
                                    handleMoveToFolder(p.id, f);
                                    setActiveFolderDropdown(null);
                                  }}
                                >
                                  {f}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </td>

                      {/* Actions Cell */}
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                          <button
                            className="btn-present"
                            onClick={() => onPresent(p)}
                            disabled={isProcessing}
                            title="Start presenting"
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="animate-spin" size={12} /> Processing
                              </>
                            ) : (
                              <>
                                <Play size={12} fill="currentColor" /> Present
                              </>
                            )}
                          </button>

                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(p.id)}
                            title="Delete presentation"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                <button className="btn btn-small" onClick={() => setShowAddFolderModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-small btn-primary" onClick={handleAddFolder}>
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: LINK GOOGLE SLIDES */}
        {showGoogleLinkModal && (
          <div className="modal-overlay">
            <form className="modal-content" onSubmit={handleAddGoogleLink}>
              <h2>Link Google Slides</h2>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Before linking, make sure you publish your slides web-link via:
                <br />
                <strong>File &gt; Share &gt; Publish to web</strong>.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <h3 style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
                  Presentation Title
                </h3>
                <input
                  type="text"
                  placeholder="e.g. Sales Quarter Review"
                  value={gSlidesName}
                  onChange={(e) => setGSlidesName(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <h3 style={{ fontSize: "10px", color: "var(--text-secondary)" }}>Published URL</h3>
                <input
                  type="url"
                  placeholder="https://docs.google.com/presentation/d/.../pub"
                  value={gSlidesUrl}
                  onChange={(e) => setGSlidesUrl(e.target.value)}
                  required
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "var(--space-md)",
                  justifyContent: "flex-end",
                  marginTop: "var(--space-md)",
                }}
              >
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => setShowGoogleLinkModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-small btn-primary">
                  Link Slides
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
