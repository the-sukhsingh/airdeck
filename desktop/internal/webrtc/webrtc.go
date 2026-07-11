package webrtc

import (
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
)

// SignalingMessage represents the JSON structure for WebSocket signaling
type SignalingMessage struct {
	Type      string `json:"type"`                // "offer", "answer", "candidate", "ping"
	SDP       string `json:"sdp,omitempty"`       // For offer/answer
	Candidate string `json:"candidate,omitempty"` // For trickle ICE
}

// WebRTCManager manages the PeerConnection and local signaling server
type WebRTCManager struct {
	peerConnection *webrtc.PeerConnection
	dataChannel    *webrtc.DataChannel
	httpServer     *http.Server
	wsPort         int
	mutex          sync.Mutex
	onMessage      func([]byte)
	onStateChange  func(string) // "connecting", "connected", "disconnected"
	pendingOffer   *webrtc.SessionDescription
	connected      bool
	wsConn         *websocket.Conn
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow connections from mobile clients on local network
	},
}

// NewWebRTCManager creates a WebRTC manager
func NewWebRTCManager(onMessage func([]byte), onStateChange func(string)) *WebRTCManager {
	return &WebRTCManager{
		onMessage:     onMessage,
		onStateChange: onStateChange,
	}
}

// StartLocalSignalingServer starts a WebSocket signaling server on a fixed port 8085 (or a random port if busy)
func (w *WebRTCManager) StartLocalSignalingServer() (int, error) {
	w.mutex.Lock()
	defer w.mutex.Unlock()

	if w.httpServer != nil {
		return w.wsPort, nil
	}

	// Try to bind to port 8085 first for static port firewall rules, fallback to random port
	listener, err := net.Listen("tcp", "0.0.0.0:8085")
	if err != nil {
		log.Printf("[WebRTC] Port 8085 busy, falling back to random port: %v", err)
		listener, err = net.Listen("tcp", "0.0.0.0:0")
		if err != nil {
			return 0, err
		}
	}
	port := listener.Addr().(*net.TCPAddr).Port
	w.wsPort = port

	mux := http.NewServeMux()
	mux.HandleFunc("/signaling", w.handleSignaling)

	w.httpServer = &http.Server{
		Handler:      mux,
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	go func() {
		log.Printf("[WebRTC] Local WebSocket signaling server listening on port %d", port)
		if err := w.httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("[WebRTC] Signaling server error: %v", err)
		}
	}()

	return port, nil
}

// Stop terminates the signaling server and active WebRTC connection
func (w *WebRTCManager) Stop() {
	w.mutex.Lock()
	wsConn := w.wsConn
	w.wsConn = nil
	w.connected = false
	w.mutex.Unlock()

	if wsConn != nil {
		wsConn.Close()
	}

	if w.httpServer != nil {
		w.httpServer.Close()
		w.httpServer = nil
	}

	if w.dataChannel != nil {
		w.dataChannel.Close()
		w.dataChannel = nil
	}

	if w.peerConnection != nil {
		w.peerConnection.Close()
		w.peerConnection = nil
	}

	if w.onStateChange != nil {
		w.onStateChange("disconnected")
	}
}

// Handle local network WebSocket signaling
func (w *WebRTCManager) handleSignaling(writer http.ResponseWriter, req *http.Request) {
	conn, err := upgrader.Upgrade(writer, req, nil)
	if err != nil {
		log.Printf("[WebRTC] WebSocket upgrade failed: %v", err)
		return
	}

	w.mutex.Lock()
	if w.wsConn == nil {
		w.wsConn = conn
	}
	w.mutex.Unlock()

	defer func() {
		w.mutex.Lock()
		wasConnected := w.connected
		if w.wsConn == conn {
			w.wsConn = nil
			w.connected = false
		}
		w.mutex.Unlock()

		if wasConnected && w.wsConn == nil && w.onStateChange != nil {
			w.onStateChange("disconnected")
		}
		conn.Close()
	}()

	log.Printf("[WebRTC] Mobile client connected to local signaling server from: %s", conn.RemoteAddr())

	// Initialize PeerConnection
	err = w.initPeerConnection()
	if err != nil {
		log.Printf("[WebRTC] Failed to initialize WebRTC PeerConnection: %v", err)
		return
	}

	// Send offer to mobile or wait for offer.
	// In our design, mobile connects and sends an offer first.
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[WebRTC] WebSocket read error: %v", err)
			break
		}

		var rawMsg map[string]interface{}
		if err := json.Unmarshal(message, &rawMsg); err != nil {
			continue
		}

		msgType, _ := rawMsg["type"].(string)

		switch msgType {
		case "offer":
			var sigMsg SignalingMessage
			if err := json.Unmarshal(message, &sigMsg); err != nil {
				continue
			}
			offer := webrtc.SessionDescription{
				Type: webrtc.SDPTypeOffer,
				SDP:  sigMsg.SDP,
			}
			
			w.mutex.Lock()
			pc := w.peerConnection
			w.mutex.Unlock()
			if pc == nil {
				log.Println("[WebRTC] PeerConnection is nil, ignoring offer")
				return
			}

			err := pc.SetRemoteDescription(offer)
			if err != nil {
				log.Printf("[WebRTC] SetRemoteDescription offer error: %v", err)
				return
			}

			// Create Answer
			answer, err := pc.CreateAnswer(nil)
			if err != nil {
				log.Printf("[WebRTC] CreateAnswer error: %v", err)
				return
			}

			err = pc.SetLocalDescription(answer)
			if err != nil {
				log.Printf("[WebRTC] SetLocalDescription answer error: %v", err)
				return
			}

			// Send answer back to mobile
			ansBytes, _ := json.Marshal(SignalingMessage{
				Type: "answer",
				SDP:  answer.SDP,
			})
			conn.WriteMessage(websocket.TextMessage, ansBytes)

		case "candidate":
			var sigMsg SignalingMessage
			if err := json.Unmarshal(message, &sigMsg); err != nil {
				continue
			}
			// Handle trickle ICE candidate from mobile
			var candidate webrtc.ICECandidateInit
			if err := json.Unmarshal([]byte(sigMsg.Candidate), &candidate); err == nil {
				w.mutex.Lock()
				pc := w.peerConnection
				w.mutex.Unlock()
				if pc != nil {
					pc.AddICECandidate(candidate)
				}
			}

		case "handshake", "encrypted":
			w.mutex.Lock()
			w.connected = true
			w.mutex.Unlock()

			if w.onStateChange != nil {
				w.onStateChange("connected")
			}
			if w.onMessage != nil {
				w.onMessage(message)
			}
		}
	}
}

