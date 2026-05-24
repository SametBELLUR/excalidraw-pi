package firebase

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/sirupsen/logrus"
)

type (
	BatchGetRequest struct {
		Documents []string `json:"documents"`
	}
	BatchGetEmptyResponse struct {
		Missing  string `json:"missing"`
		ReadTime string `json:"readTime"`
	}

	FoundInfoResponse struct {
		Name       string      `json:"name"`
		Fields     interface{} `json:"fields"`
		CreateTime string      `json:"createTime"`
		UpdateTime string      `json:"updateTime"`
	}
	BatchGetExistsResponse struct {
		Found    FoundInfoResponse `json:"found"`
		ReadTime string            `json:"readTime"`
	}

	UpdateRequest struct {
		Name   string      `json:"name"`
		Fields interface{} `json:"fields"`
	}
	WriteRequest struct {
		Update UpdateRequest `json:"update"`
	}
	BatchCommitRequest struct {
		Writes []WriteRequest `json:"writes"`
	}

	WriteResult struct {
		UpdateTime string `json:"updateTime"`
	}
	BatchCommitResponse struct {
		WriteResults []WriteResult `json:"writeResults"`
		CommitTime   string        `json:"commitTime"`
	}
)

var (
	savedItems = make(map[string]interface{})
	mu         sync.RWMutex
)

func (body *BatchGetRequest) Bind(r *http.Request) (err error) {
	return nil
}
func (body *BatchCommitRequest) Bind(r *http.Request) (err error) {
	return nil
}

func firestoreDir() string {
	p := os.Getenv("LOCAL_STORAGE_PATH")
	if p == "" {
		p = "./data"
	}
	return filepath.Join(p, "firestore")
}

func keyToFilename(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:]) + ".json"
}

func persistItem(key string, fields interface{}) {
	dir := firestoreDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		logrus.WithError(err).Error("Failed to create firestore directory")
		return
	}
	record := map[string]interface{}{
		"key":    key,
		"fields": fields,
	}
	data, err := json.Marshal(record)
	if err != nil {
		logrus.WithError(err).Error("Failed to marshal firestore record")
		return
	}
	path := filepath.Join(dir, keyToFilename(key))
	if err := os.WriteFile(path, data, 0644); err != nil {
		logrus.WithError(err).WithField("key", key).Error("Failed to persist firestore record")
	}
}

func loadItem(key string) (interface{}, bool) {
	path := filepath.Join(firestoreDir(), keyToFilename(key))
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}
	var record map[string]interface{}
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, false
	}
	return record["fields"], true
}

func Init() {
	dir := firestoreDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		logrus.WithField("path", dir).Fatal("Failed to create firestore directory")
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		logrus.WithError(err).Warn("Failed to read firestore directory")
		return
	}
	count := 0
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		var record map[string]interface{}
		if err := json.Unmarshal(data, &record); err != nil {
			continue
		}
		if key, ok := record["key"].(string); ok {
			savedItems[key] = record["fields"]
			count++
		}
	}
	if count > 0 {
		logrus.WithField("count", count).Info("Restored firestore records from disk")
	}
}

func HandleBatchCommit() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectId := chi.URLParam(r, "project_id")
		databaseId := chi.URLParam(r, "database_id")
		_ = projectId
		_ = databaseId

		data := &BatchCommitRequest{}
		if err := render.DecodeJSON(r.Body, data); err != nil {
			logrus.WithError(err).Warn("Failed to decode batch commit request")
			render.Status(r, http.StatusBadRequest)
			return
		}

		mu.Lock()
		key := data.Writes[0].Update.Name
		fields := data.Writes[0].Update.Fields
		savedItems[key] = fields
		mu.Unlock()

		go persistItem(key, fields)

		render.JSON(w, r, BatchCommitResponse{
			CommitTime: time.Now().Format(time.RFC3339),
			WriteResults: []WriteResult{
				{UpdateTime: time.Now().Format(time.RFC3339)},
			},
		})
		render.Status(r, http.StatusOK)
	}
}

func HandleBatchGet() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectId := chi.URLParam(r, "project_id")
		databaseId := chi.URLParam(r, "database_id")
		_ = projectId
		_ = databaseId

		data := &BatchGetRequest{}
		if err := render.DecodeJSON(r.Body, data); err != nil {
			logrus.WithError(err).Warn("Failed to decode batch get request")
			render.Status(r, http.StatusBadRequest)
			return
		}
		key := data.Documents[0]

		mu.RLock()
		fields, ok := savedItems[key]
		mu.RUnlock()

		if !ok {
			fields, ok = loadItem(key)
			if ok {
				mu.Lock()
				savedItems[key] = fields
				mu.Unlock()
			}
		}

		if !ok {
			render.JSON(w, r, []BatchGetEmptyResponse{{
				Missing:  key,
				ReadTime: time.Now().Format(time.RFC3339),
			}})
			render.Status(r, http.StatusOK)
			return
		}

		render.JSON(w, r, []BatchGetExistsResponse{{
			Found: FoundInfoResponse{
				Name:       key,
				Fields:     fields,
				CreateTime: time.Now().Format(time.RFC3339),
				UpdateTime: time.Now().Format(time.RFC3339),
			},
			ReadTime: time.Now().Format(time.RFC3339),
		}})
		render.Status(r, http.StatusOK)
	}
}
