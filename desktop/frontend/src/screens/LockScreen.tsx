import React, { useState } from "react";
import { InitializeStorage, UnlockStorage } from "../../wailsjs/go/main/App";
import { Sun, Moon } from "lucide-react";

interface LockScreenProps {
  hasDb: boolean;
  theme: "light" | "dark";
  toggleTheme: () => void;
  onUnlocked: () => void;
}

export default function LockScreen({
  hasDb,
  theme,
  toggleTheme,
  onUnlocked,
}: LockScreenProps) {
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");

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
      onUnlocked();
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
        onUnlocked();
      } else {
        setAuthError("Invalid passphrase.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to unlock.");
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{ background: "var(--bg-primary)", position: "relative" }}
    >
      {/* Theme Toggle Button */}
      <div style={{ position: "absolute", top: "24px", right: "24px" }}>
        <button
          type="button"
          className="btn-icon"
          onClick={toggleTheme}
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      <div
        className="modal-content"
        style={{
          maxWidth: "360px",
          padding: "var(--space-xl)",
          border: "none",
          boxShadow: "none",
          backgroundColor: "transparent",
        }}
      >
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-xs)",
            marginBottom: "var(--space-xl)",
          }}
        >
          <h1
            style={{
              letterSpacing: "-0.04em",
              fontSize: "32px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            AIRDECK
          </h1>
          <p
            style={{
              textTransform: "uppercase",
              fontSize: "9px",
              letterSpacing: "0.12em",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            Secure Presentation Controller
          </p>
        </div>

        {!hasDb ? (
          <form
            onSubmit={handleCreateStorage}
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <h3 style={{ fontSize: "9px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: "2px" }}>
                Set AES Encryption Key
              </h3>
              <input
                type="password"
                placeholder="Enter passphrase (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <h3 style={{ fontSize: "9px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: "2px" }}>
                Confirm Encryption Key
              </h3>
              <input
                type="password"
                placeholder="Confirm passphrase"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {authError && (
              <p
                style={{
                  color: "var(--accent-red)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                }}
              >
                {authError}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: "var(--space-xs)" }}
            >
              Initialize Storage
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleUnlock}
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <h3 style={{ fontSize: "9px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: "2px" }}>
                Unlock Encrypted Database
              </h3>
              <input
                type="password"
                placeholder="Enter access passphrase"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            {authError && (
              <p
                style={{
                  color: "var(--accent-red)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                }}
              >
                {authError}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: "var(--space-xs)" }}
            >
              Unlock App
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
