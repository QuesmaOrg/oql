import React, { useEffect, useState } from 'react';
import { ResultTable } from "./ResultTable";
import type { TabularResult } from "../../lib/types";
import { Switch, Modal } from '@grafana/ui';
import { PieChart } from './PieChart';
import { LineChart } from './LineChart';
interface ResultsProps {
  tabularResult: TabularResult | null;
  transpiledSQL: string | null;
  onFilterChange: (columnName: string, value: string, operator: string) => void;
}

export function Results({ tabularResult, transpiledSQL, onFilterChange}: ResultsProps) {
  const [showChart, setShowChart] = useState(false);
  const [canShowChart, setCanShowChart] = useState(false);
  const [showSQL, setShowSQL] = useState(false);
  const [chartType, setChartType] = useState<'pie' | 'line'>('pie');

  useEffect(() => {

    // some heuristics to determine the chart type depending on the columns and rows

    if (tabularResult?.columns.length === 2 && tabularResult?.rows.length > 0) {
      setCanShowChart(true);
      setChartType('pie');
      return;

    } else if (tabularResult?.columns.length === 3 && tabularResult?.rows.length > 0) {

      // Check if the third column contains numeric values
      const hasNumericValues = tabularResult.rows.every(row => {
        const thirdColumnValue = row[2];
        return !isNaN(parseFloat(thirdColumnValue)) && isFinite(parseFloat(thirdColumnValue));
      });

      if (!hasNumericValues) {
        setCanShowChart(false);
        return;
      }

      setCanShowChart(true);
      setChartType('line');
      return;
    } 

    setCanShowChart(false);
    
  }, [tabularResult]);

  return (
    <div>
      <div style={{
        height: '40px',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '16px',
        padding: '0 8px',
        borderBottom: '1px solid rgba(204, 204, 220, 0.2)',
        backgroundColor: 'rgba(204, 204, 220, 0.05)'
      }}>
        {transpiledSQL && (
          <button
            onClick={() => setShowSQL(true)}
            style={{
              backgroundColor: 'transparent',
              color: 'rgb(204, 204, 220)',
              border: '1px solid rgb(204, 204, 220)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 8px'
            }}
          >
            Show Transpiled SQL
          </button>
        )}

        {canShowChart && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: 'rgb(204, 204, 220)', fontSize: '12px' }}>Table</span>
            <Switch
              value={showChart}
              onChange={() => setShowChart(!showChart)}
            />
            <span style={{ color: 'rgb(204, 204, 220)', fontSize: '12px' }}>Chart</span>
          </div>
        )}
      </div>

      {showSQL && (
        <Modal
          title="Transpiled SQL"
          isOpen={showSQL}
          onDismiss={() => setShowSQL(false)}
        >
          <div style={{
            backgroundColor: '#1e1e1e',
            padding: '16px',
            borderRadius: '4px',
            border: '1px solid rgba(204, 204, 220, 0.2)',
            maxHeight: '600px',
            overflowY: 'auto'
          }}>
            <pre style={{
              margin: 0,
              fontFamily: 'monospace',
              fontSize: '14px',
              color: 'rgb(204, 204, 220)',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}>
              {transpiledSQL}
            </pre>
          </div>
        </Modal>
      )}

      {showChart && canShowChart ? (
        chartType === 'pie' ? (
          <PieChart tabularResult={tabularResult} />
        ) : (
          <LineChart tabularResult={tabularResult} />
        )
      ) : (
        <ResultTable
          tabularResult={tabularResult}
          onFilterChange={onFilterChange}
        />
      )}
    </div>
  );
} 
