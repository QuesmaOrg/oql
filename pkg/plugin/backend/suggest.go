package backend

import (
	"bytes"
	_ "embed"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"regexp"

	"os"
	"strings"
)

var pipeSQLSyntax string

func fetchPipeSQL() error {
	if pipeSQLSyntax != "" {
		return nil
	}

	resp, err := http.Get("https://cloud.google.com/bigquery/docs/reference/standard-sql/pipe-syntax")
	if err != nil {
		return fmt.Errorf("failed to fetch pipe SQL docs: %w", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Extract plain text from HTML
	// This is a simple implementation - you may want to use a proper HTML parser
	text := string(body)
	text = strings.ReplaceAll(text, "<", " <")
	text = strings.ReplaceAll(text, ">", "> ")
	text = strings.ReplaceAll(text, "&nbsp;", " ")
	text = strings.ReplaceAll(text, "&lt;", "<")
	text = strings.ReplaceAll(text, "&gt;", ">")
	text = strings.ReplaceAll(text, "&amp;", "&")

	// Remove HTML tags
	text = regexp.MustCompile(`<[^>]*>`).ReplaceAllString(text, "")

	// Clean up whitespace
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)

	log.Println("Pipe SQL syntax:", text)

	pipeSQLSyntax = text
	return nil
}

func readTableSchema() (string, error) {

	query := "select create_table_query from system.tables where database = 'default'"

	rows, err := DefaultDB.Query(query)
	if err != nil {
		return "", err
	}

	queries := []string{}

	for rows.Next() {
		var createTableQuery string
		err = rows.Scan(&createTableQuery)
		if err != nil {
			return "", err
		}
		queries = append(queries, createTableQuery)
	}

	if err := rows.Err(); err != nil {
		return "", err
	}

	tableSchema := strings.Join(queries, "\n")
	tableSchema = strings.ReplaceAll(tableSchema, "default.", "")

	log.Println("Table schema:", tableSchema)

	return tableSchema, nil
}

type ChatGPTRequest struct {
	Model    string           `json:"model"`
	Messages []ChatGPTMessage `json:"messages"`
}

type ChatGPTMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatGPTResponse struct {
	Choices []struct {
		Message ChatGPTMessage `json:"message"`
	} `json:"choices"`
}

func WriteTableToString(table Table) (string, error) {
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)

	// Write header (Names)
	if err := writer.Write(table.Names); err != nil {
		return "", err
	}

	// Write rows
	for _, row := range table.Rows {
		if err := writer.Write(row); err != nil {
			return "", err
		}
	}

	writer.Flush()

	if err := writer.Error(); err != nil {
		return "", err
	}

	return buffer.String(), nil
}

func ReadTableFromString(data string) (Table, error) {
	reader := csv.NewReader(strings.NewReader(data))

	// Read all lines
	records, err := reader.ReadAll()
	if err != nil {
		return Table{}, err
	}

	if len(records) == 0 {
		return Table{}, nil // Empty table
	}

	// First line is the header (Names)
	table := Table{
		Names: records[0],
	}

	table.Rows = make([]Row, len(records)-1)
	for i, record := range records[1:] {
		table.Rows[i] = record
	}

	return table, nil
}

func suggest(userPrompt string, query string, table Table) ([]string, error) {

	err := fetchPipeSQL()
	if err != nil {
		return nil, fmt.Errorf("error fetching pipe SQL syntax: %w", err)
	}

	log.Println("Suggesting for query: ", userPrompt, query)

	tableSchema, err := readTableSchema()
	if err != nil {
		return nil, fmt.Errorf("error reading table schema: %w", err)
	}

	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("error: OPENAI_API_KEY environment variable not set")
	}

	modelName := "gpt-4o-mini-2024-07-18"
	apiEndpoint := "https://api.openai.com/v1/chat/completions"

	// Detect OpenRouter keys
	if strings.HasPrefix(apiKey, "sk-or-") {
		modelName = "openai/gpt-4o-mini-2024-07-18"
		apiEndpoint = "https://openrouter.ai/api/v1/chat/completions"
	}

	csvInput, err := WriteTableToString(table)
	if err != nil {
		return nil, fmt.Errorf("error writing table to string: %w", err)
	}

	systemPrompt := fmt.Sprintf(`
You are a SQL expert. You are given a query and a table. We know some things about the user and the current situation.


Limit to the current table schema. 

Rules:
* First of all use the user prompt to suggest queries that are relevant to the user's context.
* Please suggest 5 interesting SQL queries that a user might want to run.
* Context may contains user's IP address, current time, etc. This can be helpful to suggest queries that are relevant to the user's context
* Use the user prompt to suggest queries that are relevant to the user's context.
* Return only the SQL queries.
* Return in Pipe SQL format.
* Use Clickhouse compatible operators and functions.
* Seperate each query with ---
* Add a comment at the end of the query to explain what it does. Simple and concise.
* Do not include any markdown formatting.
* Limit to the current table columns. 
* Don't use INTERVAL operator. It's not supported in Clickhouse.
* Query must start with FROM and end with LIMIT 1000.
* Extract the table name from the query provided by the user.
* Use results of the current query to suggest new queries.



Here is current SQL query:
---
%s
---

Here is result of the current SQL query:
---
%s
---

Here is table definitions of all tables in the database:
---
%s
---

Here is the syntax of Pipe SQL:	
---
%s
---

`, query, csvInput, tableSchema, pipeSQLSyntax)

	requestBody := ChatGPTRequest{
		Model: modelName,
		Messages: []ChatGPTMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	}

	requestBodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("error marshalling request: %w", err)
	}

	req, err := http.NewRequest("POST", apiEndpoint, bytes.NewBuffer(requestBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("error creating HTTP request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("error response from API: %s", resp.Status)
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response: %w", err)
	}

	var chatResponse ChatGPTResponse
	if err := json.Unmarshal(body, &chatResponse); err != nil {
		return nil, fmt.Errorf("error unmarshalling response: %w", err)
	}

	if len(chatResponse.Choices) > 0 {

		log.Println("Chat response:", chatResponse.Choices[0].Message.Content)

		suggestions := strings.Split(strings.TrimSpace(chatResponse.Choices[0].Message.Content), "---\n")
		// Filter out empty suggestions
		filtered := make([]string, 0)
		for _, s := range suggestions {
			if strings.TrimSpace(s) != "" && !strings.HasPrefix(s, "```") {
				filtered = append(filtered, s)
			}
		}
		return filtered, nil
	}

	return []string{}, nil
}

type SuggestRequest struct {
	Prompt  string `json:"prompt"`
	Query   string `json:"query"`
	Results Table  `json:"results"`
}

type SuggestResponse struct {
	Error       string   `json:"error,omitempty"`
	Suggestions []string `json:"suggestions"`
}

func HandleSuggest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read the request body
	var req SuggestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response := SuggestResponse{Error: "Invalid request body: " + err.Error()}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Call the suggest function
	suggestions, err := suggest(req.Prompt, req.Query, req.Results)
	if err != nil {
		response := SuggestResponse{Error: err.Error()}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Return the suggestions
	response := SuggestResponse{
		Suggestions: suggestions,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