func (w *WebRTCManager) initPeerConnection() error {
	w.mutex.Lock()
	defer w.mutex.Unlock()

	if w.peerConnection != nil {
		w.peerConnection.Close()
	}

	// Configure PeerConnection (use public Google STUN for NAT discovery)
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
		},
	}

	peerConnection, err := webrtc.NewPeerConnection(config)
	if err != nil {
		return err
	}
	w.peerConnection = peerConnection

	// Set connection state listener
	peerConnection.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		log.Printf("[WebRTC] Connection state changed: %s", s.String())
		if w.onStateChange != nil {
			switch s {
			case webrtc.PeerConnectionStateConnecting:
				w.onStateChange("connecting")
			case webrtc.PeerConnectionStateConnected:
				w.connected = true
				w.onStateChange("connected")
			case webrtc.PeerConnectionStateDisconnected, webrtc.PeerConnectionStateFailed:
				w.connected = false
				w.onStateChange("disconnected")
			}
		}
	})

	// When the DataChannel is established by the mobile client (which acts as the offerer/initiator)
	peerConnection.OnDataChannel(func(d *webrtc.DataChannel) {
		log.Printf("[WebRTC] Data channel opened by peer: %s", d.Label())
		w.dataChannel = d

		d.OnMessage(func(msg webrtc.DataChannelMessage) {
			if w.onMessage != nil {
				w.onMessage(msg.Data)
			}
		})

		d.OnClose(func() {
			log.Println("[WebRTC] Data channel closed")
			w.connected = false
			if w.onStateChange != nil {
				w.onStateChange("disconnected")
			}
		})
	})

	return nil
}

// GenerateManualOffer creates an SDP offer to show as a QR Code
func (w *WebRTCManager) GenerateManualOffer() (string, error) {
	err := w.initPeerConnection()
	if err != nil {
		return "", err
	}

	// We must create the data channel ourselves since we are creating the offer
	d, err := w.peerConnection.CreateDataChannel("ppt-control-channel", nil)
	if err != nil {
		return "", err
	}
	w.dataChannel = d

	d.OnMessage(func(msg webrtc.DataChannelMessage) {
		if w.onMessage != nil {
			w.onMessage(msg.Data)
		}
	})

	offer, err := w.peerConnection.CreateOffer(nil)
	if err != nil {
		return "", err
	}

	err = w.peerConnection.SetLocalDescription(offer)
	if err != nil {
		return "", err
	}

	// Wait for ICE gathering to complete so all candidates are baked into the SDP
	// (Essential for serverless / one-shot QR code connection!)
	gatherComplete := webrtc.GatheringCompletePromise(w.peerConnection)
	<-gatherComplete

	localDesc := w.peerConnection.LocalDescription()
	return localDesc.SDP, nil
}

// AcceptManualAnswer sets the remote SDP answer scanned via QR code
func (w *WebRTCManager) AcceptManualAnswer(sdp string) error {
	w.mutex.Lock()
	defer w.mutex.Unlock()

	if w.peerConnection == nil {
		return errors.New("no peer connection active, generate offer first")
	}

	answer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  sdp,
	}

	return w.peerConnection.SetRemoteDescription(answer)
}

// SendMessage sends raw bytes over the open WebRTC data channel or active WebSocket connection
func (w *WebRTCManager) SendMessage(data []byte) error {
	w.mutex.Lock()
	defer w.mutex.Unlock()

	if w.wsConn != nil {
		err := w.wsConn.WriteMessage(websocket.TextMessage, data)
		if err == nil {
			return nil
		}
		log.Printf("[WebRTC] WebSocket SendMessage error: %v", err)
	}

	if w.dataChannel != nil && w.connected {
		return w.dataChannel.Send(data)
	}

	return errors.New("no active data channel or websocket connection")
}
