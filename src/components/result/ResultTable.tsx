import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "../ui/table";
import { TabularResult } from "../../lib/types";
import React, { useEffect, useState } from 'react';
import { RowDetailPanel } from "./RowDetailPanel";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

const MAX_NORMAL_COLUMNS = 4;
const MAX_COMPACT_COLUMNS_LENGTH = 10;
const MAX_VALUE_LENGTH = 50;

const tableCellStyle = {
  padding: '5px',
  borderBottom: '1px solid rgba(204, 204, 220, 0.2)',
  borderRight: '1px solid rgba(204, 204, 220, 0.2)',
  borderLeft: '1px solid rgba(204, 204, 220, 0.2)',
  borderRadius: 0,
  verticalAlign: 'top' as const,
  textAlign: 'left' as const
};

const headerCellStyle = {
  ...tableCellStyle,
  fontWeight: 500,
  backgroundColor: 'rgba(204, 204, 220, 0.05)',
  textAlign: 'center' as const
};

const tableRowStyle = {
  cursor: 'pointer',
};

const tableRowHoverStyle = {
  ...tableRowStyle,
  backgroundColor: 'rgba(204, 204, 220, 0.1)'
};

interface ValueRendererProps {
  value: string;
  columnName: string;
  onFilterChange: (columnName: string, value: string, operator: string) => void;
}

function ValueRenderer({ value, columnName, onFilterChange }: ValueRendererProps) {
  const [showFull, setShowFull] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const filterButtonStyle = {
    padding: '0',
    marginBottom: '1px',
    backgroundColor: 'transparent',
    color: 'rgb(204, 204, 220)',
    border: '1px solid rgba(204, 204, 220, 0.4)',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '8px',
    opacity: isHovered ? 1 : 0,
    transition: 'opacity 0.2s ease',
    minWidth: '12px',
    height: '12px',
    lineHeight: '10px',
    display: 'block'
  };

  const buttonContainerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    marginRight: '2px',
    justifyContent: 'center'
  };

  const handleFilterClick = (e: React.MouseEvent, operator: string) => {
    e.stopPropagation();
    onFilterChange(columnName, value, operator);
  };

  if (value.length > 100) {
    return (
      <span
        title={value}
        style={{ fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={buttonContainerStyle}>
          <button
            style={filterButtonStyle}
            onClick={(e) => handleFilterClick(e, '+')}
          >
            +
          </button>
          <button
            style={filterButtonStyle}
            onClick={(e) => handleFilterClick(e, '-')}
          >
            -
          </button>
        </div>
        {!showFull ? (
          <span onClick={(e) => { e.stopPropagation(); setShowFull(true); }}>
            {value.slice(0, MAX_VALUE_LENGTH)}...
          </span>
        ) : value}
      </span>
    );
  }

  return (
    <span
      style={{ fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={buttonContainerStyle}>
        <button
          style={filterButtonStyle}
          onClick={(e) => handleFilterClick(e, '+')}
        >
          +
        </button>
        <button
          style={filterButtonStyle}
          onClick={(e) => handleFilterClick(e, '-')}
        >
          -
        </button>
      </div>
      {value}
    </span>
  );
}

function CompactValueRenderer({ value, columnName }: ValueRendererProps) {
  const [showFull, setShowFull] = useState(false);

  if (value.length > 100) {
    return (
      <span
        title={value}
        style={{ fontFamily: 'monospace' }}
      >
        {!showFull ? (
          <span onClick={(e) => { e.stopPropagation(); setShowFull(true); }}>
            {value.slice(0, MAX_VALUE_LENGTH)}...
          </span>
        ) : value}
      </span>
    );
  }

  return (
    <span
      style={{ fontFamily: 'monospace' }}
    >
      {value}
    </span>
  );
}

function renderKeyValue(key: string, value: string, onFilterChange: (columnName: string, value: string, operator: string) => void) {
  return (
    <div>
      <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{key}</span>:&nbsp;
      <CompactValueRenderer value={value} columnName={key} onFilterChange={onFilterChange} />
    </div>
  )
}


function CompactCell({ columns, cells, startIndex, onFilterChange }: { columns: string[], cells: any[], startIndex: number, onFilterChange: (columnName: string, value: string, operator: string) => void }) {


  const [showFull, setShowFull] = useState(false);
  const length = columns.length - startIndex;


  let endIndex = cells.length - 1

  let showMore = false;

  if (length > MAX_COMPACT_COLUMNS_LENGTH) {
    showMore = true;
    if (!showFull) {
      endIndex = startIndex + MAX_COMPACT_COLUMNS_LENGTH;
    }
  }

  const compactedData = columns.slice(startIndex, endIndex).map((col, idx) => {
    return renderKeyValue(col, cells[startIndex + idx], onFilterChange);
  });

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    }}>
      {showMore && (
        <span onClick={(e) => { e.stopPropagation(); setShowFull(!showFull); }}>
          {!showFull ? (
            <>
              <ChevronRightIcon style={{ width: '16px', height: '16px', color: 'rgb(204, 204, 220)' }} />
            </>
          ) : (
            <>
              <ChevronDownIcon style={{ width: '16px', height: '16px', color: 'rgb(204, 204, 220)' }} />
            </>
          )}
        </span>
      )}
      {compactedData.map((item, i) => (
        <span key={i}>
          {item}
        </span>
      ))}

    </div>
  );
}

