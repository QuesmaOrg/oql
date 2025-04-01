import { TabularResult } from 'lib/types';
import ReactECharts, { EChartsOption } from 'echarts-for-react';
import React from 'react';
import { SeriesOption } from 'echarts';
interface LineChartProps {
  tabularResult: TabularResult | null;
}

export const LineChart: React.FC<LineChartProps> = ({ tabularResult }) => {

    const debug = false;

    if (tabularResult == null) {
        return null;
    }

    const getLineChartOption = (): EChartsOption => {
        if (tabularResult?.columns.length !== 3 || tabularResult?.rows.length === 0) {
          return {};
        }

        const title = tabularResult.columns[1];

        const labels = [...new Set(tabularResult.rows.map(row => row[1]))];
        
        // if labels are too long, render them slightly different
        let axisLabel = {} ;
        const maxLabelLength = Math.max(...labels.map(label => label.length));
        if (maxLabelLength > 10) {
            axisLabel = {
                rotate: 45,
                interval: 0,
                align: 'right',
                padding: [8, 0, 0, 0]
            }
        }
        
        const xAxisData = [...new Set(tabularResult.rows.map(row => row[0]))];

        const series = [];
        for (let label of labels) {
            const values = xAxisData.map(xValue => {
                const matchingRow = tabularResult.rows.find(row => row[0] === xValue && row[1] === label);
                return [xValue, matchingRow ? parseFloat(matchingRow[2]) : 0];
            });
            
            series.push({
                name: label,
                type: 'line',
                data: values
            });
        }

        return {
            title: {
              text: title,
            },
            tooltip: {
              trigger: 'axis'
            },
            legend: {
              data: labels
            },
            grid: {
              left: '3%',
              right: '4%',
              bottom: '3%',
              containLabel: true
            },
            toolbox: {
              feature: {
                saveAsImage: {}
              }
            },
            xAxis: {
              type: 'category',
              boundaryGap: false,
              data: xAxisData,
              axisLabel: axisLabel
            },
            yAxis: {
              type: 'value'
            },
            series: series as SeriesOption[]
            }
        };

    const option = getLineChartOption();
    if (Object.keys(option).length === 0) {
        return null;
    }

  return (
    <div style={{ 
      height: 'calc(100% - 50px)', 
      backgroundColor: 'rgb(25, 26, 31)', 
      borderRadius: '8px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <ReactECharts
        option={{
          ...option,
          backgroundColor: 'rgb(25, 26, 31)',
          grid: {
            ...option.grid,
            backgroundColor: 'rgb(25, 26, 31)'
          }
        }}
        style={{ height: '700px', width: '100%' }}
        theme="dark"
        opts={{ renderer: 'canvas' }}
      />
      {debug && <pre>{JSON.stringify(option, null, 2)}</pre>}
    </div>
  );
}; 

