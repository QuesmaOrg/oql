package backend

import (
	"crypto/tls"
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/ClickHouse/clickhouse-go/v2"
)

func cellValue(a interface{}) string {

	null := "[null]"

	if a == nil {
		return null
	}

	switch a := a.(type) {
	case *int:
		if a != nil {
			return fmt.Sprintf("%d", *a)
		} else {
			return null
		}

	case *string:
		if a != nil {
			return *a
		} else {
			return null
		}
	case *int64:
		if a != nil {
			return fmt.Sprintf("%d", *a)
		} else {
			return null
		}

	case *interface{}:
		if a != nil {
			return fmt.Sprintf("%v", *a)
		} else {
			return null
		}
	default:
		return fmt.Sprintf("%v", a)
	}

}

func executeQuery(query string) (Table, error) {
	res := Table{}

	rows, err := DefaultDB.Query(query)
	if err != nil {
		return res, err
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return res, err
	}

	res.Names = cols
	res.Rows = []Row{}

	log.Println("cols:", res.Names)
	for rows.Next() {
		vals := make([]interface{}, len(res.Names))
		for i := range cols {
			vals[i] = new(interface{})
		}

		err = rows.Scan(vals...)
		if err != nil {
			return res, err
		}

		row := make(Row, len(res.Names))
		for i := range res.Names {
			row[i] = cellValue(*(vals[i].(*interface{})))
		}

		res.Rows = append(res.Rows, row)
	}

	if err := rows.Err(); err != nil {
		return res, err
	}

	return res, nil
}

var DefaultDB *sql.DB

func connectClickhouse() *sql.DB {
	log.Println("Connecting to Clickhouse")

	host := os.Getenv("CLICKHOUSE_HOST")
	if host == "" {
		log.Println("Warning: CLICKHOUSE_HOST is not set. Defaulting to host.docker.internal:9000")
		host = "host.docker.internal:9000"
	}

	options := clickhouse.Options{
		Addr: []string{host},
	}

	// Retrieve authentication details from environment variables.
	user := os.Getenv("CLICKHOUSE_USER")
	password := os.Getenv("CLICKHOUSE_PASSWORD")
	database := os.Getenv("CLICKHOUSE_DATABASE")

	if user == "" && password == "" && database == "" {
		log.Println("Warning: No ClickHouse authentication details provided; proceeding without authentication.")
	} else {
		if user == "" {
			log.Println("Warning: CLICKHOUSE_USER is not set.")
		}
		if password == "" {
			log.Println("Warning: CLICKHOUSE_PASSWORD is not set.")
		}
		if database == "" {
			log.Println("Warning: CLICKHOUSE_DATABASE is not set.")
		}
		options.Auth = clickhouse.Auth{
			Username: user,
			Password: password,
			Database: database,
		}
	}

	useTLS := os.Getenv("CLICKHOUSE_USE_TLS")
	if useTLS == "" {
		log.Println("Warning: CLICKHOUSE_USE_TLS is not set; defaulting to TLS disabled.")
	}
	if useTLS == "true" {
		options.TLS = &tls.Config{InsecureSkipVerify: true}
	}

	// FIXME: the transpiler should automatically generate queries with aliased subqueries
	options.Settings = clickhouse.Settings{
		"joined_subquery_requires_alias": "0",
	}

	db := clickhouse.OpenDB(&options)
	DefaultDB = db

	if err := DefaultDB.Ping(); err != nil {
		log.Println(err)
	}

	return db
}

func Setup() {
	log.Println("Starting ")

	DefaultDB = connectClickhouse()

	log.Println("Connection: ", DefaultDB)
}
