package files

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/sirupsen/logrus"
)

var validFileID = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,128}$`)

func storagePath() string {
	p := os.Getenv("LOCAL_STORAGE_PATH")
	if p == "" {
		p = "./data"
	}
	return filepath.Join(p, "files")
}

func maxUploadBytes() int64 {
	if v := os.Getenv("FILE_UPLOAD_MAX_BYTES"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			return n
		}
	}
	return 10 * 1024 * 1024
}

func Init() {
	dir := storagePath()
	if err := os.MkdirAll(dir, 0755); err != nil {
		logrus.WithField("path", dir).Fatal("Failed to create file storage directory")
	}
	logrus.WithField("path", dir).Info("File storage initialized")
}

func HandleUpload() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fileID := chi.URLParam(r, "fileId")
		if !validFileID.MatchString(fileID) {
			http.Error(w, `{"error":"invalid file ID"}`, http.StatusBadRequest)
			return
		}

		limit := maxUploadBytes()
		limited := io.LimitReader(r.Body, limit+1)
		data, err := io.ReadAll(limited)
		if err != nil {
			logrus.WithError(err).Error("Failed to read upload body")
			http.Error(w, `{"error":"failed to read body"}`, http.StatusInternalServerError)
			return
		}
		defer r.Body.Close()

		if int64(len(data)) > limit {
			http.Error(w, `{"error":"file too large"}`, http.StatusRequestEntityTooLarge)
			return
		}

		dest := filepath.Join(storagePath(), fileID)
		if err := os.WriteFile(dest, data, 0644); err != nil {
			logrus.WithError(err).WithField("fileId", fileID).Error("Failed to write file")
			http.Error(w, `{"error":"failed to store file"}`, http.StatusInternalServerError)
			return
		}

		logrus.WithFields(logrus.Fields{
			"fileId": fileID,
			"size":   len(data),
		}).Info("File uploaded")

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"fileId":%q,"size":%d}`, fileID, len(data))
	}
}

func HandleDownload() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fileID := chi.URLParam(r, "fileId")
		if !validFileID.MatchString(fileID) {
			http.Error(w, `{"error":"invalid file ID"}`, http.StatusBadRequest)
			return
		}

		dest := filepath.Join(storagePath(), fileID)
		if _, err := os.Stat(dest); os.IsNotExist(err) {
			http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
			return
		}

		w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
		http.ServeFile(w, r, dest)
	}
}
