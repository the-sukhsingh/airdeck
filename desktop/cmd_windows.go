//go:build windows

package main

import (
	"os/exec"
	"syscall"
)

// hideConsoleWindow prevents spawned console applications (like python) from opening a command prompt window on Windows.
func hideConsoleWindow(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
	cmd.SysProcAttr.CreationFlags = 0x08000000 // CREATE_NO_WINDOW
}
