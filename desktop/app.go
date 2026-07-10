package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"desktop/internal/ble"
	"desktop/internal/crypto"
	"desktop/internal/discovery"
	"desktop/internal/pptx"
	"desktop/internal/storage"
	"desktop/internal/webrtc"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed pptx_to_images.py
var pptxToImagesPy []byte


type ControlMessage struct {
	Action string  `json:"action"`          // "next", "prev", "goto", "laser", "laser-off", "request-slides", "draw-start", "draw-move", "draw-end", "draw-clear", "set-active-tab"
	Index  int     `json:"index,omitempty"` // For "goto"
	X      float64 `json:"x,omitempty"`     // For "laser" / "draw" (0.0 to 1.0)
	Y      float64 `json:"y,omitempty"`     // For "laser" / "draw" (0.0 to 1.0)
	Tool   string  `json:"tool,omitempty"`  // "pen", "highlighter", "eraser"
	Color  string  `json:"color,omitempty"` // Color for drawing
	Tab    string  `json:"tab,omitempty"`    // Active mobile tab ("laser", "control", "slides")
}

type HandshakeMessage struct {
	Type      string `json:"type"`      // "handshake", "encrypted"
	PublicKey string `json:"publicKey"` // Base64 Curve25519 public key
}

type EncryptedWrapper struct {
	Type       string `json:"type"`       // "encrypted"
	Ciphertext string `json:"ciphertext"` // Base64 AES-256-GCM ciphertext
}

type SessionInfo struct {
	RoomID             string `json:"roomId"`
	Passcode           string `json:"passcode"`
	LocalIPs           []string `json:"localIps"`
	SignalingPort      int    `json:"signalingPort"`
	PresentationName   string `json:"presentationName"`
}

type App struct {
	ctx           context.Context
	storage       *storage.StorageManager
	webrtcManager *webrtc.WebRTCManager
	udpServer     *discovery.DiscoveryServer
	bleServer     *ble.BLEServer

	// Session variables
	roomID            string
	passcode          string
	activePrez        *storage.Presentation
	currentSlideIndex int    // 1-indexed
	activeClientTab   string // active mobile tab: "laser", "control", "slides"

	// E2EE Connection states
	keyPair          *crypto.KeyPair
	sharedSecretKey  []byte
	paired           bool
	pendingDeviceName string
	mutex            sync.Mutex
}

func NewApp() *App {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "PPT Presenter Laptop"
	}

	app := &App{
		storage:   storage.GetStorageManager(),
		udpServer: discovery.NewDiscoveryServer(0, hostname),
		bleServer: ble.NewBLEServer(hostname),
	}

	// Initialize WebRTC with message and status handlers
	app.webrtcManager = webrtc.NewWebRTCManager(app.handleRawMessage, app.handleConnectionState)

	// Set BLE callbacks
	app.bleServer.SetCallbacks(app.handleRawMessage, func(sendNotify func(data []byte) error) {})

	return app
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Try to start BLE safely, catching any native panics (e.g. if Bluetooth hardware is missing/disabled)
	func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[BLE] Panicked while starting BLE: %v. Running in Wi-Fi-only mode.", r)
			}
		}()
		a.bleServer.Start()
	}()
}

// -------------------------------------------------------------
// STORAGE & SETTINGS API (BOUND TO FRONTEND)
// -------------------------------------------------------------

func (a *App) IsStorageInitialized() bool {
	return a.storage.FileExists()
}

func (a *App) InitializeStorage(password string) error {
	return a.storage.InitializeNewStore(password)
}

func (a *App) UnlockStorage(password string) (bool, error) {
	return a.storage.UnlockStore(password)
}

func (a *App) LockStorage() {
	a.storage.ResetLock()
}

func (a *App) GetLibrary() ([]storage.Presentation, error) {
	if !a.storage.IsUnlocked() {
		return nil, errors.New("database locked")
	}
	list := a.storage.GetPresentations()
	if len(list) == 0 {
		mockPath := `C:\Users\sukha\Downloads\[EXT] Solution Challenge 2026 - Prototype PPT Template (1).pptx`
		if _, err := os.Stat(mockPath); err == nil {
			mockP := storage.Presentation{
				ID:        "test-pptx-id",
				Name:      "[EXT] Solution Challenge 2026 - Prototype PPT Template (1).pptx",
				Source:    "pptx",
				FilePath:  mockPath,
				IsStarred: false,
				Folder:    "",
				TotalSlides: 14,
				Slides:    []storage.SlideData{},
				CreatedAt: time.Now().UnixNano() / int64(time.Millisecond),
			}
			slides, err := pptx.ParsePPTX(mockP.FilePath)
			if err == nil {
				mockP.Slides = slides
				mockP.TotalSlides = len(slides)
			} else {
				log.Printf("[Library] Failed to parse mock presentation: %v", err)
			}
			return []storage.Presentation{mockP}, nil
		}
		return []storage.Presentation{}, nil
	}
	return list, nil
}

