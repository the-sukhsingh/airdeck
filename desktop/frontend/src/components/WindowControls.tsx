import React from "react";
import { WindowMinimise, WindowToggleMaximise, Quit } from "../../wailsjs/runtime/runtime";
import { Minus, Square, X } from "lucide-react";

export default function WindowControls() {
  return (
    <div className="window-controls">
      <button
        onClick={WindowMinimise}
        title="Minimize"
        style={{ border: "none", background: "none" }}
      >
        <Minus size={12} />
      </button>
      <button
        onClick={WindowToggleMaximise}
        title="Maximize / Restore"
        style={{ border: "none", background: "none" }}
      >
        <Square size={10} />
      </button>
      <button
        onClick={Quit}
        title="Quit Application"
        className="btn-close-hover"
        style={{ border: "none", background: "none" }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
