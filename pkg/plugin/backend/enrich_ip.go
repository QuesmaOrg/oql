package backend

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

type EnrichIPRequest struct {
	IP string `json:"ip"`
}

type EnrichIPResponse struct {
	AllocatedAt  *string `json:"allocated_at"`
	ASN          *string `json:"asn"`
	ASNCountry   *string `json:"asn_country"`
	City         *string `json:"city"`
	CountryLong  *string `json:"country_long"`
	CountryShort *string `json:"country_short"`
	Hostname     *string `json:"hostname"`
	IP           string  `json:"ip"`
	ISP          *string `json:"isp"`
	Latitude     *string `json:"latitude"`
	Longitude    *string `json:"longitude"`
	Region       *string `json:"region"`
	Registry     *string `json:"registry"`
	Timezone     *string `json:"timezone"`
	Zipcode      *string `json:"zipcode"`
}

func HandleEnrichIP(w http.ResponseWriter, r *http.Request) {

	log.Println("Enrich IP request received", r.Method)
	cors(&w)

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	writeError := func(err error) {
		log.Println("Error", err)
		w.WriteHeader(http.StatusInternalServerError)
		resp := map[string]string{
			"error": err.Error(),
		}
		jsonBody, err := json.Marshal(resp)
		if err != nil {
			log.Println("Error marshalling response", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Write(jsonBody)
	}

	jsonBody, err := io.ReadAll(r.Body)

	if err != nil {
		writeError(err)
		return
	}
	defer r.Body.Close()

	var request EnrichIPRequest

	err = json.Unmarshal(jsonBody, &request)

	if err != nil {
		writeError(err)
		return
	}

	query := fmt.Sprintf(`SELECT 
		allocated_at,
		asn,
		asn_country,
		city,
		country_long,
		country_short, 
		hostname,
		ip,
		isp,
		latitude,
		longitude,
		region,
		registry,
		timezone,
		zipcode
	FROM ip_data WHERE ip = '%s'`, request.IP)

	rows, err := DefaultDB.Query(query)

	if err != nil {
		writeError(fmt.Errorf("error enriching IP: %w", err))
	}

	defer rows.Close()
	var response EnrichIPResponse
	if rows.Next() {

		err = rows.Scan(
			&response.AllocatedAt,
			&response.ASN,
			&response.ASNCountry,
			&response.City,
			&response.CountryLong,
			&response.CountryShort,
			&response.Hostname,
			&response.IP,
			&response.ISP,
			&response.Latitude,
			&response.Longitude,
			&response.Region,
			&response.Registry,
			&response.Timezone,
			&response.Zipcode,
		)

		if err != nil {
			writeError(fmt.Errorf("error enriching IP: %w", err))
			return
		}

	}

	if err != nil {
		writeError(fmt.Errorf("error enriching IP: %w", err))
		return
	}
	log.Println("Enrich IP request received", request.IP)

	responseBody, err := json.Marshal(response)

	if err != nil {
		writeError(err)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(responseBody)

}