func (a *App) StarPresentation(id string, star bool) error {
	return a.storage.StarPresentation(id, star)
}

func (a *App) MovePresentationToFolder(id string, folder string) error {
	return a.storage.MovePresentationToFolder(id, folder)
}

func (a *App) DeletePresentation(id string) error {
	// First delete any cached file if needed
	return a.storage.RemovePresentation(id)
}

func (a *App) SaveSettings(theme string) error {
	settings := a.storage.GetSettings()
	settings.Theme = theme
	return a.storage.SaveSettings(settings)
}

func (a *App) GetSettings() (storage.Settings, error) {
	if !a.storage.IsUnlocked() {
		return storage.Settings{}, errors.New("database locked")
	}
	return a.storage.GetSettings(), nil
}

// UploadPresentation parses and saves a PPTX file to the library database
func (a *App) UploadPresentation(filePath string) (storage.Presentation, error) {
	if !a.storage.IsUnlocked() {
		return storage.Presentation{}, errors.New("database locked")
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		return storage.Presentation{}, fmt.Errorf("failed to get user config dir: %w", err)
	}
	appDir := filepath.Join(configDir, "ppt-dapp", "presentations")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return storage.Presentation{}, fmt.Errorf("failed to create presentations folder: %w", err)
	}

	id := uuid.New().String()
	localFilePath := filepath.Join(appDir, id+".pptx")

	// Copy content
	srcFile, err := os.Open(filePath)
	if err != nil {
		return storage.Presentation{}, fmt.Errorf("failed to open source file: %w", err)
	}
	defer srcFile.Close()

	destFile, err := os.Create(localFilePath)
	if err != nil {
		return storage.Presentation{}, fmt.Errorf("failed to create destination file: %w", err)
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, srcFile); err != nil {
		os.Remove(localFilePath)
		return storage.Presentation{}, fmt.Errorf("failed to copy file: %w", err)
	}

	slides, err := pptx.ParsePPTX(localFilePath)
	if err != nil {
		os.Remove(localFilePath)
		return storage.Presentation{}, fmt.Errorf("parsing failed: %w", err)
	}

	fileName := filepath.Base(filePath)

	p := storage.Presentation{
		ID:        id,
		Name:      fileName,
		Source:    "pptx",
		FilePath:  localFilePath,
		IsStarred: false,
		Folder:    "",
		TotalSlides: len(slides),
		Slides:    slides,
		CreatedAt: time.Now().UnixNano() / int64(time.Millisecond),
	}

	err = a.storage.AddPresentation(p)
	if err != nil {
		os.Remove(localFilePath)
		return storage.Presentation{}, err
	}

	// Trigger slide images export in background
	imagesDir := filepath.Join(appDir, id+"_images")
	go func() {
		a.runSlideExportPipeline(id, localFilePath, imagesDir)
	}()

	return p, nil
}

// SelectAndUploadPresentation opens a native file dialog to select a PowerPoint file and uploads it
func (a *App) SelectAndUploadPresentation() (storage.Presentation, error) {
	if !a.storage.IsUnlocked() {
		return storage.Presentation{}, errors.New("database locked")
	}

	filePath, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select PowerPoint File",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "PowerPoint Presentations (*.pptx)", Pattern: "*.pptx"},
		},
	})
	if err != nil {
		return storage.Presentation{}, err
	}
	if filePath == "" {
		return storage.Presentation{}, errors.New("no file selected")
	}

	return a.UploadPresentation(filePath)
}


func fetchGoogleSlidesMetadata(url string) (string, int) {
	client := &http.Client{
		Timeout: 5 * time.Second,
	}
	resp, err := client.Get(url)
	if err != nil {
		log.Printf("[GoogleSlides] Fetch failed: %v", err)
		return "", 0
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[GoogleSlides] Fetch HTTP status failed: %d", resp.StatusCode)
		return "", 0
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[GoogleSlides] Read body failed: %v", err)
		return "", 0
	}
	body := string(bodyBytes)

	// 1. Extract Title
	title := ""
	reTitleJS := regexp.MustCompile(`title\s*:\s*'([^']+)'`)
	matchTitleJS := reTitleJS.FindStringSubmatch(body)
	if len(matchTitleJS) > 1 {
		title = matchTitleJS[1]
	} else {
		reTitleHTML := regexp.MustCompile(`(?i)<title>(.*?)</title>`)
		matchTitleHTML := reTitleHTML.FindStringSubmatch(body)
		if len(matchTitleHTML) > 1 {
			title = matchTitleHTML[1]
			title = strings.TrimSuffix(title, " - Google Slides")
		}
	}

	// 2. Extract Slide count
	totalSlides := 0
	reSlides := regexp.MustCompile(`slidePageCount\s*:\s*([\d\.]+)`)
	matchSlides := reSlides.FindStringSubmatch(body)
	if len(matchSlides) > 1 {
		if val, err := strconv.ParseFloat(matchSlides[1], 64); err == nil {
			totalSlides = int(val)
		}
	}

	log.Printf("[GoogleSlides] Metadata fetched successfully. Title: %q, Slides: %d", title, totalSlides)
	return title, totalSlides
}

