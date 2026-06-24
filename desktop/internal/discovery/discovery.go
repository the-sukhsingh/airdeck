package discovery

import (
	"encoding/json"
	"fmt"
	"net"
	"sync"
)

// DiscoveryResponse holds the network configuration sent to the mobile app
type DiscoveryResponse struct {
	Service string   `json:"service"` // Must be "ppt-dapp"
	Name    string   `json:"name"`    // Friendly name of this computer
	IPs     []string `json:"ips"`     // List of local IP addresses
	Port    int      `json:"port"`    // Port of WebSocket/HTTP signaling server
	Active  bool     `json:"active"`  // Whether a session is active
}

// DiscoveryServer handles incoming discovery requests
type DiscoveryServer struct {
	conn       *net.UDPConn
	running    bool
	mutex      sync.Mutex
	stopChan   chan struct{}
	wsPort     int
	deviceName string
	sessionActive bool
}

// NewDiscoveryServer creates a new UDP Discovery Server instance
func NewDiscoveryServer(wsPort int, deviceName string) *DiscoveryServer {
	return &DiscoveryServer{
		wsPort:     wsPort,
		deviceName: deviceName,
		stopChan:   make(chan struct{}),
	}
}

// SetSessionActive updates whether there is an ongoing presentation room
func (s *DiscoveryServer) SetSessionActive(active bool) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.sessionActive = active
}

// Start starts the UDP listener in the background on the specified port
func (s *DiscoveryServer) Start(port int) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.running {
		return nil
	}

	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("0.0.0.0:%d", port))
	if err != nil {
		return err
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return err
	}

	s.conn = conn
	s.running = true
	s.stopChan = make(chan struct{})

	go s.listenLoop()
	return nil
}

// Stop terminates the UDP listener
func (s *DiscoveryServer) Stop() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.running {
		return
	}

	s.running = false
	close(s.stopChan)
	if s.conn != nil {
		s.conn.Close()
	}
}

func (s *DiscoveryServer) listenLoop() {
	buffer := make([]byte, 1024)

	for {
		// Read from UDP socket
		n, remoteAddr, err := s.conn.ReadFromUDP(buffer)
		if err != nil {
			s.mutex.Lock()
			running := s.running
			s.mutex.Unlock()
			if !running {
				return // Closed normally
			}
			continue
		}

		message := string(buffer[:n])
		if message == "DISCOVER_PPT_DAPP" {
			s.respond(remoteAddr)
		}
	}
}

func (s *DiscoveryServer) respond(addr *net.UDPAddr) {
	s.mutex.Lock()
	response := DiscoveryResponse{
		Service: "ppt-dapp",
		Name:    s.deviceName,
		IPs:     getLocalIPs(),
		Port:    s.wsPort,
		Active:  s.sessionActive,
	}
	s.mutex.Unlock()

	data, err := json.Marshal(response)
	if err != nil {
		return
	}

	// Reply to sender
	s.conn.WriteToUDP(data, addr)
}

// Helper to get local network IPv4 addresses
func getLocalIPs() []string {
	var ips []string
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ips
	}

	for _, address := range addrs {
		// Check the address type and make sure it is not loopback
		if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				ips = append(ips, ipnet.IP.String())
			}
		}
	}

	// Fallback to hostname if no IPs found
	if len(ips) == 0 {
		ips = append(ips, "127.0.0.1")
	}
	return ips
}
