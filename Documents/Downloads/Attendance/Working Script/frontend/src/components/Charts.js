// frontend/src/components/Charts.js
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Charts = ({ type, period = 'week' }) => {
  // Generate mock data based on period
  const generateMockData = () => {
    const labels = {
      week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      month: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      quarter: ['Jan', 'Feb', 'Mar'],
      year: ['Q1', 'Q2', 'Q3', 'Q4']
    };

    const attendanceData = {
      week: [145, 142, 148, 144, 139, 25, 30],
      month: [680, 672, 695, 688],
      quarter: [2150, 2080, 2200],
      year: [8500, 8200, 8800, 8600]
    };

    const performanceData = {
      week: [95, 93, 97, 94, 91, 85, 88],
      month: [94, 92, 96, 95],
      quarter: [94, 91, 96],
      year: [93, 91, 95, 94]
    };

    return {
      labels: labels[period] || labels.week,
      attendance: attendanceData[period] || attendanceData.week,
      performance: performanceData[period] || performanceData.week
    };
  };

  const data = generateMockData();

  // Chart options
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#6B7280'
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: '#F3F4F6'
        },
        ticks: {
          color: '#6B7280'
        }
      }
    }
  };

  // Attendance Chart
  if (type === 'attendance') {
    const chartData = {
      labels: data.labels,
      datasets: [
        {
          label: 'Present',
          data: data.attendance,
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Absent',
          data: data.attendance.map(val => Math.max(0, 150 - val)),
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    };

    return (
      <div className="h-64">
        <Bar data={chartData} options={commonOptions} />
      </div>
    );
  }

  // Performance Chart
  if (type === 'performance') {
    const chartData = {
      labels: data.labels,
      datasets: [
        {
          label: 'Attendance Rate (%)',
          data: data.performance,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        },
        {
          label: 'Productivity Score (%)',
          data: data.performance.map(val => val - Math.random() * 5),
          borderColor: 'rgba(168, 85, 247, 1)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(168, 85, 247, 1)',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }
      ]
    };

    return (
      <div className="h-64">
        <Line data={chartData} options={commonOptions} />
      </div>
    );
  }

  // Department Distribution Chart
  if (type === 'departments') {
    const chartData = {
      labels: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations'],
      datasets: [
        {
          label: 'Employees by Department',
          data: [45, 32, 18, 12, 15, 28],
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(14, 165, 233, 0.8)'
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(34, 197, 94, 1)',
            'rgba(249, 115, 22, 1)',
            'rgba(168, 85, 247, 1)',
            'rgba(236, 72, 153, 1)',
            'rgba(14, 165, 233, 1)'
          ],
          borderWidth: 2
        }
      ]
    };

    const doughnutOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            usePointStyle: true,
            padding: 15,
            generateLabels: (chart) => {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  const meta = chart.getDatasetMeta(0);
                  const style = meta.controller.getStyle(i);
                  return {
                    text: `${label}: ${data.datasets[0].data[i]}`,
                    fillStyle: style.backgroundColor,
                    strokeStyle: style.borderColor,
                    lineWidth: style.borderWidth,
                    pointStyle: 'circle',
                    hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    };

    return (
      <div className="h-64">
        <Doughnut data={chartData} options={doughnutOptions} />
      </div>
    );
  }

  // Monthly Trends Chart
  if (type === 'trends') {
    const chartData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Average Attendance (%)',
          data: [94, 92, 96, 95, 93, 97, 94, 96, 95, 93, 91, 94],
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4
        },
        {
          label: 'Late Arrivals (%)',
          data: [8, 12, 6, 9, 11, 5, 8, 7, 9, 12, 14, 8],
          borderColor: 'rgba(249, 115, 22, 1)',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4
        }
      ]
    };

    return (
      <div className="h-64">
        <Line data={chartData} options={commonOptions} />
      </div>
    );
  }

  // Default fallback
  return (
    <div className="h-64 flex items-center justify-center bg-gray-100 rounded-lg">
      <div className="text-center">
        <div className="text-4xl text-gray-400 mb-2">📊</div>
        <p className="text-gray-600">Chart data loading...</p>
        <p className="text-sm text-gray-500 mt-1">Type: {type} | Period: {period}</p>
      </div>
    </div>
  );
};

export default Charts;