package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"
)

// DeriveKey derives a 32-byte AES key from a passphrase and a salt using SHA-256.
func DeriveKey(passphrase string, salt []byte) []byte {
	hasher := sha256.New()
	hasher.Write(salt)
	hasher.Write([]byte(passphrase))
	return hasher.Sum(nil)
}

// Encrypt encrypts plaintext using AES-256-GCM.
// The output is nonce + ciphertext.
func Encrypt(plaintext []byte, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := aesGCM.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

// Decrypt decrypts ciphertext (formatted as nonce + ciphertext) using AES-256-GCM.
func Decrypt(ciphertext []byte, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := aesGCM.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce, actualCiphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, actualCiphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

// KeyPair represents an ECDH key pair
type KeyPair struct {
	PrivateKey *ecdh.PrivateKey
	PublicKey  []byte
}

// GenerateECDHKeyPair generates a new P-256 private/public key pair.
func GenerateECDHKeyPair() (*KeyPair, error) {
	priv, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	return &KeyPair{
		PrivateKey: priv,
		PublicKey:  priv.PublicKey().Bytes(),
	}, nil
}

// ComputeSharedSecret derives a shared 32-byte AES key from a private key and a peer's public key.
func ComputeSharedSecret(privateKey *ecdh.PrivateKey, peerPublicKeyBytes []byte) ([]byte, error) {
	peerPub, err := ecdh.P256().NewPublicKey(peerPublicKeyBytes)
	if err != nil {
		return nil, err
	}

	secret, err := privateKey.ECDH(peerPub)
	if err != nil {
		return nil, err
	}

	// Run through SHA-256 to hash the secret into a fixed-length 32-byte key
	hash := sha256.Sum256(secret)
	return hash[:], nil
}

