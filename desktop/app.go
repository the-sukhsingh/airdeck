package main

import (
	"context"
	"crypto/rand"
	"desktop/internal/ble"
	"desktop/internal/crypto"
	"desktop/internal/discovery"
	"desktop/internal/pptx"
	"desktop/internal/storage"
	"desktop/internal/webrtc"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type ControlMessage struct {
	Action string  `json:"action"`          // "next", "prev", "goto", "laser", "laser-off", "request-slides"
	Index  int     `json:"index,omitempty"` // For "goto"
	X      float64 `json:"x,omitempty"`     // For "laser" (0.0 to 1.0)
	Y      float64 `json:"y,omitempty"`     // For "laser" (0.0 to 1.0)
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
	roomID           string
	passcode         string
	activePrez       *storage.Presentation
	currentSlideIndex int // 1-indexed

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
	// Try to start BLE
	a.bleServer.Start()
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
		} else {
			log.Printf("[Library] Failed to parse mock presentation: %v", err)
		}
		return []storage.Presentation{mockP}, nil
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

	slides, err := pptx.ParsePPTX(filePath)
	if err != nil {
		return storage.Presentation{}, fmt.Errorf("parsing failed: %w", err)
	}

	fileName := filepath.Base(filePath)
	id := uuid.New().String()

	p := storage.Presentation{
		ID:        id,
		Name:      fileName,
		Source:    "pptx",
		FilePath:  filePath,
		IsStarred: false,
		Folder:    "",
		TotalSlides: len(slides),
		Slides:    slides,
		CreatedAt: time.Now().UnixNano() / int64(time.Millisecond),
	}

	err = a.storage.AddPresentation(p)
	return p, err
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


// SaveGoogleSlidesLink saves a Google Slide URL to the library
func (a *App) AddGoogleSlidesLink(name string, url string) (storage.Presentation, error) {
	if !a.storage.IsUnlocked() {
		return storage.Presentation{}, errors.New("database locked")
	}

	if url == "" || name == "" {
		return storage.Presentation{}, errors.New("name and URL cannot be empty")
	}

	id := uuid.New().String()
	p := storage.Presentation{
		ID:              id,
		Name:            name,
		Source:          "google",
		GoogleSlidesURL: url,
		IsStarred:       false,
		Folder:          "",
		TotalSlides:     100, // Large number placeholder for web presentations
		Slides:          []storage.SlideData{},
		CreatedAt:       time.Now().UnixNano() / int64(time.Millisecond),
	}

	err := a.storage.AddPresentation(p)
	return p, err
}

// GetPresentationBytes reads the raw file bytes for a PPTX presentation from disk
func (a *App) GetPresentationBytes(id string) ([]byte, error) {
	return os.ReadFile(`C:\Users\sukha\Downloads\[EXT] Solution Challenge 2026 - Prototype PPT Template (1).pptx`)
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
	a.bleServer.Stop()
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
	// Parse as base wrapper first
	var base map[string]interface{}
	if err := json.Unmarshal(data, &base); err != nil {
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
	case "request-slides":
		a.sendSlidesUpdate()
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

	updatePayload, _ := json.Marshal(map[string]interface{}{
		"type":              "status-update",
		"currentSlideIndex": slideIndex,
		"totalSlides":       a.activePrez.TotalSlides,
		"notes":             notes,
		"presentationName":  a.activePrez.Name,
		"toc":               toc,
	})

	// Encrypt status update
	encBytes, err := crypto.Encrypt(updatePayload, a.sharedSecretKey)
	if err != nil {
		return
	}

	encWrapper, _ := json.Marshal(EncryptedWrapper{
		Type:       "encrypted",
		Ciphertext: base64.StdEncoding.EncodeToString(encBytes),
	})

	a.webrtcManager.SendMessage(encWrapper)
	a.bleServer.SendStatusUpdate(encWrapper)
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
	dir := `C:\Users\sukha\.gemini\antigravity-ide\brain\60d42e6c-8c9a-4947-83ab-2ed109217652\scratch`
	return os.WriteFile(filepath.Join(dir, filename), []byte(content), 0644)
}
