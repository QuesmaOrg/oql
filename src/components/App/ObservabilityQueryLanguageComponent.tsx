import React, { useCallback, useEffect, useState, useRef } from "react";
import { Results } from "../result/Results";
import '../styles/main.css';
import "./globals.css"
import { Editor } from "../editor/Editor";
import { TableDefinition, TableDefinitionResponse, TabularResult } from "../../lib/types";
import { getBackendSrv } from '@grafana/runtime';
import { TimeSeriesChart } from "../charts/TimeSeriesChart";
import { AlertCircle, Loader2Icon } from 'lucide-react';
import { parseDate } from "../../lib/daterange";
import { DateRangeSelector } from "../filters/DateRangeSelector";
import logo from '../../img/quesma-logo-white-transparent-full.png';
import { AiModal } from "../ai/AiModal";
import { getBackendUrl } from "../../constants";
import { ArrowPathIcon } from '@heroicons/react/24/solid';

function extractTableFromQuery(query: string) {
  const regex = /from\s+(\w+)/i;
  const match = query.match(regex);
  return match ? match[1] : "";
}

const defaultQuery = `FROM apache_logs
|> WHERE timestamp BETWEEN $start AND $end
|> ORDER BY timestamp DESC
|> SELECT timestamp, severity, msg, client
|> WHERE client IS NOT NULL 
|> AGGREGATE count(*) as client_count, any(msg) as sample_msg group by client
|> ORDER BY client_count DESC
|> LIMIT 100`;


