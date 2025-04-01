'use client'

import ReactECharts, { EChartsOption } from 'echarts-for-react';
import { format } from 'date-fns';
import { parseDate } from '../../lib/daterange';
import React, { useState, useEffect, memo, useRef } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { getBackendUrl } from '../../constants';
const formatNumber = (num: number) => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
};

function  lessThan3Day(startTs: number, endTs: number) {

  const diff = endTs - startTs;

  return diff <= 86400 * 3;
}

const whoAmI = "timeseries-chart";

// Create the base component
function TimeSeriesChartBase(params: {
  startDate: string
  endDate: string
  whoChanged: string  
  currentTable: string
  onDateRangeSelect: (start: string, end: string, whoChanged: string) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>("");
  const [loading, setLoading] = useState<boolean>(false);
  
  // Use ref to track the current data range
  const dataRangeRef = useRef({
    startTs: 0,
    endTs: 0
  });

  useEffect(() => {

    if (params.currentTable == null) {
      return;
    }
    if (params.currentTable === "") {
      return;
    }

    const startTs = parseDate(params.startDate);
    const endTs = parseDate(params.endDate);

    dataRangeRef.current = { startTs, endTs };

    setLoading(true);

    getBackendSrv().fetch({
      url: getBackendUrl('timeseries'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({ query: "", startDate: startTs, endDate: endTs, tableName: params.currentTable }),
      showErrorAlert: false
    }).subscribe({
      next: (resp) => {
        setError(null);
        setLoading(false);
        const data = (resp as any).data;
        setData(data.data);
      },
      error: (error) => {
        console.error('TS Error:', error);
        setData([]); 
        setLoading(false);
        setError(error.data.error);
      }
    });


  }, [params.startDate, params.endDate, params.currentTable]);

  if (loading) {
    return null;
  }
  // If there is an error, don't render the chart. 
  if (error) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dates = data?.map((item: any) => item.date) ?? [];
  const option = {
    grid: {
      left: '0',
      right: '0',
      bottom: 48,
      top: '8',
      containLabel: true,
    },
    dataZoom: [
      {
        type: 'slider',
        handleSize: 0,
        backgroundColor: 'rgba(0,0,0,0)',
        fillerColor: 'rgba(0,0,0,0)',
        borderRadius: 0,
        borderColor: 'rgba(0,0,0,0)',
        brushSelect: true,
        bottom: 0,
        handleStyle: {
          color: 'rgba(0,0,0,0)',
          opacity: 0
        },
        moveHandleSize: 0,
        showDetail: false,
        height: 40,
        selectedDataBackground: {
          areaStyle: {
            color: '#888888',
            opacity: 1
          },
          lineStyle: {
            opacity: 1,
            color: '#357AF6',
          }
        },
    
      },
   
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgb(32, 34, 38)',
      borderWidth: 0,
      padding: 12,
      textStyle: {
        color: 'rgb(204, 204, 220)',
        fontSize: 12,
        fontWeight: 'normal',
        fontFamily: 'Inter',
        lineHeight: 16,
      },
      confine: true,
    },
    xAxis: [
      {
        type: 'category',
        boundaryGap: false,
        axisLabel: {
          interval: 'auto',
          hideOverlap: true,
          color: 'rgb(204, 204, 220)',
          formatter: (value: string) => {
            const date = new Date(value);
            return lessThan3Day(dataRangeRef.current.startTs, dataRangeRef.current.endTs)
              ? format(date, 'HH:mm')
              : format(date, 'dd MMM')
          }
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(204, 204, 220, 0.2)'
          }
        },
        splitLine: {
          show: false
        },
        data: dates
      }
    ],
    yAxis: [
      {
        type: 'value',
        axisLabel: {
          color: 'rgb(204, 204, 220)',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'Inter',
          lineHeight: 16,
          formatter: (value: number) => {
            return formatNumber(value);
          }
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(204, 204, 220, 0.1)'
          }
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(204, 204, 220, 0.2)'
          }
        }
      }
    ],
    series: [
      {
        name: 'count',
        type: 'bar',
        stack: 'count',
        barMinWidth: 1,
        barMaxWidth: 8,
        barGap: '20%',
        large: true,
        itemStyle: {
          color: '#008060'
        },
        emphasis: {
          focus: 'self',
          blurScope: "coordinateSystem",
          itemStyle: {
            color: '#008060',
          }
        },
        blur: {
          itemStyle: {
            color: 'rgba(0, 128, 96, 0.2)',
            opacity: 1
          }
        },
        data: data?.map((item: any) => item.count) ?? []
      }
    ]
  };

  return (
    <div style={{
      borderRadius: '1rem',
    }}>
      <ReactECharts
        option={option as EChartsOption}
        style={{ height: '160px'}}
        theme={
          {
            backgroundColor: '#191a1f'
          }
        }
        onEvents={{
          dataZoom: (zoomParams: any) => {
            const start = zoomParams.start / 100;
            const end = zoomParams.end / 100;
            const dates = data?.map(item => item.date) ?? [];
            if (dates.length > 0) {
              const startIndex = Math.floor(dates.length * start);
              const endIndex = Math.floor(dates.length * end);

              const startDate = String(dates[startIndex]).split('.')[0];
              const endDate = String(dates[Math.min(endIndex, dates.length - 1)]).split('.')[0];

              const startTs = parseDate(startDate);
              const endTs = parseDate(endDate);

              dataRangeRef.current = { startTs, endTs }; 
              
              params.onDateRangeSelect?.(
                startDate,
                endDate,
                whoAmI
              );
            }
          }
        }}
      />
    </div>
  );
}

// Create a custom comparison function for memo
const arePropsEqual = (prevProps: any, nextProps: any) => {
  const prevStartTs = parseDate(prevProps.startDate);
  const prevEndTs = parseDate(prevProps.endDate);
  const nextStartTs = parseDate(nextProps.startDate);
  const nextEndTs = parseDate(nextProps.endDate);

  if (prevProps.currentTable !== nextProps.currentTable) {
    return false
  }
  
  if (nextProps.whoChanged !== whoAmI) {
    return false;
  }

  // If the new date range is within the old one, don't re-render
  if (nextStartTs >= prevStartTs && nextEndTs <= prevEndTs) {
    return true; // props are equal, don't re-render
  }

  // If the date range is exactly the same, don't re-render
  if (prevStartTs === nextStartTs && prevEndTs === nextEndTs) {
    return true;
  }

  return false; // props are different, allow re-render
};

// Export the memoized component
export const TimeSeriesChart = memo(TimeSeriesChartBase, arePropsEqual);
