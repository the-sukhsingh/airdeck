package storage

import (
	"crypto/rand"
	"desktop/internal/crypto"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

// SlideData represents slide content and speaker notes
type SlideData struct {
	Index int      `json:"index"`
	Title string   `json:"title"`
	Notes string   `json:"notes"`
	Texts []string `json:"texts,omitempty"` // Extracted text blocks
}

// Presentation represents a saved slide deck
type Presentation struct {
	ID              string      `json:"id"`
	Name            string      `json:"name"`
	Source          string      `json:"source"` // "pptx" or "google"
	FilePath        string      `json:"filePath,omitempty"`
	GoogleSlidesURL string      `json:"googleSlidesUrl,omitempty"`
	IsStarred       bool        `json:"isStarred"`
	Folder          string      `json:"folder"` // Empty string means root
	TotalSlides     int         `json:"totalSlides"`
	Slides          []SlideData `json:"slides"`
	CreatedAt       int64       `json:"createdAt"`
}

// Settings represents desktop settings
type Settings struct {
	Theme         string   `json:"theme"`
	PairedDevices []string `json:"pairedDevices"` // List of approved device IDs
}

// Database represents the decrypted JSON schema
type Database struct {
	Settings       Settings       `json:"settings"`
	Presentations  []Presentation `json:"presentations"`
}

// StorageManager manages the database load/save operations
type StorageManager struct {
	dbPath     string
	salt       []byte
	db         *Database
	key        []byte
	unlocked   bool
	mutex      sync.RWMutex
}

var (
	manager *StorageManager
	once    sync.Once
)

// GetStorageManager returns the singleton instance of StorageManager
func GetStorageManager() *StorageManager {
	once.Do(func() {
		configDir, _ := os.UserConfigDir()
		appDir := filepath.Join(configDir, "ppt-dapp")
		os.MkdirAll(appDir, 0755)

		manager = &StorageManager{
			dbPath: filepath.Join(appDir, "library.enc"),
			// Simple static salt for PBKDF/SHA key derivation
			salt: []byte("ppt-dapp-storage-salt-2026"),
			db: &Database{
				Settings: Settings{
					Theme:         "dark",
					PairedDevices: []string{},
				},
				Presentations: []Presentation{},
			},
		}
	})
	return manager
}

// IsUnlocked returns true if the store has been unlocked with the passcode
func (s *StorageManager) IsUnlocked() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.unlocked
}

// FileExists checks if the encrypted database file exists on disk
func (s *StorageManager) FileExists() bool {
	_, err := os.Stat(s.dbPath)
	return !os.IsNotExist(err)
}

// InitializeNewStore creates a new store with a brand new passcode
func (s *StorageManager) InitializeNewStore(passphrase string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if passphrase == "" {
		return errors.New("passphrase cannot be empty")
	}

	s.key = crypto.DeriveKey(passphrase, s.salt)
	s.unlocked = true

	// Save initial empty database
	return s.saveUnlocked()
}

// UnlockStore attempts to decrypt the database file with the given passphrase
func (s *StorageManager) UnlockStore(passphrase string) (bool, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.FileExists() {
		return false, errors.New("database file does not exist, initialize it first")
	}

	key := crypto.DeriveKey(passphrase, s.salt)
	encData, err := os.ReadFile(s.dbPath)
	if err != nil {
		return false, err
	}

	decData, err := crypto.Decrypt(encData, key)
	if err != nil {
		// Encryption decryption failure means invalid password
		return false, nil
	}

	var db Database
	if err := json.Unmarshal(decData, &db); err != nil {
		return false, err
	}

	s.db = &db
	s.key = key
	s.unlocked = true
	return true, nil
}

// Save encrypts and writes the database to disk
func (s *StorageManager) Save() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.unlocked {
		return errors.New("cannot save, database is locked")
	}

	return s.saveUnlocked()
}

// Helper to save without lock
func (s *StorageManager) saveUnlocked() error {
	rawJSON, err := json.Marshal(s.db)
	if err != nil {
		return err
	}

	encData, err := crypto.Encrypt(rawJSON, s.key)
	if err != nil {
		return err
	}

	return os.WriteFile(s.dbPath, encData, 0600)
}

// ResetLock locks the storage in memory
func (s *StorageManager) ResetLock() {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.key = nil
	s.unlocked = false
}

// Operations on Presentations

func (s *StorageManager) GetPresentations() []Presentation {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	if !s.unlocked {
		return nil
	}
	return s.db.Presentations
}

func (s *StorageManager) AddPresentation(p Presentation) error {
	s.mutex.Lock()
	if !s.unlocked {
		s.mutex.Unlock()
		return errors.New("database is locked")
	}

	// Remove duplicate ID if exists
	for i, item := range s.db.Presentations {
		if item.ID == p.ID {
			s.db.Presentations[i] = p
			s.mutex.Unlock()
			return s.Save()
		}
	}

	s.db.Presentations = append(s.db.Presentations, p)
	s.mutex.Unlock()
	return s.Save()
}

func (s *StorageManager) RemovePresentation(id string) error {
	s.mutex.Lock()
	if !s.unlocked {
		s.mutex.Unlock()
		return errors.New("database is locked")
	}

	index := -1
	for i, p := range s.db.Presentations {
		if p.ID == id {
			index = i
			break
		}
	}

	if index == -1 {
		s.mutex.Unlock()
		return errors.New("presentation not found")
	}

	s.db.Presentations = append(s.db.Presentations[:index], s.db.Presentations[index+1:]...)
	s.mutex.Unlock()
	return s.Save()
}

func (s *StorageManager) StarPresentation(id string, star bool) error {
	s.mutex.Lock()
	if !s.unlocked {
		s.mutex.Unlock()
		return errors.New("database is locked")
	}

	for i, p := range s.db.Presentations {
		if p.ID == id {
			s.db.Presentations[i].IsStarred = star
			s.mutex.Unlock()
			return s.Save()
		}
	}

	s.mutex.Unlock()
	return errors.New("presentation not found")
}

func (s *StorageManager) MovePresentationToFolder(id string, folder string) error {
	s.mutex.Lock()
	if !s.unlocked {
		s.mutex.Unlock()
		return errors.New("database is locked")
	}

	for i, p := range s.db.Presentations {
		if p.ID == id {
			s.db.Presentations[i].Folder = folder
			s.mutex.Unlock()
			return s.Save()
		}
	}

	s.mutex.Unlock()
	return errors.New("presentation not found")
}

// Settings operations

func (s *StorageManager) GetSettings() Settings {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	if !s.unlocked {
		return Settings{}
	}
	return s.db.Settings
}

func (s *StorageManager) SaveSettings(settings Settings) error {
	s.mutex.Lock()
	if !s.unlocked {
		s.mutex.Unlock()
		return errors.New("database is locked")
	}
	s.db.Settings = settings
	s.mutex.Unlock()
	return s.Save()
}

// GenerateRandomKey helper
func GenerateRandomKey() ([]byte, error) {
	key := make([]byte, 32)
	_, err := rand.Read(key)
	return key, err
}
