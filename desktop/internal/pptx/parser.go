package pptx

import (
	"archive/zip"
	"desktop/internal/storage"
	"encoding/xml"
	"fmt"
	"io"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Relationships schema structures
type Relationship struct {
	ID     string `xml:"Id,attr"`
	Type   string `xml:"Type,attr"`
	Target string `xml:"Target,attr"`
}

type Relationships struct {
	XMLName      xml.Name       `xml:"Relationships"`
	Relationship []Relationship `xml:"Relationship"`
}

const notesType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"

// ParsePPTX unzips and parses text/notes from a PPTX file.
func ParsePPTX(filePath string) ([]storage.SlideData, error) {
	reader, err := zip.OpenReader(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open zip file: %w", err)
	}
	defer reader.Close()

	// Map of slide file name (e.g. "ppt/slides/slide1.xml") to its extracted slide data
	slidesMap := make(map[string]*storage.SlideData)

	// Keep track of slide files we find
	var slideFiles []string
	// Map to track relation target for notes
	// slide file -> notes target file (e.g. "ppt/notesSlides/notesSlide1.xml")
	slideNotesRel := make(map[string]string)
	// Map of notes file -> extracted text
	notesContent := make(map[string]string)

	// Regexp to detect slides and slide rels (case-insensitive)
	slideRegex := regexp.MustCompile(`(?i)^ppt/slides/slide\d+\.xml$`)
	slideRelRegex := regexp.MustCompile(`(?i)^ppt/slides/_rels/slide\d+\.xml\.rels$`)
	notesRegex := regexp.MustCompile(`(?i)^ppt/notesSlides/notesSlide\d+\.xml$`)

	for _, f := range reader.File {
		name := strings.ReplaceAll(f.Name, "\\", "/")
		if slideRegex.MatchString(name) {
			slideFiles = append(slideFiles, name)
			slidesMap[name] = &storage.SlideData{
				Title: "",
				Notes: "",
				Texts: []string{},
			}
		}
	}

	// Sort slide files numerically
	sort.Slice(slideFiles, func(i, j int) bool {
		numI := extractNumber(slideFiles[i])
		numJ := extractNumber(slideFiles[j])
		return numI < numJ
	})

	// Process relationships and content
	for _, f := range reader.File {
		name := strings.ReplaceAll(f.Name, "\\", "/")
		if slideRelRegex.MatchString(name) {
			dir := path.Dir(path.Dir(name)) // usually "ppt/slides"
			base := path.Base(name)
			slideName := dir + "/" + strings.TrimSuffix(base, ".rels")
			
			rc, err := f.Open()
			if err == nil {
				notesTarget, err := parseSlideRels(rc)
				rc.Close()
				if err == nil && notesTarget != "" {
					resolvedTarget := cleanPath(dir + "/" + notesTarget)
					slideNotesRel[slideName] = resolvedTarget
				}
			}
		} else if notesRegex.MatchString(name) {
			rc, err := f.Open()
			if err == nil {
				text, err := extractXmlText(rc)
				rc.Close()
				if err == nil {
					notesContent[name] = text
				}
			}
		} else if slideRegex.MatchString(name) {
			rc, err := f.Open()
			if err == nil {
				texts, err := extractXmlTextSlice(rc)
				rc.Close()
				if err == nil && slidesMap[name] != nil {
					slidesMap[name].Texts = texts
					if len(texts) > 0 {
						// Guess title is the first text block (often true)
						slidesMap[name].Title = texts[0]
					}
				}
			}
		}
	}

	var results []storage.SlideData
	for idx, slideFile := range slideFiles {
		sData := slidesMap[slideFile]
		if sData == nil {
			continue
		}

		sData.Index = idx + 1
		if sData.Title == "" {
			sData.Title = fmt.Sprintf("Slide %d", sData.Index)
		}

		// Find notes content
		if notesFile, hasNotes := slideNotesRel[slideFile]; hasNotes {
			if text, found := notesContent[notesFile]; found {
				sData.Notes = text
			}
		}

		results = append(results, *sData)
	}

	return results, nil
}

// Extract slide number from file path string, e.g. "ppt/slides/slide12.xml" -> 12
func extractNumber(filePath string) int {
	re := regexp.MustCompile(`\d+`)
	match := re.FindString(path.Base(filePath))
	num, _ := strconv.Atoi(match)
	return num
}

func parseSlideRels(r io.Reader) (string, error) {
	var rels Relationships
	dec := xml.NewDecoder(r)
	if err := dec.Decode(&rels); err != nil {
		return "", err
	}

	for _, rel := range rels.Relationship {
		if rel.Type == notesType {
			return rel.Target, nil
		}
	}
	return "", nil
}

// Extracts all text inside <a:t> or <t> elements into a single joined string (useful for notes)
func extractXmlText(r io.Reader) (string, error) {
	dec := xml.NewDecoder(r)
	var textParts []string
	inTextTag := false

	for {
		t, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}

		switch se := t.(type) {
		case xml.StartElement:
			if se.Name.Local == "t" {
				inTextTag = true
			}
		case xml.EndElement:
			if se.Name.Local == "t" {
				inTextTag = false
			}
		case xml.CharData:
			if inTextTag {
				txt := strings.TrimSpace(string(se))
				if txt != "" {
					textParts = append(textParts, txt)
				}
			}
		}
	}

	return strings.Join(textParts, " "), nil
}

// Extracts all text inside <a:t> or <t> elements as a slice of text paragraphs (useful for slides)
func extractXmlTextSlice(r io.Reader) ([]string, error) {
	dec := xml.NewDecoder(r)
	var textParts []string
	inTextTag := false

	for {
		t, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		switch se := t.(type) {
		case xml.StartElement:
			if se.Name.Local == "t" {
				inTextTag = true
			}
		case xml.EndElement:
			if se.Name.Local == "t" {
				inTextTag = false
			}
		case xml.CharData:
			if inTextTag {
				txt := strings.TrimSpace(string(se))
				if txt != "" {
					textParts = append(textParts, txt)
				}
			}
		}
	}

	return textParts, nil
}

// Cleans target paths like "ppt/slides/../notesSlides/notesSlide1.xml" -> "ppt/notesSlides/notesSlide1.xml"
func cleanPath(p string) string {
	parts := strings.Split(p, "/")
	var result []string
	for _, part := range parts {
		if part == ".." {
			if len(result) > 0 {
				result = result[:len(result)-1]
			}
		} else if part != "." && part != "" {
			result = append(result, part)
		}
	}
	return strings.Join(result, "/")
}
