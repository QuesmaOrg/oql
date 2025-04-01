package backend

import (
	"net/http"
)

type Row []string
type Table struct {
	Names Row
	Rows  []Row
}

func EmptyTable() Table {
	return Table{}
}

type Request struct {
	Query string `json:"query"`
}

type ExecResponse struct {
	Table         Table  `json:"table"`
	TranspiledSQL string `json:"transpiledSQL"`
}

type ExecMultiResponse struct {
	Results []ExecResponse `json:"results"`
}

// Add new request type
type ExplainRequest struct {
	Query string `json:"query"`
	Table Table  `json:"table"`
}

type ExplainResponse struct {
	Explain string `json:"explain"`
}

// Add new request/response types

func cors(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
	(*w).Header().Set("Access-Control-Allow-Headers", "Content-Type")
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Content-Type", "application/json")
}

type TimeSeriesElement struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type TimeSeriesResponse struct {
	Data []TimeSeriesElement `json:"data"`
}
