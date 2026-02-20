import { useState, useEffect, useCallback } from 'react';
import { reportAPI, departmentsAPI } from '../services/api';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, RotateCw } from 'lucide-react';
import './ConsolidatedBudgetReport.scss';

const ConsolidatedBudgetReport = () => {
  const [report, setReport] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    financialYear: '2025-2026',
    previousYear: '2024-2025',
    department: ''
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await departmentsAPI.getDepartments();
      setDepartments(response.data.data.departments);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const response = await reportAPI.getConsolidatedBudgetReport(filters);
      setReport(response.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch consolidated report');
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRefresh = () => {
    fetchReport();
  };

  const exportToCSV = () => {
    if (!report) return;

    let csv = 'Consolidated Budget Report\n';
    csv += `Financial Year: ${filters.financialYear}\n`;
    csv += `Generated on: ${new Date().toLocaleDateString()}\n\n`;

    // Summary
    csv += 'SUMMARY\n';
    csv += 'Grand Total Allocated,Grand Total Spent,Grand Total Unspent,Utilization %\n';
    csv += `${report.summary.grandTotalAllocated},${report.summary.grandTotalSpent},${report.summary.grandTotalUnspent},${report.summary.grandUtilizationPercentage}%\n\n`;

    // By Department
    csv += 'DEPARTMENT WISE BREAKDOWN\n';
    csv += 'Department,Total Allocated,Total Spent,Total Unspent,Utilization %\n';
    report.byDepartment.forEach(dept => {
      csv += `"${dept.departmentName}",${dept.totalAllocated},${dept.totalSpent},${dept.totalUnspent},${dept.utilizationPercentage}%\n`;
    });
    csv += '\n';

    // By Category
    csv += 'CATEGORY WISE BREAKDOWN\n';
    csv += 'Category,Allocated,Spent,Utilization %\n';
    Object.keys(report.byCategory).forEach(cat => {
      const data = report.byCategory[cat];
      csv += `"${cat}",${data.allocated},${data.spent},${data.percentage}%\n`;
    });

    // Create download link
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `consolidated-budget-report-${filters.financialYear}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading && !report) {
    return (
      <div className="consolidated-report-container">
        <div className="loading">Loading report...</div>
      </div>
    );
  }

  return (
    <div className="consolidated-report-container">
      <PageHeader
        title="Consolidated Budget Report"
        subtitle="Comprehensive budget allocation and utilization analysis"
      >
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleRefresh}>
            <RotateCw size={18} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={exportToCSV}>
            <Download size={18} /> Export CSV
          </button>
        </div>
      </PageHeader>

      {error && <div className="error-message">{error}</div>}

      <div className="filters-section">
        <div className="form-group">
          <label>Financial Year</label>
          <input
            type="text"
            name="financialYear"
            value={filters.financialYear}
            onChange={handleFilterChange}
            placeholder="e.g., 2025-2026"
          />
        </div>

        <div className="form-group">
          <label>Previous Year (for comparison)</label>
          <input
            type="text"
            name="previousYear"
            value={filters.previousYear}
            onChange={handleFilterChange}
            placeholder="e.g., 2024-2025"
          />
        </div>

        <div className="form-group">
          <label>Department (Optional)</label>
          <select
            name="department"
            value={filters.department}
            onChange={handleFilterChange}
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept._id} value={dept._id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
          {loading ? 'Loading...' : 'Generate Report'}
        </button>
      </div>

      {report && (
        <>
          {/* Summary Stats */}
          <div className="stats-grid">
            <StatCard
              title="Total Allocated"
              value={`₹${report.summary.grandTotalAllocated.toLocaleString('en-IN')}`}
              color="var(--primary)"
            />
            <StatCard
              title="Total Spent"
              value={`₹${report.summary.grandTotalSpent.toLocaleString('en-IN')}`}
              color="var(--info)"
            />
            <StatCard
              title="Total Unspent"
              value={`₹${report.summary.grandTotalUnspent.toLocaleString('en-IN')}`}
              color="var(--warning)"
            />
            <StatCard
              title="Overall Utilization"
              value={`${report.summary.grandUtilizationPercentage}%`}
              color="var(--success)"
            />
          </div>

          {/* Charts */}
          <div className="charts-section">
            <div className="chart-container">
              <h3>Department-wise Allocation vs Spending</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={report.byDepartment.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="departmentName" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalAllocated" fill="#8884d8" name="Allocated" />
                  <Bar dataKey="totalSpent" fill="#82ca9d" name="Spent" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <h3>Budget Utilization by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.keys(report.byCategory).map(cat => ({
                      name: cat,
                      value: report.byCategory[cat].allocated
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.keys(report.byCategory).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <h3>Budget Type Breakdown</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[report.byBudgetType.recurring, report.byBudgetType['non-recurring']]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="allocated" fill="#8884d8" name="Allocated" />
                  <Bar dataKey="spent" fill="#82ca9d" name="Spent" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Table */}
          <div className="report-section">
            <h3>Department-wise Detailed Report</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Total Allocated</th>
                  <th>Total Spent</th>
                  <th>Unspent</th>
                  <th>Utilization %</th>
                </tr>
              </thead>
              <tbody>
                {report.byDepartment.map((dept) => (
                  <tr key={dept.departmentId}>
                    <td>
                      <div>
                        <strong>{dept.departmentName}</strong>
                        <div className="code">{dept.departmentCode}</div>
                      </div>
                    </td>
                    <td>₹{dept.totalAllocated.toLocaleString('en-IN')}</td>
                    <td>₹{dept.totalSpent.toLocaleString('en-IN')}</td>
                    <td>₹{dept.totalUnspent.toLocaleString('en-IN')}</td>
                    <td>
                      <div className="utilization-bar">
                        <div
                          className="utilization-fill"
                          style={{
                            width: `${Math.min(dept.utilizationPercentage, 100)}%`,
                            backgroundColor: dept.utilizationPercentage >= 90 ? '#dc3545' : 
                                           dept.utilizationPercentage >= 75 ? '#ffc107' : '#28a745'
                          }}
                        />
                        <span>{dept.utilizationPercentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Category Table */}
          <div className="report-section">
            <h3>Category-wise Breakdown</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Allocated</th>
                  <th>Spent</th>
                  <th>Utilization %</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(report.byCategory).map((category) => {
                  const data = report.byCategory[category];
                  return (
                    <tr key={category}>
                      <td>{category.replace(/_/g, ' ').toUpperCase()}</td>
                      <td>₹{data.allocated.toLocaleString('en-IN')}</td>
                      <td>₹{data.spent.toLocaleString('en-IN')}</td>
                      <td>{data.percentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ConsolidatedBudgetReport;
