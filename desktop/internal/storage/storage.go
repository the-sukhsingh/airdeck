package storage

import (
	"encoding/json"
	"errors"
	"log"
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
	Source          string      `json:"source"` // "pptx", "pdf", or "google"
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

// Database represents the JSON schema
type Database struct {
	Settings      Settings       `json:"settings"`
	Presentations []Presentation `json:"presentations"`
}

// StorageManager manages the database load/save operations
type StorageManager struct {
	dbPath string
	db     *Database
	mutex  sync.RWMutex
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
			dbPath: filepath.Join(appDir, "library.json"),
			db: &Database{
				Settings: Settings{
					Theme:         "dark",
					PairedDevices: []string{},
				},
				Presentations: []Presentation{},
			},
		}

		// Auto-load library from disk if it exists
		if err := manager.load(); err != nil {
			log.Printf("[Storage] Error loading library.json: %v. Initializing default empty library.", err)
			manager.save()
		}
	})
	return manager
}

// load reads and parses the JSON library file
func (s *StorageManager) load() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if _, err := os.Stat(s.dbPath); os.IsNotExist(err) {
		return nil
	}

	data, err := os.ReadFile(s.dbPath)
	if err != nil {
		return err
	}

	var db Database
	if err := json.Unmarshal(data, &db); err != nil {
		return err
	}

	s.db = &db
	return nil
}

// save encodes and writes the database to library.json
func (s *StorageManager) save() error {
	rawJSON, err := json.MarshalIndent(s.db, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.dbPath, rawJSON, 0644)
}

// IsUnlocked returns true (always true now)
func (s *StorageManager) IsUnlocked() bool {
	return true
}

// FileExists checks if the database file exists on disk
func (s *StorageManager) FileExists() bool {
	_, err := os.Stat(s.dbPath)
	return !os.IsNotExist(err)
}

// InitializeNewStore dummy stub to keep API compatibility
func (s *StorageManager) InitializeNewStore(passphrase string) error {
	return nil
}

// UnlockStore dummy stub to keep API compatibility
func (s *StorageManager) UnlockStore(passphrase string) (bool, error) {
	return true, nil
}

// Save writes database to disk
func (s *StorageManager) Save() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	return s.save()
}

// ResetLock dummy stub to keep API compatibility
func (s *StorageManager) ResetLock() {}

// Operations on Presentations

func (s *StorageManager) GetPresentations() []Presentation {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.db.Presentations
}

func (s *StorageManager) AddPresentation(p Presentation) error {
	s.mutex.Lock()
	// Remove duplicate ID if exists
	for i, item := range s.db.Presentations {
		if item.ID == p.ID {
			s.db.Presentations[i] = p
			s.mutex.Unlock()
			return s.save()
		}
	}

	s.db.Presentations = append(s.db.Presentations, p)
	s.mutex.Unlock()
	return s.save()
}

func (s *StorageManager) RemovePresentation(id string) error {
	s.mutex.Lock()
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

	// Delete file and images folder if they exist
	p := s.db.Presentations[index]
	if (p.Source == "pptx" || p.Source == "pdf") && p.FilePath != "" {
		os.Remove(p.FilePath)
		imagesDir := filepath.Join(filepath.Dir(p.FilePath), p.ID+"_images")
		os.RemoveAll(imagesDir)
	}

	s.db.Presentations = append(s.db.Presentations[:index], s.db.Presentations[index+1:]...)
	s.mutex.Unlock()
	return s.save()
}

func (s *StorageManager) StarPresentation(id string, star bool) error {
	s.mutex.Lock()
	for i, p := range s.db.Presentations {
		if p.ID == id {
			s.db.Presentations[i].IsStarred = star
			s.mutex.Unlock()
			return s.save()
		}
	}

	s.mutex.Unlock()
	return errors.New("presentation not found")
}

func (s *StorageManager) MovePresentationToFolder(id string, folder string) error {
	s.mutex.Lock()
	for i, p := range s.db.Presentations {
		if p.ID == id {
			s.db.Presentations[i].Folder = folder
			s.mutex.Unlock()
			return s.save()
		}
	}

	s.mutex.Unlock()
	return errors.New("presentation not found")
}

// Settings operations

func (s *StorageManager) GetSettings() Settings {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.db.Settings
}

func (s *StorageManager) SaveSettings(settings Settings) error {
	s.mutex.Lock()
	s.db.Settings = settings
	s.mutex.Unlock()
	return s.save()
}
