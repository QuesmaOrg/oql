package backend

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

type SchemaDiscoveryRequest struct {
	DatabaseName string `json:"databaseName"`
}

type TableDefinition struct {
	Table       string   `json:"table"`
	Description string   `json:"description"`
	Columns     []string `json:"columns"`
}

type SchemaResponse struct {
	Tables []TableDefinition `json:"tables"`
}

func getTableDefinition(databaseName string, tableName string) (TableDefinition, error) {
	query := fmt.Sprintf("select column_name from information_schema.columns where table_schema = '%s' and table_name = '%s'", databaseName, tableName)

	rows, err := DefaultDB.Query(query)
	if err != nil {
		return TableDefinition{}, err
	}

	defer rows.Close()

	var columns []string

	for rows.Next() {
		var column string
		err = rows.Scan(&column)
		if err != nil {
			return TableDefinition{}, err
		}
		columns = append(columns, column)
	}

	if rows.Err() != nil {
		return TableDefinition{}, rows.Err()
	}

	return TableDefinition{
		Table:       tableName,
		Description: "",
		Columns:     columns,
	}, nil

}

func getTables(databaseName string) ([]string, error) {
	query := fmt.Sprintf("select table_name from information_schema.tables where table_schema = '%s'", databaseName)

	rows, err := DefaultDB.Query(query)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var tableNames []string

	for rows.Next() {
		var tableName string
		err = rows.Scan(&tableName)
		if err != nil {
			return nil, err
		}
		tableNames = append(tableNames, tableName)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}
	return tableNames, nil
}

func HandleSchemaDiscovery(w http.ResponseWriter, r *http.Request) {

	cors(&w)

	writeErr := func(msg string, err error) {
		log.Println("Error: ", msg, err)
		m := map[string]string{
			"error":   err.Error(),
			"message": msg,
		}
		b, _ := json.Marshal(m)
		w.WriteHeader(500)
		w.Write(b)
	}

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	jsonBody, err := io.ReadAll(r.Body)
	if err != nil {
		writeErr("Error reading body", err)
		return
	}
	defer r.Body.Close()

	var request SchemaDiscoveryRequest
	err = json.Unmarshal(jsonBody, &request)
	if err != nil {
		writeErr("Error unmarshalling body: ", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	response := SchemaResponse{}

	tableNames, err := getTables(request.DatabaseName)
	if err != nil {
		writeErr("Error getting tables", err)
		return
	}

	for _, tableName := range tableNames {
		tableDefinition, err := getTableDefinition(request.DatabaseName, tableName)
		if err != nil {
			writeErr("Error getting table definition", err)
			return
		}
		response.Tables = append(response.Tables, tableDefinition)
	}

	w.WriteHeader(200)

	responseBody, err := json.Marshal(response)
	if err != nil {
		writeErr("Error marshalling response: ", err)
		return
	}

	w.Write(responseBody)

}
