package pdf

import (
	"bytes"
	"desktop/internal/storage"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// ParsePDF extracts metadata from a PDF file and returns slide-like data.
// Each page is treated as a "slide".
func ParsePDF(filePath string) ([]storage.SlideData, error) {
	pageCount, err := getPdfPageCount(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get PDF page count: %w", err)
	}

	var slides []storage.SlideData
	for i := 1; i <= pageCount; i++ {
		slides = append(slides, storage.SlideData{
			Index: i,
			Title: fmt.Sprintf("Page %d", i),
			Notes: "",
			Texts: []string{},
		})
	}

	return slides, nil
}

// getPdfPageCount returns the number of pages in a PDF file.
// Tries PyMuPDF (Python fitz) first, then falls back to raw byte scanning.
func getPdfPageCount(filePath string) (int, error) {
	// Primary: PyMuPDF via Python (pip install pymupdf)
	count, err := getPdfPageCountPyMuPDF(filePath)
	if err == nil && count > 0 {
		return count, nil
	}

	// Fallback: raw PDF byte scanning (works without any external tools)
	return getPdfPageCountRaw(filePath)
}

// getPdfPageCountPyMuPDF uses PyMuPDF (fitz) to count pages.
func getPdfPageCountPyMuPDF(filePath string) (int, error) {
	escapedPath := strings.ReplaceAll(filePath, `\`, `\\`)
	script := fmt.Sprintf(`import fitz; doc = fitz.open("%s"); print(len(doc)); doc.close()`, escapedPath)

	cmd := exec.Command("python", "-c", script)
	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return 0, fmt.Errorf("PyMuPDF failed: %w — %s", err, stderr.String())
	}

	count, err := strconv.Atoi(strings.TrimSpace(out.String()))
	if err != nil {
		return 0, fmt.Errorf("could not parse page count from PyMuPDF: %w", err)
	}
	return count, nil
}

// getPdfPageCountRaw counts PDF pages by scanning the "Count" value in the page tree.
// This is a lightweight fallback requiring no external tools.
func getPdfPageCountRaw(filePath string) (int, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return 0, fmt.Errorf("failed to read PDF: %w", err)
	}

	// Look for /Count N in the page tree — this is the authoritative page count.
	// A well-formed PDF has exactly one root /Pages dict whose /Count is total pages.
	// We scan all occurrences and take the largest (the root node).
	maxCount := 0
	searchBytes := []byte("/Count ")
	pos := 0
	for {
		idx := bytes.Index(data[pos:], searchBytes)
		if idx < 0 {
			break
		}
		pos += idx + len(searchBytes)
		// Read the number following "/Count "
		numEnd := pos
		for numEnd < len(data) && data[numEnd] >= '0' && data[numEnd] <= '9' {
			numEnd++
		}
		if numEnd > pos {
			n, err := strconv.Atoi(string(data[pos:numEnd]))
			if err == nil && n > maxCount {
				maxCount = n
			}
		}
	}

	if maxCount == 0 {
		return 0, fmt.Errorf("could not determine page count from PDF structure")
	}
	return maxCount, nil
}

// RenderPDFPageToImage renders a specific PDF page to an image file.
// Returns the path to the generated image.
func RenderPDFPageToImage(pdfPath string, pageNum int, outputDir string, outputID string) (string, error) {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create output directory: %w", err)
	}

	outputPath := filepath.Join(outputDir, fmt.Sprintf("%s_page_%d.png", outputID, pageNum))

	// Primary: PyMuPDF (pip install pymupdf) — pure Python, no system tools needed
	if err := renderWithPyMuPDF(pdfPath, pageNum, outputPath); err == nil {
		return outputPath, nil
	}

	// Fallback: pdftoppm (poppler-utils) if installed
	if pdftoppmPath, err := exec.LookPath("pdftoppm"); err == nil {
		outputBase := filepath.Join(outputDir, fmt.Sprintf("%s_page_%d", outputID, pageNum))
		return renderWithPdftoppm(pdfPath, pageNum, outputBase, pdftoppmPath)
	}

	return "", fmt.Errorf(
		"no PDF rendering backend available — install PyMuPDF: pip install pymupdf",
	)
}

// renderWithPyMuPDF uses PyMuPDF (fitz) to render a single page to a PNG file.
func renderWithPyMuPDF(pdfPath string, pageNum int, outputPath string) error {
	escapedPdf := strings.ReplaceAll(pdfPath, `\`, `\\`)
	escapedOut := strings.ReplaceAll(outputPath, `\`, `\\`)

	script := fmt.Sprintf(`
import fitz
doc = fitz.open("%s")
page = doc[%d - 1]
mat = fitz.Matrix(2, 2)  # 2x zoom = ~144 DPI on a 72dpi base
pix = page.get_pixmap(matrix=mat)
pix.save("%s")
doc.close()
print("ok")
`, escapedPdf, pageNum, escapedOut)

	cmd := exec.Command("python", "-c", script)
	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("PyMuPDF render failed: %w — %s", err, stderr.String())
	}
	if strings.TrimSpace(out.String()) != "ok" {
		return fmt.Errorf("PyMuPDF render unexpected output: %s", out.String())
	}
	if _, err := os.Stat(outputPath); err != nil {
		return fmt.Errorf("output image was not created at %s", outputPath)
	}
	return nil
}

// renderWithPdftoppm uses poppler's pdftoppm to render PDF pages (fallback).
func renderWithPdftoppm(pdfPath string, pageNum int, outputBase string, pdftoppmPath string) (string, error) {
	cmd := exec.Command(
		pdftoppmPath,
		"-png",
		"-r", "150",
		"-f", strconv.Itoa(pageNum),
		"-l", strconv.Itoa(pageNum),
		pdfPath,
		outputBase,
	)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("pdftoppm failed: %w, stderr: %s", err, stderr.String())
	}

	// pdftoppm outputs as output_prefix-N.png with varying zero-padding
	for _, pat := range []string{"%s-%d.png", "%s-%02d.png", "%s-%03d.png"} {
		path := fmt.Sprintf(pat, outputBase, pageNum)
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	return "", fmt.Errorf("could not find output image from pdftoppm")
}

// RenderAllPDFPages renders all pages of a PDF to images.
func RenderAllPDFPages(pdfPath string, outputDir string, outputID string, onProgress func(current, total int)) ([]string, error) {
	pageCount, err := getPdfPageCount(pdfPath)
	if err != nil {
		return nil, err
	}

	var imagePaths []string
	for i := 1; i <= pageCount; i++ {
		if onProgress != nil {
			onProgress(i, pageCount)
		}

		imgPath, err := RenderPDFPageToImage(pdfPath, i, outputDir, outputID)
		if err != nil {
			return nil, fmt.Errorf("failed to render page %d: %w", i, err)
		}
		imagePaths = append(imagePaths, imgPath)
	}

	return imagePaths, nil
}

// GetPdfPageImageAsBase64 renders a PDF page and returns it as a base64 data URI.
func GetPdfPageImageAsBase64(pdfPath string, pageNum int) (string, error) {
	tempDir, err := os.MkdirTemp("", "pdf-render-*")
	if err != nil {
		return "", fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	imgPath, err := RenderPDFPageToImage(pdfPath, pageNum, tempDir, "temp")
	if err != nil {
		return "", err
	}

	imgData, err := os.ReadFile(imgPath)
	if err != nil {
		return "", fmt.Errorf("failed to read rendered image: %w", err)
	}

	return "data:image/png;base64," + encodeBase64(imgData), nil
}

// RenderPdfPageToImageObject renders a PDF page and returns an image.Image object.
func RenderPdfPageToImageObject(pdfPath string, pageNum int) (image.Image, error) {
	tempDir, err := os.MkdirTemp("", "pdf-render-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	imgPath, err := RenderPDFPageToImage(pdfPath, pageNum, tempDir, "temp")
	if err != nil {
		return nil, err
	}

	file, err := os.Open(imgPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open rendered image: %w", err)
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	return img, nil
}

// encodeBase64 encodes bytes to a URL-safe base64 string (no padding).
func encodeBase64(data []byte) string {
	return strings.TrimRight(
		strings.ReplaceAll(
			string(encodeBase64Raw(data)),
			"+", "-",
		),
		"=",
	)
}

func encodeBase64Raw(data []byte) []byte {
	dst := make([]byte, ((len(data)+2)/3)*4)
	base64Encode(dst, data)
	return dst
}

func base64Encode(dst, src []byte) {
	const encodeStd = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

	di, si := 0, 0
	n := (len(src) / 3) * 3
	for si < n {
		val := uint(src[si+0])<<16 | uint(src[si+1])<<8 | uint(src[si+2])
		dst[di+0] = encodeStd[val>>18&0x3F]
		dst[di+1] = encodeStd[val>>12&0x3F]
		dst[di+2] = encodeStd[val>>6&0x3F]
		dst[di+3] = encodeStd[val&0x3F]
		si += 3
		di += 4
	}

	remain := len(src) - si
	if remain == 0 {
		return
	}

	val := uint(src[si+0]) << 16
	if remain == 2 {
		val |= uint(src[si+1]) << 8
	}
	dst[di+0] = encodeStd[val>>18&0x3F]
	dst[di+1] = encodeStd[val>>12&0x3F]

	switch remain {
	case 2:
		dst[di+2] = encodeStd[val>>6&0x3F]
		dst[di+3] = '='
	case 1:
		dst[di+2] = '='
		dst[di+3] = '='
	}
}

// SaveImageToFile saves an image to a file in the specified format.
func SaveImageToFile(img image.Image, filePath string, format string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	switch strings.ToLower(format) {
	case "png":
		return png.Encode(file, img)
	case "jpg", "jpeg":
		return jpeg.Encode(file, img, &jpeg.Options{Quality: 90})
	default:
		return fmt.Errorf("unsupported image format: %s", format)
	}
}
