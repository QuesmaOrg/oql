package backend

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/QuesmaOrg/quesma/platform/parsers/sql/parser/pipe_syntax"
	"github.com/QuesmaOrg/quesma/platform/parsers/sql/parser/transforms"

	lexer_core "github.com/QuesmaOrg/quesma/platform/parsers/sql/lexer/core"
	"github.com/QuesmaOrg/quesma/platform/parsers/sql/lexer/dialect_sqlparse"
	"github.com/QuesmaOrg/quesma/platform/parsers/sql/parser/core"
)

func HandleTimeSeries(w http.ResponseWriter, r *http.Request) {

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

	type TimeSeriesRequest struct {
		Query     string `json:"query"`
		StartDate int    `json:"startDate"`
		EndDate   int    `json:"endDate"`
		TableName string `json:"tableName"`
	}

	jsonBody, err := io.ReadAll(r.Body)
	if err != nil {
		writeErr("Error reading body", err)
		return
	}
	defer r.Body.Close()

	var request TimeSeriesRequest
	err = json.Unmarshal(jsonBody, &request)
	if err != nil {
		writeErr("Error unmarshalling body: ", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	var timestampField = "@timestamp"

	// some hardcoded table names and timestamp fields
	switch request.TableName {
	case "kibana_sample_data_logs":
		timestampField = "utc_time"
	case "device_logs":
		timestampField = "epoch_time"
	case "apache_logs", "linux_logs", "hadoop_logs", "openssh_logs", "machines_metrics":
		timestampField = "timestamp"
	}

	log.Println("TimeSeries Query: ", request.TableName, timestampField)

	query := fmt.Sprintf(" SELECT date_trunc('hour',`%s`), count(*)  FROM \"%s\" where `%s` between FROM_UNIXTIME(%d) and FROM_UNIXTIME(%d) GROUP BY  1 order by 1 ", timestampField, request.TableName, timestampField, request.StartDate, request.EndDate)

	log.Println("TimeSeries Query: ", query)

	tokens := lexer_core.Lex(query, dialect_sqlparse.SqlparseRules)
	node := core.TokensToNode(tokens)

	transforms.GroupParenthesis(node)
	pipe_syntax.GroupPipeSyntax(node)
	pipe_syntax.ExpandMacros(node)
	pipe_syntax.ExpandEnrichments(node, DefaultDB)
	pipe_syntax.Transpile(node)

	transpiledSQL := transforms.ConcatTokenNodes(node)

	rows, err := DefaultDB.Query(transpiledSQL)

	if err != nil {
		writeErr("Error executing timeseries query.", err)
		return
	}

	defer rows.Close()

	response := TimeSeriesResponse{
		Data: []TimeSeriesElement{},
	}

	for rows.Next() {
		var date string
		var count int
		err = rows.Scan(&date, &count)
		if err != nil {
			writeErr("Error scanning row", err)
			return
		}

		response.Data = append(response.Data, TimeSeriesElement{
			Date:  date,
			Count: count,
		})
	}

	if rows.Err() != nil {
		writeErr("Error iterating rows", rows.Err())
		return
	}

	w.WriteHeader(200)

	responseBody, err := json.Marshal(response)
	if err != nil {
		writeErr("Error marshalling response: ", err)
		return
	}

	w.Write(responseBody)

}
