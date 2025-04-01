'use client';

import { Select } from "@grafana/ui";
import { parseDate } from "lib/daterange";
import React, { useCallback, useEffect } from "react";

const timeRangeLabels: Record<string, string> = {
  '1h': 'Last 1 hour',
  '24h': 'Last 24 hours',
  '3d': 'Last 3 days',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '6m': 'Last 6 months',
};

export function DateRangeSelector(props: {
  startDate: string;
  endDate: string;
  onDateRangeSelect: (start: string, end: string, whoChanged: string) => void;
}) {

  const whoAmI = "date-range-selector";

  const handleTimeRangeChange = useCallback((value: string) => {
    if (value === "custom") {

      const startTs = parseDate(props.startDate);
      const endTs = parseDate(props.endDate);

      props.onDateRangeSelect(formatDateForInput(startTs), formatDateForInput(endTs), whoAmI);

      return;
    }

    if (value in timeRangeLabels) {
      props.onDateRangeSelect(value, "now", whoAmI);
    }
  }, [props]);

  const handleCustomDateChange = (start: string, end: string) => {
    props.onDateRangeSelect(start, end, whoAmI);
  };

  useEffect(() => {
    handleTimeRangeChange(props.startDate);
  }, [props.startDate, props.endDate, props.onDateRangeSelect, handleTimeRangeChange]);

  let defaultValue = "custom";
  let isCustomRange = false;
  if (props.endDate === "now" && props.startDate in timeRangeLabels) {
    defaultValue = props.startDate;
  } else {
    defaultValue = "custom";
    isCustomRange = true;
  }

  const timeRange = isCustomRange ? "custom" : defaultValue;

  const options = [
    {label: "Last 1 hour", value: "1h"},
    {label: "Last 24 hours", value: "24h"},
    {label: "Last 3 days", value: "3d"},
    {label: "Last 7 days", value: "7d"},
    {label: "Last 30 days", value: "30d"},
    {label: "Last 6 months", value: "6m"},
    {label: "Custom", value: "custom"}
  ];

  const startTs = parseDate(props.startDate);
  const endTs = parseDate(props.endDate);

  // Format timestamps for datetime-local input
  const formatDateForInput = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDThh:mm
  };

  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Select 
        style={{width: "180px", height: '28px'}} 
        inputId="dateselector"
        value={timeRange}
        options={options}
        onChange={(val: any) => handleTimeRangeChange(val.value)}
      />

      {isCustomRange && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="datetime-local"
            value={formatDateForInput(startTs)}
            onChange={(e) => handleCustomDateChange(e.target.value, props.endDate)}
            style={{
              backgroundColor: 'rgb(32, 34, 38)',
              border: '1px solid rgba(204, 204, 220, 0.2)',
              borderRadius: '4px',
              color: 'white',
              padding: '8px',
              height: '32px',
              fontSize: '14px'
            }}
          />
          <span style={{ color: 'rgb(204, 204, 220)' }}>to</span>
          <input
            type="datetime-local"
            value={formatDateForInput(endTs)}
            onChange={(e) => handleCustomDateChange(props.startDate, e.target.value)}
            style={{
              backgroundColor: 'rgb(32, 34, 38)',
              border: '1px solid rgba(204, 204, 220, 0.2)',
              borderRadius: '4px',
              color: 'white',
              padding: '8px',
              height: '32px',
              fontSize: '14px'
            }}
          />
        </div>
      )}
    </div>
  );
}
