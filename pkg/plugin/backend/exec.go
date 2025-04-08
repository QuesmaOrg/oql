package backend

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"

	lexer_core "github.com/QuesmaOrg/quesma/platform/parsers/sql/lexer/core"
	"github.com/QuesmaOrg/quesma/platform/parsers/sql/lexer/dialect_sqlparse"
	"github.com/QuesmaOrg/quesma/platform/parsers/sql/parser/core"
	"github.com/QuesmaOrg/quesma/platform/parsers/sql/parser/pipe_syntax"
	"github.com/QuesmaOrg/quesma/platform/parsers/sql/parser/transforms"
)

func HandleExec(w http.ResponseWriter, r *http.Request) {
	cors(&w)

	// Handle preflight request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var transpiledSQL string

	writeErr := func(msg string, err error) {
		log.Println("Error: ", msg, err)
		m := map[string]string{
			"error":         err.Error(),
			"message":       msg,
			"transpiledSQL": transpiledSQL,
		}
		b, _ := json.Marshal(m)
		w.WriteHeader(500)
		w.Write(b)
	}

	jsonBody, err := io.ReadAll(r.Body)

	if err != nil {
		writeErr("Error reading body", err)
		return
	}

	log.Println("Received body: ", string(jsonBody))

	var request Request

	err = json.Unmarshal(jsonBody, &request)

	if err != nil {
		writeErr("Error unmarshalling body: ", err)
		return
	}

	log.Println("Received query: ", request.Query)

	query := request.Query

	// Lexer has some issues with comments and whitespace, so we need to remove them

	lines := strings.Split(query, "\n")
	filteredLines := make([]string, 0)
	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)
		if trimmedLine != "" && !strings.HasPrefix(trimmedLine, "--") {

			// this is nasty, but it works
			idx := strings.Index(line, " -- ")

			if idx != -1 {
				line = line[:idx]
			}

			filteredLines = append(filteredLines, line)
		}
	}
	query = strings.Join(filteredLines, "\n")

	w.Header().Set("Content-Type", "application/json")

	tokens := lexer_core.Lex(query, dialect_sqlparse.SqlparseRules)
	node := core.TokensToNode(tokens)

	transforms.GroupParenthesis(node)
	pipe_syntax.GroupPipeSyntax(node)
	pipe_syntax.ExpandMacros(node)
	pipe_syntax.ExpandEnrichments(node, DefaultDB)
	pipe_syntax.TranspileToCTE(node)

	transpiledSQL = transforms.ConcatTokenNodes(node)

	log.Println("Transpiled SQL: ", transpiledSQL)

	// FIXME: this should run pretty-printed SQL
	// but pretty-printer has a bug with such query (generates invalid query):
	//
	// FROM apache_logs
	// |> WHERE timestamp BETWEEN $start AND $end
	// |> ORDER BY timestamp DESC
	// |> SELECT timestamp, severity, msg, client
	// |> WHERE client IS NOT NULL
	// |> AGGREGATE count(*) as client_count, any(msg) as sample_msg group by client
	//| > LIMIT 100

	res, err := executeQuery(transpiledSQL)

	if err != nil {
		writeErr("Error executing pipe query.", err)
		return
	}

	response := ExecResponse{
		Table:         res,
		TranspiledSQL: transpiledSQL,
	}

	responseBody, err := json.Marshal(response)

	if err != nil {
		writeErr("Error marshalling response: ", err)
		return
	}

	w.WriteHeader(200)

	w.Write(responseBody)

}
