package ble

import (
	"errors"
	"fmt"
	"log"
	"sync"
)

// BLEServer manages Bluetooth LE advertising and GATT characteristics
type BLEServer struct {
	running       bool
	mutex         sync.Mutex
	deviceName    string
	onWriteCmd    func(data []byte)
	onNotifyReady func(sendNotify func(data []byte) error)
	stopChan      chan struct{}
}

// NewBLEServer creates a new instance of BLEServer
func NewBLEServer(deviceName string) *BLEServer {
	return &BLEServer{
		deviceName: deviceName,
		stopChan:   make(chan struct{}),
	}
}

// SetCallbacks sets handlers for incoming data and notification readiness
func (s *BLEServer) SetCallbacks(onWriteCmd func(data []byte), onNotifyReady func(sendNotify func(data []byte) error)) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.onWriteCmd = onWriteCmd
	s.onNotifyReady = onNotifyReady
}

// Start boots the BLE advertising and GATT service.
// This is designed with a mock fallback in case tinygo-org/bluetooth is not fully
// supported or configured by the OS build environment.
func (s *BLEServer) Start() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.running {
		return nil
	}

	log.Printf("[BLE] Starting Bluetooth LE Peripheral advertising as: %s", s.deviceName)
	
	// We will attempt to run the BLE driver.
	// Since compiling tinygo-org/bluetooth on Windows/Mac/Linux can sometimes require 
	// native headers (like Bluez on Linux or Cgo setup), we decouple the interface
	// so the application remains compile-safe.
	
	err := s.startNativeBLE()
	if err != nil {
		log.Printf("[BLE] Bluetooth LE driver is disabled (stub compiled). Running in Wi-Fi-only mode.")
		// We do not return error so the application doesn't crash, it just operates on WiFi/WebRTC
		return nil
	}

	s.running = true
	return nil
}

// Stop terminates BLE advertising
func (s *BLEServer) Stop() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.running {
		return
	}

	log.Println("[BLE] Stopping Bluetooth LE Peripheral")
	s.stopNativeBLE()
	s.running = false
}

// startNativeBLE contains the actual tinygo-org/bluetooth code.
// To keep compiling simple and ensure the project builds out of the box,
// we define a soft-fail handler.
func (s *BLEServer) startNativeBLE() error {
	// If you have tinygo-org/bluetooth installed, you can enable this block:
	/*
	adapter := bluetooth.DefaultAdapter
	err := adapter.Enable()
	if err != nil {
		return err
	}

	// Define UUIDs
	serviceUUID, _ := bluetooth.ParseUUID("d4067332-9cb7-4a02-b06d-e4fb92d326f5")
	writeUUID, _ := bluetooth.ParseUUID("d4067332-9cb7-4a02-b06d-e4fb92d326f6")
	notifyUUID, _ := bluetooth.ParseUUID("d4067332-9cb7-4a02-b06d-e4fb92d326f7")

	err = adapter.AddService(&bluetooth.Service{
		UUID: serviceUUID,
		Characteristics: []bluetooth.Characteristic{
			{
				UUID: writeUUID,
				Flags: bluetooth.CharacteristicWritePermission | bluetooth.CharacteristicWriteWithoutResponsePermission,
				WriteEvent: func(client bluetooth.Connection, offset int, value []byte) {
					if s.onWriteCmd != nil {
						s.onWriteCmd(value)
					}
				},
			},
			{
				UUID: notifyUUID,
				Flags: bluetooth.CharacteristicNotifyPermission,
				// Capture the sender function
			},
		},
	})
	if err != nil {
		return err
	}

	adv := adapter.DefaultAdvertisement()
	err = adv.Configure(bluetooth.AdvertisementOptions{
		LocalName: s.deviceName,
		ServiceUUIDs: []bluetooth.UUID{serviceUUID},
	})
	if err != nil {
		return err
	}

	err = adv.Start()
	if err != nil {
		return err
	}
	*/

	// Returning a mock error to indicate BLE is compiled as disabled/stub.
	// Wails/Go projects typically run on local WiFi/WebRTC by default,
	// which is faster and supports higher bandwidth for slide previews/laser coordinates.
	return errors.New("bluetooth hardware driver not initialized (stub compiled)")
}

func (s *BLEServer) stopNativeBLE() {
	// Stop advertising logic
}

func (s *BLEServer) SendStatusUpdate(data []byte) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.running {
		return errors.New("BLE server not running")
	}

	// Send BLE notification payload
	return fmt.Errorf("BLE hardware interface unavailable")
}