// AddGoogleSlidesLink saves a Google Slide URL to the library
func (a *App) AddGoogleSlidesLink(name string, url string) (storage.Presentation, error) {
	if !a.storage.IsUnlocked() {
		return storage.Presentation{}, errors.New("database locked")
	}

	if url == "" {
		return storage.Presentation{}, errors.New("URL cannot be empty")
	}

	extTitle, extSlides := fetchGoogleSlidesMetadata(url)

	finalName := name
	if finalName == "" {
		if extTitle != "" {
			finalName = extTitle
		} else {
			finalName = "Google Slides"
		}
	}

	totalSlides := 100
	if extSlides > 0 {
		totalSlides = extSlides
	}

	slides := make([]storage.SlideData, totalSlides)
	for i := 0; i < totalSlides; i++ {
		slides[i] = storage.SlideData{
			Index: i + 1,
			Title: fmt.Sprintf("Slide %d", i+1),
			Notes: "",
		}
	}

	id := uuid.New().String()
	p := storage.Presentation{
		ID:              id,
		Name:            finalName,
		Source:          "google",
		GoogleSlidesURL: url,
		IsStarred:       false,
		Folder:          "",
		TotalSlides:     totalSlides,
		Slides:          slides,
		CreatedAt:       time.Now().UnixNano() / int64(time.Millisecond),
	}

	err := a.storage.AddPresentation(p)
	return p, err
}

// GetPresentationBytes reads the raw file bytes for a PPTX presentation from disk
func (a *App) GetPresentationBytes(id string) ([]byte, error) {
	if !a.storage.IsUnlocked() {
		return nil, errors.New("database locked")
	}
	presentations := a.storage.GetPresentations()
	for _, p := range presentations {
		if p.ID == id {
			if p.Source == "google" {
				return nil, errors.New("google slides do not have file bytes")
			}
			if p.FilePath == "" {
				return nil, errors.New("file path is empty")
			}
			return os.ReadFile(p.FilePath)
		}
	}
	// Fallback to mock presentation if it matches mock id
	if id == "test-pptx-id" {
		mockPath := `C:\Users\sukha\Downloads\[EXT] Solution Challenge 2026 - Prototype PPT Template (1).pptx`
		return os.ReadFile(mockPath)
	}
	return nil, errors.New("presentation not found")
}


// -------------------------------------------------------------
// SESSION CONTROL API (BOUND TO FRONTEND)
// -------------------------------------------------------------

// StartPresentationSession creates a presentation room and boots the network listeners
func (a *App) StartPresentationSession(prezID string) (SessionInfo, error) {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	var p *storage.Presentation
	presentations := a.storage.GetPresentations()
	for _, item := range presentations {
		if item.ID == prezID {
			pCopy := item
			p = &pCopy
			break
		}
	}

	if p == nil {
		mockP := storage.Presentation{
			ID:        "test-pptx-id",
			Name:      "[EXT] Solution Challenge 2026 - Prototype PPT Template (1).pptx",
			Source:    "pptx",
			FilePath:  `C:\Users\sukha\Downloads\[EXT] Solution Challenge 2026 - Prototype PPT Template (1).pptx`,
			IsStarred: false,
			Folder:    "",
			TotalSlides: 14,
			Slides:    []storage.SlideData{},
			CreatedAt: time.Now().UnixNano() / int64(time.Millisecond),
		}
		slides, err := pptx.ParsePPTX(mockP.FilePath)
		if err == nil {
			mockP.Slides = slides
			mockP.TotalSlides = len(slides)
		}
		p = &mockP
	}

	a.activePrez = p
	a.currentSlideIndex = 1
	a.activeClientTab = "control"
	a.paired = false
	a.sharedSecretKey = nil

	a.roomID = "TEST12"
	a.passcode = "123456"

	wsPort, err := a.webrtcManager.StartLocalSignalingServer()
	if err != nil {
		return SessionInfo{}, fmt.Errorf("failed to start WebRTC signaling: %w", err)
	}

	localIPs := getLocalIPs()

	return SessionInfo{
		RoomID:        a.roomID,
		Passcode:      a.passcode,
		LocalIPs:      localIPs,
		SignalingPort: wsPort,
		PresentationName: p.Name,
	}, nil
}

