import { TabularResult } from 'lib/types';
import ReactECharts, { EChartsOption } from 'echarts-for-react';
import React from 'react';
interface PieChartProps {
  tabularResult: TabularResult | null;
}

export const PieChart: React.FC<PieChartProps> = ({ tabularResult }) => {


  if (tabularResult == null) {
    return null;
  }

  const getPieChartOption = (): EChartsOption => {
    if (tabularResult?.columns.length !== 2 || tabularResult?.rows.length === 0) {
      return {};
    }

    const chartData = tabularResult.rows.map(row => ({
      name: row[0],
      value: parseFloat(row[1]) || 0
    }));

    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: '{a} <br/>{b}: {c} ({d}%)',
        backgroundColor: 'rgba(32, 34, 38, 0.9)',
        borderWidth: 0,
        textStyle: {
          color: 'rgb(204, 204, 220)'
        }
      },
      legend: {
        orient: 'horizontal' as const,
        bottom: 10,
        left: 'center',
        data: chartData.map(item => item.name),
        textStyle: {
          color: 'rgb(204, 204, 220)'
        },
        pageIconColor: 'rgb(204, 204, 220)',
        pageTextStyle: {
          color: 'rgb(204, 204, 220)'
        }
      },
      series: [
        {
          name: tabularResult?.columns[0],
          type: 'pie',
          radius: ['30%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: 'rgb(25, 26, 31)',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}: {d}%',
            color: 'rgb(204, 204, 220)'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
              color: 'rgb(204, 204, 220)'
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          labelLine: {
            show: true,
            lineStyle: {
              color: 'rgba(204, 204, 220, 0.5)'
            }
          },
          data: chartData
        }
      ]
    };
  };

  const option = getPieChartOption();
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
    </div>
  );
};