interface ResultTableProps {
  tabularResult: TabularResult | null;
  onFilterChange: (columnName: string, value: string, operator: string) => void;
}

export function ResultTable({ tabularResult, onFilterChange }: ResultTableProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  useEffect(() => {
    setIsDetailOpen(false);
    setSelectedRow(null);
  }, [tabularResult]);

  const handleRowClick = (row: number) => {
    setSelectedRow(row);
    setIsDetailOpen(true);
  };

  if (!tabularResult) {
    return null;
  }

  const needsCompacting = tabularResult.columns.length > MAX_NORMAL_COLUMNS;
  const displayColumns = needsCompacting
    ? [...tabularResult?.columns.slice(0, MAX_NORMAL_COLUMNS), 'More Details']
    : tabularResult?.columns;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Table style={{
        width: '100%',
        borderCollapse: 'collapse',
        border: '1px solid rgba(204, 204, 220, 0.2)',
        borderRadius: 0
      }}>
        <TableBody>
          {/* Header row */}
          <TableRow>
            {displayColumns.map((column) => (
              <TableCell
                key={column}
                style={{
                  ...headerCellStyle,
                  width: column === 'More Details' ? '100%' : 'max-content', 
                  whiteSpace: column === 'More Details' ? 'normal' : 'nowrap',
                  minWidth: column === 'More Details' ? '200px' : 'auto'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>{column}</div>
                </div>
              </TableCell>
            ))}
          </TableRow>

          {/* Data rows with hover handling */}
          {tabularResult.rows.map((row, index) => (
            <TableRow
              key={index}
              onClick={() => handleRowClick(index)}
              onMouseEnter={() => setHoveredRow(index)}
              onMouseLeave={() => setHoveredRow(null)}
              style={hoveredRow === index ? tableRowHoverStyle : tableRowStyle}
            >
              {needsCompacting ? (
                <>
                  {row.slice(0, MAX_NORMAL_COLUMNS).map((cell, idx) => (
                    <TableCell 
                      key={tabularResult.columns[idx]} 
                      style={{
                        ...tableCellStyle,
                        width: tabularResult.columns[idx] === 'More Details' ? '100%' : 'max-content',
                        whiteSpace: tabularResult.columns[idx] === 'More Details' ? 'normal' : 'nowrap',
                        minWidth: tabularResult.columns[idx] === 'More Details' ? '200px' : 'auto'
                      }}
                    >
                      <ValueRenderer value={cell} columnName={tabularResult.columns[idx]} onFilterChange={onFilterChange} />
                    </TableCell>
                  ))}
                  <TableCell style={{ ...tableCellStyle, width: '40%' }}>
                    <CompactCell
                      columns={tabularResult.columns}
                      cells={row}
                      startIndex={MAX_NORMAL_COLUMNS}
                      onFilterChange={onFilterChange}
                    />
                  </TableCell>
                </>
              ) : (
                row.map((cell, idx) => (
                  <TableCell 
                    key={tabularResult.columns[idx]} 
                    style={{
                      ...tableCellStyle,
                      width: tabularResult.columns[idx] === 'More Details' ? '100%' : 'max-content',
                      whiteSpace: tabularResult.columns[idx] === 'More Details' ? 'normal' : 'nowrap',
                      minWidth: tabularResult.columns[idx] === 'More Details' ? '200px' : 'auto'
                    }}
                  >
                    <ValueRenderer value={cell} columnName={tabularResult.columns[idx]} onFilterChange={onFilterChange} />
                  </TableCell>
                ))
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <RowDetailPanel
        tabularResult={tabularResult}
        selectedRow={selectedRow}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedRow(null);
        }}
      />
    </div>
  );
} 