// StopPresentationSession tears down discovery and active connections
func (a *App) EndPresentationSession() {
	a.mutex.Lock()
	a.activePrez = nil
	a.paired = false
	a.sharedSecretKey = nil
	a.mutex.Unlock()

	a.udpServer.Stop()
	a.webrtcManager.Stop()
}

// AcceptPairingRequest accepts the connection request from the mobile device
func (a *App) AcceptPairingRequest() {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	if a.sharedSecretKey == nil {
		return
	}

	a.paired = true

	// Send acceptance packet over WebRTC
	acceptPayload, _ := json.Marshal(map[string]string{
		"type":   "pairing-response",
		"status": "accepted",
	})
	
	// Encrypt the acceptance packet
	encBytes, err := crypto.Encrypt(acceptPayload, a.sharedSecretKey)
	if err == nil {
		encWrapper, _ := json.Marshal(EncryptedWrapper{
			Type:       "encrypted",
			Ciphertext: base64.StdEncoding.EncodeToString(encBytes),
		})
		a.webrtcManager.SendMessage(encWrapper)
		a.bleServer.SendStatusUpdate(encWrapper)
	}

	log.Printf("[E2EE] Paired successfully with %s!", a.pendingDeviceName)
	wailsRuntime.EventsEmit(a.ctx, "paired-device", a.pendingDeviceName)

	// Send initial slide data and outline to mobile
	a.sendSlidesUpdate()
}

// DenyPairingRequest rejects the pairing request
func (a *App) DenyPairingRequest() {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	if a.sharedSecretKey == nil {
		return
	}

	denyPayload, _ := json.Marshal(map[string]string{
		"type":   "pairing-response",
		"status": "denied",
	})

	encBytes, err := crypto.Encrypt(denyPayload, a.sharedSecretKey)
	if err == nil {
		encWrapper, _ := json.Marshal(EncryptedWrapper{
			Type:       "encrypted",
			Ciphertext: base64.StdEncoding.EncodeToString(encBytes),
		})
		a.webrtcManager.SendMessage(encWrapper)
		a.bleServer.SendStatusUpdate(encWrapper)
	}

	a.paired = false
	a.sharedSecretKey = nil
	a.webrtcManager.Stop()
}

// UpdateCurrentSlide is called by the React presenter UI when slide changes locally (e.g. keyboard arrows)
func (a *App) UpdateCurrentSlide(index int) {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	if a.activePrez == nil {
		return
	}

	if index < 1 {
		index = 1
	}
	if index > a.activePrez.TotalSlides {
		index = a.activePrez.TotalSlides
	}

	a.currentSlideIndex = index
	a.sendSlidesUpdate()
}

// -------------------------------------------------------------
// INTERNAL CRYPTO HANDSHAKE & COMMS DISPATCHER
// -------------------------------------------------------------

func (a *App) handleRawMessage(data []byte) {
	log.Printf("[App] Raw message received: %s", string(data))
	// Parse as base wrapper first
	var base map[string]interface{}
	if err := json.Unmarshal(data, &base); err != nil {
		log.Printf("[App] Failed to unmarshal message: %v", err)
		return
	}

	msgType, ok := base["type"].(string)
	if !ok {
		return
	}

	switch msgType {
	case "handshake":
		// Public Key Exchange (DH)
		var hs HandshakeMessage
		if err := json.Unmarshal(data, &hs); err != nil {
			return
		}

		peerPubBytes, err := base64.StdEncoding.DecodeString(hs.PublicKey)
		if err != nil {
			log.Printf("[E2EE] Handshake decode error: %v", err)
			return
		}

		// Generate our keypair
		a.keyPair, err = crypto.GenerateECDHKeyPair()
		if err != nil {
			log.Printf("[E2EE] Generate key pair failed: %v", err)
			return
		}

		// Compute shared secret
		secret, err := crypto.ComputeSharedSecret(a.keyPair.PrivateKey, peerPubBytes)
		if err != nil {
			log.Printf("[E2EE] Key derivation failed: %v", err)
			return
		}

		a.mutex.Lock()
		a.sharedSecretKey = secret
		a.mutex.Unlock()

		// Send our public key to mobile (unencrypted handshake response)
		ourPubB64 := base64.StdEncoding.EncodeToString(a.keyPair.PublicKey)
		respBytes, _ := json.Marshal(HandshakeMessage{
			Type:      "handshake",
			PublicKey: ourPubB64,
		})

		a.webrtcManager.SendMessage(respBytes)
		a.bleServer.SendStatusUpdate(respBytes)

		// Ask device identity (which will be sent encrypted next)
		log.Println("[E2EE] DH Exchange complete. Waiting for E2EE authentication packet...")

	case "encrypted":
		if a.sharedSecretKey == nil {
			log.Println("[E2EE] Received encrypted packet but secret key not established yet!")
			return
		}

		var wrapper EncryptedWrapper
		if err := json.Unmarshal(data, &wrapper); err != nil {
			return
		}

		encBytes, err := base64.StdEncoding.DecodeString(wrapper.Ciphertext)
		if err != nil {
			return
		}

		decBytes, err := crypto.Decrypt(encBytes, a.sharedSecretKey)
		if err != nil {
			log.Printf("[E2EE] Decryption failed! Key mismatch? %v", err)
			return
		}

		// Process decrypted payload
		a.handleDecryptedPayload(decBytes)
	}
}

