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
  Grid,
  List,
} from "lucide-react";
import { Presentation } from "../types";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";

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

  // Google Slides Form
  const [gSlidesName, setGSlidesName] = useState<string>("");
  const [gSlidesUrl, setGSlidesUrl] = useState<string>("");

  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("viewMode") as "grid" | "list") || "grid";
  });

  const toggleViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("viewMode", mode);
  };

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

  return (
    <div className="container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div>
          <h2
            style={{
              letterSpacing: "-0.03em",
              fontSize: "20px",
              fontWeight: 600,
              marginBottom: "2px",
            }}
          >
            AIRDECK
          </h2>
          <span
            style={{
              fontSize: "9px",
              letterSpacing: "0.1em",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Secure Companion
          </span>
        </div>

        {/* Sidebar folder selections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
          <h3 style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "var(--space-xs)" }}>
            Folders
          </h3>
          <button
            style={{
              background: "none",
              border: "none",
              color: currentFolder === "" ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: currentFolder === "" ? "600" : "400",
              textAlign: "left",
              fontSize: "13px",
              padding: "6px 0",
              cursor: "pointer",
              transition: "all 0.2s ease",
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
              fontWeight: currentFolder === "starred" ? "600" : "400",
              textAlign: "left",
              fontSize: "13px",
              padding: "6px 0",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onClick={() => setCurrentFolder("starred")}
          >
            <Star
              size={12}
              fill={currentFolder === "starred" ? "var(--text-primary)" : "none"}
              style={{ color: "currentColor" }}
            />{" "}
            Starred
          </button>

          {/* Custom folders */}
          {folders.map((folder) => (
            <button
              key={folder}
              style={{
                background: "none",
                border: "none",
                color: currentFolder === folder ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: currentFolder === folder ? "600" : "400",
                textAlign: "left",
                fontSize: "13px",
                padding: "6px 0",
                cursor: "pointer",
                transition: "all 0.2s ease",
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
            <Plus size={12} /> Folder
          </button>
        </div>


      </div>

      {/* Main Library Dashboard Area */}
      <div className="content">
        {/* Actions panel */}
        <div className="flex-between">
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
            {/* View Mode Toggle */}
            <div style={{ display: "flex", gap: "12px", marginRight: "12px" }}>
              <button
                onClick={() => toggleViewMode("grid")}
                style={{
                  background: "none",
                  border: "none",
                  color: viewMode === "grid" ? "var(--text-primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  transition: "color 0.2s ease",
                }}
                title="Grid View"
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => toggleViewMode("list")}
                style={{
                  background: "none",
                  border: "none",
                  color: viewMode === "list" ? "var(--text-primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  transition: "color 0.2s ease",
                }}
                title="List View"
              >
                <List size={16} />
              </button>
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              className="btn-icon"
              onClick={toggleTheme}
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <button className="btn btn-primary" onClick={handleUpload}>
              <Upload size={14} /> Upload PPTX
            </button>
            <button className="btn" onClick={() => setShowGoogleLinkModal(true)}>
              <Link2 size={14} /> Link Google Slides
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
              Upload a .pptx file to begin
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="library-grid">
            {filteredLibrary.map((p) => (
              <div 
                className="card" 
                key={p.id}
                onClick={() => {
                  if (exportingProgress[p.id] === undefined) {
                    onPresent(p);
                  }
                }}
                style={{
                  cursor: exportingProgress[p.id] !== undefined ? "not-allowed" : "pointer"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "var(--space-sm)",
                  }}
                >
                  <span style={{ fontSize: "9px", letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: "bold" }}>
                    {p.source}
                  </span>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: p.isStarred ? "var(--text-primary)" : "var(--text-muted)",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      transition: "color 0.2s ease",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStar(p.id, p.isStarred);
                    }}
                  >
                    <Star
                      size={14}
                      fill={p.isStarred ? "currentColor" : "none"}
                      style={{ color: "currentColor" }}
                    />
                  </button>
                </div>

                <div style={{ margin: "var(--space-sm) 0" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "500",
                      textTransform: "none",
                      color: "var(--text-primary)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      lineHeight: "1.4",
                    }}
                  >
                    {p.name}
                  </h3>
                  {exportingProgress[p.id] !== undefined ? (
                    <div style={{ marginTop: "8px" }}>
                      <span style={{ fontSize: "10px", color: "var(--accent-blue)", fontWeight: "500", display: "flex", gap: "4px", alignItems: "center" }}>
                        <Loader2 className="animate-spin" size={10} style={{ color: "var(--accent-blue)" }} /> Generating previews... {exportingProgress[p.id]}%
                      </span>
                      <div
                        style={{
                          width: "100%",
                          height: "4px",
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "2px",
                          overflow: "hidden",
                          marginTop: "4px",
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
                  ) : (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        marginTop: "4px",
                        display: "block",
                      }}
                    >
                      {p.totalSlides} slides
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "var(--space-sm)",
                    marginTop: "auto",
                  }}
                >
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (exportingProgress[p.id] === undefined) {
                        onPresent(p);
                      }
                    }}
                    disabled={exportingProgress[p.id] !== undefined}
                    style={{
                      background: "none",
                      border: "none",
                      color: exportingProgress[p.id] !== undefined ? "var(--text-muted)" : "var(--text-primary)",
                      cursor: exportingProgress[p.id] !== undefined ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      fontWeight: "600",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {exportingProgress[p.id] !== undefined ? (
                      <>
                        <Loader2 className="animate-spin" size={10} /> Processing
                      </>
                    ) : (
                      <>
                        Present →
                      </>
                    )}
                  </button>

                  <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center" }}>
                    {/* Move to folder dropdown selector */}
                    <select
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: "2px 0",
                        fontSize: "11px",
                        width: "auto",
                        border: "none",
                        background: "transparent",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        outline: "none",
                      }}
                      value={p.folder}
                      onChange={(e) => handleMoveToFolder(p.id, e.target.value)}
                    >
                      <option value="">No Folder</option>
                      {folders.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>

                    <button
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        transition: "color 0.2s ease",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id);
                      }}
                      title="Delete Presentation"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List Mode */
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filteredLibrary.map((p) => (
              <div 
                key={p.id}
                onClick={() => {
                  if (exportingProgress[p.id] === undefined) {
                    onPresent(p);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  margin: "0 -16px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                  gap: "24px",
                  cursor: exportingProgress[p.id] !== undefined ? "not-allowed" : "pointer",
                  borderRadius: "var(--radius-medium)",
                }}
                className="list-row"
              >
                {/* Star & Name */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: p.isStarred ? "var(--text-primary)" : "var(--text-muted)",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStar(p.id, p.isStarred);
                    }}
                  >
                    <Star
                      size={13}
                      fill={p.isStarred ? "currentColor" : "none"}
                    />
                  </button>

                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <h3
                      style={{
                        fontSize: "14px",
                        fontWeight: "500",
                        textTransform: "none",
                        color: "var(--text-primary)",
                        margin: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.name}
                    </h3>
                    {exportingProgress[p.id] !== undefined && (
                      <span style={{ fontSize: "10px", color: "var(--accent-blue)", fontWeight: "500", display: "flex", gap: "4px", alignItems: "center", marginTop: "2px" }}>
                        <Loader2 className="animate-spin" size={8} /> Processing... {exportingProgress[p.id]}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Slides & Type badge */}
                <div style={{ display: "flex", alignItems: "center", gap: "24px", color: "var(--text-secondary)", fontSize: "12px" }}>
                  <span style={{ fontSize: "9px", letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: "bold" }}>
                    {p.source}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {p.totalSlides} slides
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (exportingProgress[p.id] === undefined) {
                        onPresent(p);
                      }
                    }}
                    disabled={exportingProgress[p.id] !== undefined}
                    style={{
                      background: "none",
                      border: "none",
                      color: exportingProgress[p.id] !== undefined ? "var(--text-muted)" : "var(--text-primary)",
                      cursor: exportingProgress[p.id] !== undefined ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      fontWeight: "600",
                      padding: 0,
                    }}
                  >
                    Present →
                  </button>

                  <select
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: "2px 0",
                      fontSize: "11px",
                      width: "auto",
                      border: "none",
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      outline: "none",
                    }}
                    value={p.folder}
                    onChange={(e) => handleMoveToFolder(p.id, e.target.value)}
                  >
                    <option value="">No Folder</option>
                    {folders.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>

                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      transition: "color 0.2s ease",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
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
