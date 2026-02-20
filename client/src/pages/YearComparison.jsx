import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { allocationAPI } from '../services/api';
import { Download, FileSpreadsheet, FileText, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import './YearComparison.scss';

const YearComparison = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [filters, setFilters] = useState({
    currentYear: '2024-25',
    previousYear: '2023-24'
  });

  useEffect(() => {
    fetchComparisonData();
  }, [filters]);

  const fetchComparisonData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await allocationAPI.getYearComparison(filters);
      setComparisonData(response.data.data);
    } catch (err) {
      setError('Failed to fetch year comparison data');
      console.error('Error fetching year comparison:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getChangeColor = (change) => {
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
  };

  const getChangeIcon = (change) => {
    if (change > 0) return 'fas fa-arrow-up';
    if (change < 0) return 'fas fa-arrow-down';
    return 'fas fa-minus';
  };

  const handleExportCSV = () => {
    if (!comparisonData?.departmentComparison) return;

    const csvData = comparisonData.departmentComparison.map(dept => ({
      Department: dept.departmentName,
      [`Allocation ${filters.currentYear}`]: dept.allocationChange.current,
      [`Allocation ${filters.previousYear}`]: dept.allocationChange.previous,
      [`Allocation Change %`]: dept.allocationChange.changePercentage,
      [`Spending ${filters.currentYear}`]: dept.spendingChange.current,
      [`Spending ${filters.previousYear}`]: dept.spendingChange.previous,
      [`Spending Change %`]: dept.spendingChange.changePercentage
    }));

    const ws = XLSX.utils.json_to_sheet(csvData);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);

    const blob = new Blob([csvOutput], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `year-comparison-${filters.currentYear}-vs-${filters.previousYear}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleExcelExport = () => {
    if (!comparisonData?.departmentComparison) return;

    const exportData = comparisonData.departmentComparison.map(dept => ({
      'Department': dept.departmentName,
      [`Allocation ${filters.currentYear}`]: dept.allocationChange.current,
      [`Allocation ${filters.previousYear}`]: dept.allocationChange.previous,
      'Allocation Change %': dept.allocationChange.changePercentage,
      [`Spending ${filters.currentYear}`]: dept.spendingChange.current,
      [`Spending ${filters.previousYear}`]: dept.spendingChange.previous,
      'Spending Change %': dept.spendingChange.changePercentage,
      [`Utilization ${filters.currentYear} %`]: dept.utilizationChange.current,
      [`Utilization ${filters.previousYear} %`]: dept.utilizationChange.previous
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Year Comparison');
    XLSX.writeFile(wb, `year-comparison-${filters.currentYear}-vs-${filters.previousYear}.xlsx`);
  };

  const handlePDFExport = () => {
    if (!comparisonData?.departmentComparison) return;

    const doc = new jsPDF();
    const fileName = `year-comparison-${filters.currentYear}-vs-${filters.previousYear}.pdf`;

    doc.setFontSize(18);
    doc.text('Year-over-Year Comparison Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Comparison: ${filters.currentYear} vs ${filters.previousYear}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);

    const columns = [
      'Department',
      `Alloc ${filters.currentYear}`,
      `Alloc ${filters.previousYear}`,
      'Change %',
      `Spent ${filters.currentYear}`,
      `Spent ${filters.previousYear}`,
      'Change %'
    ];

    const rows = comparisonData.departmentComparison.map(dept => [
      dept.departmentName,
      formatCurrency(dept.allocationChange.current),
      formatCurrency(dept.allocationChange.previous),
      `${dept.allocationChange.changePercentage}%`,
      formatCurrency(dept.spendingChange.current),
      formatCurrency(dept.spendingChange.previous),
      `${dept.spendingChange.changePercentage}%`
    ]);

    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 }
    });

    doc.save(fileName);
  };

  const getAllocationComparisonOption = () => {
    if (!comparisonData?.departmentComparison) return null;

    const departments = comparisonData.departmentComparison.map(d => d.departmentName);
    if (departments.length === 0) return null;
    const previousYearData = comparisonData.departmentComparison.map(d => d.allocationChange.previous);
    const currentYearData = comparisonData.departmentComparison.map(d => d.allocationChange.current);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          return params.map(param =>
            `${param.seriesName}: ${formatCurrency(param.value)}`
          ).join('<br/>');
        }
      },
      legend: {
        data: [`${filters.previousYear}`, `${filters.currentYear}`],
        top: 0
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: departments },
      yAxis: { type: 'value' },
      series: [
        {
          name: filters.previousYear,
          type: 'bar',
          data: previousYearData,
          itemStyle: { color: '#9ca3af' }
        },
        {
          name: filters.currentYear,
          type: 'bar',
          data: currentYearData,
          itemStyle: { color: '#4f46e5' }
        }
      ]
    };
  };

  const getSpendingComparisonOption = () => {
    if (!comparisonData?.departmentComparison) return null;

    const departments = comparisonData.departmentComparison.map(d => d.departmentName);
    if (departments.length === 0) return null;
    const previousYearData = comparisonData.departmentComparison.map(d => d.spendingChange.previous);
    const currentYearData = comparisonData.departmentComparison.map(d => d.spendingChange.current);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          return params.map(param =>
            `${param.seriesName}: ${formatCurrency(param.value)}`
          ).join('<br/>');
        }
      },
      legend: {
        data: [`${filters.previousYear}`, `${filters.currentYear}`],
        top: 0
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: departments },
      yAxis: { type: 'value' },
      series: [
        {
          name: filters.previousYear,
          type: 'bar',
          data: previousYearData,
          itemStyle: { color: '#9ca3af' }
        },
        {
          name: filters.currentYear,
          type: 'bar',
          data: currentYearData,
          itemStyle: { color: '#10b981' }
        }
      ]
    };
  };

  const renderOverallComparison = () => {
    if (!comparisonData?.overallComparison) return null;

    const { overallComparison } = comparisonData;

    return (
      <div className="overall-comparison">
        <h3>Overall Year Comparison</h3>
        <div className="comparison-grid">
          <div className="comparison-card">
            <div className="card-header">
              <h4>Budget Allocation</h4>
              <div className="year-labels">
                <span className="current-year">{overallComparison.currentYear}</span>
                <span className="vs">vs</span>
                <span className="previous-year">{overallComparison.previousYear}</span>
              </div>
            </div>
            <div className="card-content">
              <div className="amount-row">
                <div className="amount-item">
                  <span className="label">Current Year:</span>
                  <span className="value">{formatCurrency(overallComparison.allocationChange.current)}</span>
                </div>
                <div className="amount-item">
                  <span className="label">Previous Year:</span>
                  <span className="value">{formatCurrency(overallComparison.allocationChange.previous)}</span>
                </div>
              </div>
              <div className={`change-indicator ${getChangeColor(overallComparison.allocationChange.change)}`}>
                <i className={getChangeIcon(overallComparison.allocationChange.change)}></i>
                <span className="change-amount">{formatCurrency(Math.abs(overallComparison.allocationChange.change))}</span>
                <span className="change-percentage">({overallComparison.allocationChange.changePercentage}%)</span>
              </div>
            </div>
          </div>

          <div className="comparison-card">
            <div className="card-header">
              <h4>Total Spending</h4>
              <div className="year-labels">
                <span className="current-year">{overallComparison.currentYear}</span>
                <span className="vs">vs</span>
                <span className="previous-year">{overallComparison.previousYear}</span>
              </div>
            </div>
            <div className="card-content">
              <div className="amount-row">
                <div className="amount-item">
                  <span className="label">Current Year:</span>
                  <span className="value">{formatCurrency(overallComparison.spendingChange.current)}</span>
                </div>
                <div className="amount-item">
                  <span className="label">Previous Year:</span>
                  <span className="value">{formatCurrency(overallComparison.spendingChange.previous)}</span>
                </div>
              </div>
              <div className={`change-indicator ${getChangeColor(overallComparison.spendingChange.change)}`}>
                <i className={getChangeIcon(overallComparison.spendingChange.change)}></i>
                <span className="change-amount">{formatCurrency(Math.abs(overallComparison.spendingChange.change))}</span>
                <span className="change-percentage">({overallComparison.spendingChange.changePercentage}%)</span>
              </div>
            </div>
          </div>

          <div className="comparison-card">
            <div className="card-header">
              <h4>Budget Utilization</h4>
              <div className="year-labels">
                <span className="current-year">{overallComparison.currentYear}</span>
                <span className="vs">vs</span>
                <span className="previous-year">{overallComparison.previousYear}</span>
              </div>
            </div>
            <div className="card-content">
              <div className="amount-row">
                <div className="amount-item">
                  <span className="label">Current Year:</span>
                  <span className="value">{overallComparison.utilizationChange.current}%</span>
                </div>
                <div className="amount-item">
                  <span className="label">Previous Year:</span>
                  <span className="value">{overallComparison.utilizationChange.previous}%</span>
                </div>
              </div>
              <div className={`change-indicator ${getChangeColor(overallComparison.utilizationChange.change)}`}>
                <i className={getChangeIcon(overallComparison.utilizationChange.change)}></i>
                <span className="change-amount">{Math.abs(overallComparison.utilizationChange.change)}%</span>
                <span className="change-percentage">change</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDepartmentComparison = () => {
    if (!comparisonData?.departmentComparison) return null;

    return (
      <div className="department-comparison">
        <h3>Department-wise Comparison</h3>
        <div className="comparison-table">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Allocation Change</th>
                <th>Spending Change</th>
                <th>Utilization Change</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.departmentComparison.map((dept, index) => (
                <tr key={index}>
                  <td className="department-name">{dept.departmentName}</td>
                  <td>
                    <div className="change-cell">
                      <div className="change-values">
                        <span className="current">{formatCurrency(dept.allocationChange.current)}</span>
                        <span className="previous">{formatCurrency(dept.allocationChange.previous)}</span>
                      </div>
                      <div className={`change-indicator ${getChangeColor(dept.allocationChange.change)}`}>
                        <i className={getChangeIcon(dept.allocationChange.change)}></i>
                        <span>{dept.allocationChange.changePercentage}%</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="change-cell">
                      <div className="change-values">
                        <span className="current">{formatCurrency(dept.spendingChange.current)}</span>
                        <span className="previous">{formatCurrency(dept.spendingChange.previous)}</span>
                      </div>
                      <div className={`change-indicator ${getChangeColor(dept.spendingChange.change)}`}>
                        <i className={getChangeIcon(dept.spendingChange.change)}></i>
                        <span>{dept.spendingChange.changePercentage}%</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="change-cell">
                      <div className="change-values">
                        <span className="current">{dept.utilizationChange.current}%</span>
                        <span className="previous">{dept.utilizationChange.previous}%</span>
                      </div>
                      <div className={`change-indicator ${getChangeColor(dept.utilizationChange.change)}`}>
                        <i className={getChangeIcon(dept.utilizationChange.change)}></i>
                        <span>{dept.utilizationChange.change}%</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBudgetHeadComparison = () => {
    if (!comparisonData?.budgetHeadComparison) return null;

    return (
      <div className="budget-head-comparison">
        <h3>Budget Head-wise Comparison</h3>
        <div className="comparison-table">
          <table>
            <thead>
              <tr>
                <th>Budget Head</th>
                <th>Allocation Change</th>
                <th>Spending Change</th>
                <th>Utilization Change</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.budgetHeadComparison.map((head, index) => (
                <tr key={index}>
                  <td className="budget-head-name">{head.budgetHeadName}</td>
                  <td>
                    <div className="change-cell">
                      <div className="change-values">
                        <span className="current">{formatCurrency(head.allocationChange.current)}</span>
                        <span className="previous">{formatCurrency(head.allocationChange.previous)}</span>
                      </div>
                      <div className={`change-indicator ${getChangeColor(head.allocationChange.change)}`}>
                        <i className={getChangeIcon(head.allocationChange.change)}></i>
                        <span>{head.allocationChange.changePercentage}%</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="change-cell">
                      <div className="change-values">
                        <span className="current">{formatCurrency(head.spendingChange.current)}</span>
                        <span className="previous">{formatCurrency(head.spendingChange.previous)}</span>
                      </div>
                      <div className={`change-indicator ${getChangeColor(head.spendingChange.change)}`}>
                        <i className={getChangeIcon(head.spendingChange.change)}></i>
                        <span>{head.spendingChange.changePercentage}%</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="change-cell">
                      <div className="change-values">
                        <span className="current">{head.utilizationChange.current}%</span>
                        <span className="previous">{head.utilizationChange.previous}%</span>
                      </div>
                      <div className={`change-indicator ${getChangeColor(head.utilizationChange.change)}`}>
                        <i className={getChangeIcon(head.utilizationChange.change)}></i>
                        <span>{head.utilizationChange.change}%</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="year-comparison-container">
      <div className="year-comparison-header">
        <h1>Year-over-Year Comparison</h1>
        <p>Compare budget allocations and spending between financial years</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="year-comparison-controls">
        <div className="year-selectors">
          <div className="year-selector">
            <label htmlFor="currentYear">Current Year</label>
            <select
              id="currentYear"
              name="currentYear"
              value={filters.currentYear}
              onChange={handleFilterChange}
              className="year-select"
            >
              <option value="2024-25">2024-25</option>
              <option value="2023-24">2023-24</option>
              <option value="2022-23">2022-23</option>
            </select>
          </div>
          <div className="year-selector">
            <label htmlFor="previousYear">Previous Year</label>
            <select
              id="previousYear"
              name="previousYear"
              value={filters.previousYear}
              onChange={handleFilterChange}
              className="year-select"
            >
              <option value="2023-24">2023-24</option>
              <option value="2022-23">2022-23</option>
              <option value="2021-22">2021-22</option>
            </select>
          </div>
        </div>

        <div className="export-actions">
          <button className="btn btn-outline" onClick={handleExportCSV} title="Export CSV">
            <FileText size={18} />
          </button>
          <button className="btn btn-outline" onClick={handleExcelExport} title="Export Excel">
            <FileSpreadsheet size={18} />
          </button>
          <button className="btn btn-outline" onClick={handlePDFExport} title="Export PDF">
            <Download size={18} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading">
          <span>Loading comparison data...</span>
        </div>
      )}

      {comparisonData && !loading && (
        <div className="year-comparison-results">
          {renderOverallComparison()}

          <div className="charts-section">
            <div className="chart-card">
              <h3>Allocation Comparison</h3>
              {getAllocationComparisonOption() ? (
                <ReactECharts option={getAllocationComparisonOption()} style={{ height: '350px' }} />
              ) : (
                <div className="no-data-display">
                  <AlertCircle size={40} />
                  <p>No allocation data available for comparison</p>
                </div>
              )}
            </div>
            <div className="chart-card">
              <h3>Spending Comparison</h3>
              {getSpendingComparisonOption() ? (
                <ReactECharts option={getSpendingComparisonOption()} style={{ height: '350px' }} />
              ) : (
                <div className="no-data-display">
                  <AlertCircle size={40} />
                  <p>No spending data available for comparison</p>
                </div>
              )}
            </div>
          </div>

          {renderDepartmentComparison()}
          {renderDepartmentComparison()}
          {renderBudgetHeadComparison()}
        </div>
      )}
    </div>
  );
};

export default YearComparison;