func (a *App) handleDecryptedPayload(payload []byte) {
	var payloadMap map[string]interface{}
	if err := json.Unmarshal(payload, &payloadMap); err != nil {
		return
	}

	// Detect if it's the pairing request identity packet
	if reqType, ok := payloadMap["type"].(string); ok && reqType == "pairing-request" {
		deviceName, _ := payloadMap["deviceName"].(string)
		
		a.mutex.Lock()
		a.pendingDeviceName = deviceName
		a.mutex.Unlock()

		// Calculate fingerprint for verification (SHA256 representation of shared secret)
		fingerprintHash := crypto.DeriveKey("fingerprint", a.sharedSecretKey)
		fingerprintHex := fmt.Sprintf("%X", fingerprintHash[:4]) // 8-char display code

		log.Printf("[E2EE] Pairing request received from: %s (Fingerprint: %s)", deviceName, fingerprintHex)
		
		// Ask user via React UI event
		wailsRuntime.EventsEmit(a.ctx, "connection-request", map[string]string{
			"deviceName":  deviceName,
			"fingerprint": fingerprintHex,
		})
		return
	}

	if !a.paired {
		log.Println("[E2EE] Warning: Ignoring command since pairing is not completed.")
		return
	}

	// Parse as ControlMessage
	var cmd ControlMessage
	if err := json.Unmarshal(payload, &cmd); err != nil {
		return
	}

	a.mutex.Lock()
	defer a.mutex.Unlock()

	if a.activePrez == nil {
		return
	}

	switch cmd.Action {
	case "next":
		if a.currentSlideIndex < a.activePrez.TotalSlides {
			a.currentSlideIndex++
			wailsRuntime.EventsEmit(a.ctx, "slide-change", a.currentSlideIndex)
			a.sendSlidesUpdate()
		}
	case "prev":
		if a.currentSlideIndex > 1 {
			a.currentSlideIndex--
			wailsRuntime.EventsEmit(a.ctx, "slide-change", a.currentSlideIndex)
			a.sendSlidesUpdate()
		}
	case "goto":
		if cmd.Index >= 1 && cmd.Index <= a.activePrez.TotalSlides {
			a.currentSlideIndex = cmd.Index
			wailsRuntime.EventsEmit(a.ctx, "slide-change", a.currentSlideIndex)
			a.sendSlidesUpdate()
		}
	case "laser":
		wailsRuntime.EventsEmit(a.ctx, "laser-move", map[string]float64{
			"x": cmd.X,
			"y": cmd.Y,
		})
	case "laser-off":
		wailsRuntime.EventsEmit(a.ctx, "laser-hide", nil)
	case "draw-start":
		wailsRuntime.EventsEmit(a.ctx, "draw-start", map[string]interface{}{
			"x":     cmd.X,
			"y":     cmd.Y,
			"tool":  cmd.Tool,
			"color": cmd.Color,
		})
	case "draw-move":
		wailsRuntime.EventsEmit(a.ctx, "draw-move", map[string]interface{}{
			"x": cmd.X,
			"y": cmd.Y,
		})
	case "draw-end":
		wailsRuntime.EventsEmit(a.ctx, "draw-end", nil)
	case "draw-clear":
		wailsRuntime.EventsEmit(a.ctx, "draw-clear", nil)
	case "fullscreen":
		wailsRuntime.EventsEmit(a.ctx, "toggle-fullscreen", nil)
	case "request-slides":
		a.sendSlidesUpdate()
	case "set-active-tab":
		a.activeClientTab = cmd.Tab
		if cmd.Tab == "laser" {
			a.sendSlidesUpdate()
		}
	}
}