export default function ObservabilityQueryLanguageComponent() {
  // Add URL handling logic at the start of the component
  const getInitialQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('query');
    return urlQuery ? decodeURIComponent(urlQuery) : defaultQuery;
  };

  const [query, setQuery] = useState(getInitialQuery());
  const queryRef = useRef(query);

  // Add URL update effect
  useEffect(() => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('query', encodeURIComponent(query));
    window.history.replaceState({}, '', newUrl.toString());
  }, [query]);

  useEffect(() => {
    queryRef.current = query;
    const table = extractTableFromQuery(query);
    setCurrentTable(table);
  }, [query]);


  const [activeQuery, setActiveQuery] = useState(query);
  const [startDate, setStartDate] = useState("3d");
  const [endDate, setEndDate] = useState("now");
  const [whoChanged, setWhoChanged] = useState("");
  const [currentTable, setCurrentTable] = useState(extractTableFromQuery(query));
  const [tableDefinitions, setTableDefinitions] = useState<TableDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [queryTimestamp, setQueryTimestamp] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [transpiledSQL, setTranspiledSQL] = useState<string | null>(null);
  const [tabularResult, setTabularResult] = useState<TabularResult | null>(null);

  const [showAiModal, setShowAiModal] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });



  useEffect(() => {

    const fetchTableDefinitions = async () => {
      getBackendSrv().fetch({
        url: getBackendUrl('schema_discovery'),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({ databaseName: "default" }),
        showErrorAlert: false
      }).subscribe({
        next: (response) => {
          const tables = response.data as TableDefinitionResponse;
          setTableDefinitions(tables.tables);
          console.log("tableDefinitions loaded", tables.tables);
        },

        error: (error) => {
          setTableDefinitions([]);
          console.error(error);
        }
      });
    }

    fetchTableDefinitions();
  }, []); // Add empty dependency array to run once

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const startTs = `FROM_UNIXTIME(${parseDate(startDate)})`;
    const endTs = `FROM_UNIXTIME(${parseDate(endDate)})`;

    const q = activeQuery
      .replace(/\$start\b/g, startTs)
      .replace(/\$end\b/g, endTs);

    const loadInitialData = async () => {
      getBackendSrv().fetch({
        url: getBackendUrl('exec'),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({ query: q }),
        showErrorAlert: false
      }).subscribe({
        next: (data) => {

          const table = (data as any).data.table;
          const transpiledSQL = (data as any).data.transpiledSQL;

          if (table == null || table.Rows == null) {
            console.log("backend returned invalid data");
            setTabularResult(null);
            setIsLoading(false);
            return;
          }

          const tablular: TabularResult = new TabularResult(table.Names, table.Rows);
          setTabularResult(tablular);
          setTranspiledSQL(transpiledSQL);
          setIsLoading(false);
        },
        error: (error) => {
          console.error('Tabular result error:', error);
          setTabularResult(null);
          if (error.data.transpiledSQL) {
            setTranspiledSQL(error.data.transpiledSQL);
          } else {
            setTranspiledSQL(null);
          }
          setIsLoading(false);
          setError(error.data.error);
        }
      });
    };

    loadInitialData();
  }, [activeQuery, startDate, endDate, queryTimestamp]);


  const setTimeRange = useCallback((start: string, end: string, whoChanged: string) => {
    setStartDate(start);
    setEndDate(end);
    setWhoChanged(whoChanged);
  }, []);

  const runQuery = useCallback(() => {
    setActiveQuery(queryRef.current);
    setQueryTimestamp(Date.now());
  }, [setActiveQuery, setQueryTimestamp]);

  const handleGlyphClick = useCallback((lineNumber: number, isPlay: boolean) => {
    const lines = queryRef.current.split('\n');

    const commentPattern = '-- ';
    const continuedCommentPattern = '--\\ ';

    let pattern = '|>';
    let replacement = '--|>';
    let shouldComment = true;
   
    if (!isPlay) {
      pattern = '--|>';
      replacement = '|>';
      shouldComment = false;
    } 
    
    let currentLine = lineNumber - 1;
  
    if (lines[currentLine].trim().startsWith(pattern)) {
      lines[currentLine] = lines[currentLine].replace(pattern, replacement);
    } else {
      console.log("No pipe found at line", lineNumber);
      return;
    }
  
    for (let n = lineNumber; n < lines.length; n++) {
      const line = lines[n];

      if (line.trim() == "") {
        continue;
      }

      // stop when we hit the end of the pipe section
      if (line.trim().startsWith("--|>") || line.trim().startsWith("|>")) {
        break;
      }
      
      if (shouldComment) {
        if (line.trim().startsWith(continuedCommentPattern) || line.trim().startsWith(commentPattern)) {
          continue;
        }
        lines[n] = continuedCommentPattern + line;
      } else {
        if (!line.trim().startsWith(continuedCommentPattern) && !line.trim().startsWith(commentPattern)) {
          continue;
        }
        lines[n] = line.replace(continuedCommentPattern, "");
      }
    }

    const newQuery = lines.join('\n');

    setQuery(newQuery);
    setActiveQuery(newQuery);
    
  }, []);


  const onFilterChange = useCallback((columnName: string, value: string, operator: string) => {
    console.log(`Filter changed: ${columnName} ${operator} ${value}`);

    const isNumber = !isNaN(Number(value));

    let op = "=";
    if (value === "[null]" && operator === "+") {
      op = "IS NULL";
    } else if (value === "[null]" && operator === "-") {
      op = "IS NOT NULL";
    } else if (isNumber && operator === "+") {
      op = `= ${value}`;
    } else if (isNumber && operator === "-") {
      op = `<> ${value}`;
    } else if (operator === "+") {
      op = `LIKE '%${value}%'`;
    } else if (operator === "-") {
      op = `NOT LIKE '%${value}%'`;
    } else {
      console.log("Invalid filter condition ", columnName, operator, value);
      return;
    }

    const lines = query.split('\n');

    const index = lines.findIndex(line => line.startsWith(`|> WHERE ${columnName} `) && line.includes(`-- filter from `));

    const whereClause = `|> WHERE ${columnName} ${op} -- filter from ${operator} click on ${value}`;

    if (index !== -1) {
      lines[index] = whereClause;
    } else {

      let insertAtTheEnd = true;

      const tableDefinition = tableDefinitions.find(t => t.table === currentTable);
      console.log("tableDefinition", tableDefinition);
      console.log("currentTable", currentTable);

      if (!tableDefinition) {
        console.log(`Table ${currentTable} not found`);
        insertAtTheEnd = true;
        console.log("insert at the end. No table definition found");
      } else {
        const tableColumns = tableDefinition.columns;
        if (tableColumns.includes(columnName)) {
          insertAtTheEnd = false;
          console.log("insert at the end. Column exists in table definition");
        }
      }

      if (insertAtTheEnd) {
        lines.push(whereClause);
      } else {
        console.log("insert just after FROM. Column exists in table definition");
        if (lines.length >= 2) {
          lines.splice(1, 0, whereClause);
        } else {
          lines.push(whereClause);
        }
      }

    }

    const q = lines.join('\n');
    setQuery(q);
    setActiveQuery(q);
  }, [query, tableDefinitions, currentTable]);

  const onOrderChange = useCallback((columnName: string, order: string) => {

    const newOrderBy = `|> ORDER BY ${columnName} ${order}`;
    const lines = query.split('\n');
    const index = lines.map((line: string) => line.toLowerCase().startsWith('|> order by')).lastIndexOf(true);
    if (index !== -1) {
      lines[index] = newOrderBy;
    } else {
      lines.push(newOrderBy);
    }
    const q = lines.join('\n');
    setQuery(q);
    setActiveQuery(q);
  }, [query]);

  const handleAiModalAccept = useCallback((query: string) => {
    console.log("handleAiModalAccept", query);
    setQuery(query);
    setShowAiModal(false);
  }, [setQuery]);

  const handleAiModalOpen = useCallback((position: { x: number, y: number }) => {
    setModalPosition(position);
    setShowAiModal(true);
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
  }, [setQuery]);

  return (
    <div style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '10px', colorScheme: 'dark' }}>
      <h3><img src={logo} alt="Quesma Logo" style={{  height: '35px' }} /> -  Observability Query Language</h3>
      <div style={{
        position: 'absolute',
        top: '6px',
        right: '20px',
        zIndex: 1
      }}>
        <DateRangeSelector
          startDate={startDate}
          endDate={endDate}
          onDateRangeSelect={setTimeRange}
        />
      </div>
      <main style={{ display: 'flex' }}>
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>


              <div style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                zIndex: 1
              }}>
                <button
                  onClick={runQuery}
                  disabled={isLoading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgb(59, 130, 246)',
                    color: 'white',
                    borderRadius: '0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    opacity: isLoading ? 0.5 : 1,
                    pointerEvents: isLoading ? 'none' : 'auto',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {isLoading ? (
                    <Loader2Icon className="animate-spin" style={{ width: '16px', height: '16px' }} />
                  ) : (
                    <ArrowPathIcon style={{ width: '16px', height: '16px' }} />
                  )}
                  Run query
                </button>
              </div>

              {showAiModal && (
                <AiModal
                  position={modalPosition}
                  onClose={() => {
                    setShowAiModal(false);
                  }}
                  onAccept={handleAiModalAccept}
                  tabularResult={tabularResult}
                  query={query}
                />
              )}


              <Editor
                query={query}
                onChange={handleQueryChange}
                startDate={startDate}
                endDate={endDate}
                tableDefinitions={tableDefinitions}
                tableName={currentTable}
                onGlyphClick={handleGlyphClick}
                onAiModalOpen={handleAiModalOpen}
                onEnter={runQuery}
              />
            </div>

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px',
                color: '#ef4444',
                backgroundColor: 'black',
                border: '1px solid #fecaca',
                borderRadius: '6px'
              }}>
                <AlertCircle style={{ height: '20px', width: '20px' }} />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{error}</span>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--card)', }}>
            <TimeSeriesChart
              startDate={startDate}
              endDate={endDate}
              whoChanged={whoChanged}
              onDateRangeSelect={setTimeRange}
              currentTable={currentTable}
            />
          </div>

          <div style={{ background: 'var(--card)', flex: 1, overflow: 'hidden' }}>
            <Results
              tabularResult={tabularResult}
              transpiledSQL={transpiledSQL}
              onFilterChange={onFilterChange}
              onOrderChange={onOrderChange}
            />
          </div>

        </div>
      </main>
    </div>
  );
}