// sendSlidesUpdate packages and encrypts the current slide state and index to the mobile app
func (a *App) sendSlidesUpdate() {
	if a.activePrez == nil || a.sharedSecretKey == nil {
		return
	}

	// Get current slide details
	var notes string
	var slideIndex = a.currentSlideIndex

	for _, slide := range a.activePrez.Slides {
		if slide.Index == slideIndex {
			notes = slide.Notes
			break
		}
	}

	// Prepare details structure
	toc := make([]map[string]interface{}, len(a.activePrez.Slides))
	for i, slide := range a.activePrez.Slides {
		toc[i] = map[string]interface{}{
			"index": slide.Index,
			"title": slide.Title,
		}
	}

	prezID := a.activePrez.ID
	prezSource := a.activePrez.Source
	prezName := a.activePrez.Name
	totalSlides := a.activePrez.TotalSlides
	activeClientTab := a.activeClientTab

	// Copy shared secret key to avoid race conditions
	sharedSecretKey := make([]byte, len(a.sharedSecretKey))
	copy(sharedSecretKey, a.sharedSecretKey)

	go func() {
		// 1. Fetch slide image for WebRTC (only needed for Wifi when the mobile is actively on the laser tab)
		var slideImage string
		if activeClientTab == "laser" && prezSource == "pptx" {
			img, err := a.GetSlideImageCompressed(prezID, slideIndex)
			if err == nil {
				slideImage = img
			}
		}

		// 2. Prepare WebRTC status payload WITH image
		updatePayloadWebRTC, _ := json.Marshal(map[string]interface{}{
			"type":              "status-update",
			"currentSlideIndex": slideIndex,
			"totalSlides":       totalSlides,
			"notes":             notes,
			"presentationName":  prezName,
			"toc":               toc,
			"slideImage":        slideImage,
		})

		// Encrypt WebRTC update
		encBytesWebRTC, err := crypto.Encrypt(updatePayloadWebRTC, sharedSecretKey)
		if err == nil {
			encWrapperWebRTC, _ := json.Marshal(EncryptedWrapper{
				Type:       "encrypted",
				Ciphertext: base64.StdEncoding.EncodeToString(encBytesWebRTC),
			})
			a.webrtcManager.SendMessage(encWrapperWebRTC)
		}

		// 3. Prepare BLE status payload WITH image (now optimized at 10-15KB)
		updatePayloadBLE, _ := json.Marshal(map[string]interface{}{
			"type":              "status-update",
			"currentSlideIndex": slideIndex,
			"totalSlides":       totalSlides,
			"notes":             notes,
			"presentationName":  prezName,
			"toc":               toc,
			"slideImage":        slideImage,
		})

		// Encrypt BLE update
		encBytesBLE, err := crypto.Encrypt(updatePayloadBLE, sharedSecretKey)
		if err == nil {
			encWrapperBLE, _ := json.Marshal(EncryptedWrapper{
				Type:       "encrypted",
				Ciphertext: base64.StdEncoding.EncodeToString(encBytesBLE),
			})
			a.bleServer.SendStatusUpdate(encWrapperBLE)
		}
	}()
}

func (a *App) handleConnectionState(state string) {
	log.Printf("[WebRTC] Connection state: %s", state)
	wailsRuntime.EventsEmit(a.ctx, "connection-state", state)

	if state == "disconnected" {
		a.mutex.Lock()
		a.paired = false
		a.sharedSecretKey = nil
		a.mutex.Unlock()
		wailsRuntime.EventsEmit(a.ctx, "paired-device", "")
	}
}

// -------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------

func getHostname() string {
	name, err := os.Hostname()
	if err != nil || name == "" {
		return "Presenter Desktop"
	}
	return name
}

func getLocalIPs() []string {
	var ips []string
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ips
	}
	for _, address := range addrs {
		if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				ips = append(ips, ipnet.IP.String())
			}
		}
	}
	if len(ips) == 0 {
		ips = append(ips, "127.0.0.1")
	}
	return ips
}

func generateRandomRoomID() string {
	letters := "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789" // clear readable chars
	result := make([]byte, 6)
	for i := range result {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(letters))))
		result[i] = letters[n.Int64()]
	}
	return string(result)
}

func generateRandomPasscode() string {
	result := make([]byte, 6)
	for i := range result {
		n, _ := rand.Int(rand.Reader, big.NewInt(10))
		result[i] = '0' + byte(n.Int64())
	}
	return string(result)
}

func (a *App) WriteDebugFile(filename string, content string) error {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	dir := filepath.Join(configDir, "ppt-dapp", "debug")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, filename), []byte(content), 0644)
}

func findPythonScript() (string, error) {
	// Try current directory
	if _, err := os.Stat("pptx_to_images.py"); err == nil {
		return filepath.Abs("pptx_to_images.py")
	}
	// Try executable directory
	exePath, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exePath)
		scriptPath := filepath.Join(exeDir, "pptx_to_images.py")
		if _, err := os.Stat(scriptPath); err == nil {
			return filepath.Abs(scriptPath)
		}
	}
	// Fallback: write the embedded python script to the user config directory
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user config dir: %w", err)
	}
	appDir := filepath.Join(configDir, "ppt-dapp")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create app config dir: %w", err)
	}
	scriptPath := filepath.Join(appDir, "pptx_to_images.py")
	if err := os.WriteFile(scriptPath, pptxToImagesPy, 0644); err != nil {
		return "", fmt.Errorf("failed to write embedded python script: %w", err)
	}
	return scriptPath, nil
}

func (a *App) exportPPTXToImages(pptxPath string, outputDir string) error {
	scriptPath, err := findPythonScript()
	if err != nil {
		return err
	}

	// Try running "python" first
	cmd := exec.Command("python", scriptPath, pptxPath, outputDir)
	hideConsoleWindow(cmd)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Fallback to "python3"
		cmd3 := exec.Command("python3", scriptPath, pptxPath, outputDir)
		hideConsoleWindow(cmd3)
		output3, err3 := cmd3.CombinedOutput()
		if err3 != nil {
			return fmt.Errorf("python run failed: %v (%s) and python3 run failed: %v (%s)", err, string(output), err3, string(output3))
		}
		log.Printf("[App] Python script output: %s", string(output3))
	} else {
		log.Printf("[App] Python script output: %s", string(output))
	}
	return nil
}

// SaveSlideImage saves a base64 encoded slide image (JPEG/PNG) generated by the frontend to disk.
// Wails will automatically bind this method to the frontend.
func (a *App) SaveSlideImage(prezID string, slideIndex int, base64Image string) error {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return err
	}

	imagesDir := filepath.Join(configDir, "ppt-dapp", "presentations", prezID+"_images")
	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		return fmt.Errorf("failed to create slide images directory: %w", err)
	}

	// Strip the prefix (e.g., "data:image/jpeg;base64,") if present
	parts := strings.Split(base64Image, ",")
	actualBase64 := base64Image
	if len(parts) > 1 {
		actualBase64 = parts[1]
	}

	data, err := base64.StdEncoding.DecodeString(actualBase64)
	if err != nil {
		return fmt.Errorf("failed to decode base64 slide image: %w", err)
	}

	// Save as "Slide<slideIndex>.PNG" to maintain consistency with GetSlideImage expectations
	imagePath := filepath.Join(imagesDir, fmt.Sprintf("Slide%d.PNG", slideIndex))
	if err := os.WriteFile(imagePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write slide image file: %w", err)
	}

	return nil
}

// ExportPresentationImages starts the background slide image export for a presentation and emits progress events.
// Wails will automatically bind this method to the frontend.
func (a *App) ExportPresentationImages(prezID string) error {
	var prez *storage.Presentation
	presentations := a.storage.GetPresentations()
	for _, p := range presentations {
		if p.ID == prezID {
			prezCopy := p
			prez = &prezCopy
			break
		}
	}

	if prez == nil {
		// Mock presentation check
		if prezID == "test-pptx-id" {
			prez = &storage.Presentation{
				ID:       "test-pptx-id",
				Source:   "pptx",
				FilePath: `C:\Users\sukha\Downloads\[EXT] Solution Challenge 2026 - Prototype PPT Template (1).pptx`,
			}
		} else {
			return errors.New("presentation not found")
		}
	}

	if prez.Source != "pptx" {
		return errors.New("presentation does not have local PPTX file")
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	imagesDir := filepath.Join(configDir, "ppt-dapp", "presentations", prez.ID+"_images")

	go func() {
		a.runSlideExportPipeline(prez.ID, prez.FilePath, imagesDir)
	}()

	return nil
}

func (a *App) runSlideExportPipeline(prezID string, pptxPath string, outputDir string) {
	// Emit initial 0% progress immediately to show the user that processing has started!
	wailsRuntime.EventsEmit(a.ctx, "export-progress", map[string]interface{}{
		"id":      prezID,
		"current": 0,
		"total":   100,
		"percent": 0,
	})

	scriptPath, err := findPythonScript()
	if err != nil {
		log.Printf("[Export] Failed to find script: %v", err)
		wailsRuntime.EventsEmit(a.ctx, "export-error", map[string]string{
			"id":    prezID,
			"error": fmt.Sprintf("Failed to find script: %v", err),
		})
		return
	}

	log.Printf("[Export] Launching export pipeline for %s...", prezID)
	// Try running "python" first
	cmd := exec.Command("python", scriptPath, pptxPath, outputDir)
	hideConsoleWindow(cmd)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("[Export] Failed to create stdout pipe: %v", err)
		wailsRuntime.EventsEmit(a.ctx, "export-error", map[string]string{
			"id":    prezID,
			"error": fmt.Sprintf("Failed to create pipe: %v", err),
		})
		return
	}

	var usesPython3 bool
	if err := cmd.Start(); err != nil {
		usesPython3 = true
		// Fallback to "python3"
		cmd = exec.Command("python3", scriptPath, pptxPath, outputDir)
		hideConsoleWindow(cmd)
		stdout, err = cmd.StdoutPipe()
		if err != nil {
			log.Printf("[Export] Failed to create stdout pipe for python3: %v", err)
			wailsRuntime.EventsEmit(a.ctx, "export-error", map[string]string{
				"id":    prezID,
				"error": fmt.Sprintf("Failed to create python3 pipe: %v", err),
			})
			return
		}
		if err := cmd.Start(); err != nil {
			log.Printf("[Export] Failed to start python/python3: %v", err)
			wailsRuntime.EventsEmit(a.ctx, "export-error", map[string]string{
				"id":    prezID,
				"error": fmt.Sprintf("Failed to launch python: %v", err),
			})
			return
		}
	}

	// Read stdout line by line
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "PROGRESS:") {
			parts := strings.Split(line, ":")
			if len(parts) == 3 {
				current, _ := strconv.Atoi(parts[1])
				total, _ := strconv.Atoi(parts[2])
				if total > 0 {
					percent := int(float64(current) / float64(total) * 100)
					wailsRuntime.EventsEmit(a.ctx, "export-progress", map[string]interface{}{
						"id":      prezID,
						"current": current,
						"total":   total,
						"percent": percent,
					})
				}
			}
		} else if strings.HasPrefix(line, "EXPORT_ERROR:") {
			errMsg := strings.TrimPrefix(line, "EXPORT_ERROR:")
			log.Printf("[Export] Python script returned error: %s", errMsg)
			wailsRuntime.EventsEmit(a.ctx, "export-error", map[string]string{
				"id":    prezID,
				"error": errMsg,
			})
		}
	}

	if err := cmd.Wait(); err != nil {
		log.Printf("[Export] Command finished with error: %v", err)
		wailsRuntime.EventsEmit(a.ctx, "export-error", map[string]string{
			"id":    prezID,
			"error": fmt.Sprintf("Command failed: %v (Python3: %v)", err, usesPython3),
		})
		return
	}

	log.Printf("[Export] Slides export complete for presentation %s", prezID)
	wailsRuntime.EventsEmit(a.ctx, "export-complete", map[string]string{
		"id": prezID,
	})
}

// GetSlideImage returns the base64-encoded PNG image of a specific slide
func (a *App) GetSlideImage(prezID string, slideIndex int) (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	// Slide file name matches "Slide<slideIndex>.PNG"
	imagePath := filepath.Join(configDir, "ppt-dapp", "presentations", prezID+"_images", fmt.Sprintf("Slide%d.PNG", slideIndex))

	// Check if file exists
	if _, err := os.Stat(imagePath); err != nil {
		// Try lowercase file extension just in case
		imagePathLower := filepath.Join(configDir, "ppt-dapp", "presentations", prezID+"_images", fmt.Sprintf("Slide%d.png", slideIndex))
		if _, err := os.Stat(imagePathLower); err != nil {
			return "", errors.New("slide image not ready or not found")
		}
		imagePath = imagePathLower
	}

	bytes, err := os.ReadFile(imagePath)
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(bytes), nil
}

func resizeImage(img image.Image, maxWidth int) image.Image {
	bounds := img.Bounds()
	originalWidth := bounds.Dx()
	originalHeight := bounds.Dy()
	if originalWidth <= maxWidth {
		return img
	}

	ratio := float64(originalWidth) / float64(maxWidth)
	height := int(float64(originalHeight) / ratio)

	newImg := image.NewRGBA(image.Rect(0, 0, maxWidth, height))
	for y := 0; y < height; y++ {
		for x := 0; x < maxWidth; x++ {
			origX := int(float64(x) * ratio)
			origY := int(float64(y) * ratio)
			newImg.Set(x, y, img.At(origX, origY))
		}
	}
	return newImg
}

// GetSlideImageCompressed reads the PNG slide image, resizes it, and encodes it to a low-quality JPEG
func (a *App) GetSlideImageCompressed(prezID string, slideIndex int) (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	imagePath := filepath.Join(configDir, "ppt-dapp", "presentations", prezID+"_images", fmt.Sprintf("Slide%d.PNG", slideIndex))
	if _, err := os.Stat(imagePath); err != nil {
		imagePathLower := filepath.Join(configDir, "ppt-dapp", "presentations", prezID+"_images", fmt.Sprintf("Slide%d.png", slideIndex))
		if _, err := os.Stat(imagePathLower); err != nil {
			return "", errors.New("slide image not ready or not found")
		}
		imagePath = imagePathLower
	}

	pngFile, err := os.Open(imagePath)
	if err != nil {
		return "", err
	}
	defer pngFile.Close()

	img, err := png.Decode(pngFile)
	if err != nil {
		return "", err
	}

	resizedImg := resizeImage(img, 600)

	var buf bytes.Buffer
	err = jpeg.Encode(&buf, resizedImg, &jpeg.Options{Quality: 60})
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}
