import React, { useState } from 'react';
import { allocationAPI } from '../services/api';
import './BulkUpload.scss';

const BulkUpload = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploadResults, setUploadResults] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB
        setError('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await allocationAPI.getCSVTemplate();

      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'allocation-template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download template');
      console.error('Error downloading template:', err);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setUploadResults(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', selectedFile);

      const response = await allocationAPI.bulkUploadCSV(formData);

      if (response.data.success) {
        setSuccess(response.data.message);
        setUploadResults(response.data.data);
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload CSV file');
      console.error('Error uploading CSV:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!uploadResults?.importReport) return;

    const blob = new Blob([uploadResults.importReport], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'allocation-import-report.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bulk-upload-container">
      <div className="bulk-upload-header">
        <h1>Bulk Allocation Upload</h1>
        <p>Upload multiple budget allocations using a CSV file</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          {success}
        </div>
      )}

      <div className="upload-section">
        <div className="template-section">
          <h3>Step 1: Download Template</h3>
          <p>Download the CSV template to see the required format and add your allocation data.</p>
          <button
            className="btn btn-secondary"
            onClick={handleDownloadTemplate}
          >
            <i className="fas fa-download"></i>
            Download Template
          </button>
        </div>

        <div className="upload-section-content">
          <h3>Step 2: Upload CSV File</h3>
          <p>Select your CSV file with allocation data and upload it.</p>

          <div className="file-upload-area">
            <input
              type="file"
              id="csvFile"
              accept=".csv"
              onChange={handleFileSelect}
              className="file-input"
            />
            <label htmlFor="csvFile" className="file-label">
              <div className="file-icon">
                <i className="fas fa-cloud-upload-alt"></i>
              </div>
              <div className="file-text">
                {selectedFile ? (
                  <>
                    <strong>{selectedFile.name}</strong>
                    <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                  </>
                ) : (
                  <>
                    <strong>Click to select CSV file</strong>
                    <span>Maximum file size: 5MB</span>
                  </>
                )}
              </div>
            </label>
          </div>

          <div className="upload-actions">
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={!selectedFile || loading}
            >
              {loading ? (
                'Uploading...'
              ) : (
                <>
                  <i className="fas fa-upload"></i>
                  Upload CSV
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {uploadResults && (
        <div className="upload-results">
          <div className="results-header">
            <h3>Upload Results</h3>
            <div className="results-summary">
              <div className="summary-item">
                <span className="label">Total Rows:</span>
                <span className="value">{uploadResults.totalRows}</span>
              </div>
              <div className="summary-item success">
                <span className="label">Successful:</span>
                <span className="value">{uploadResults.successfulRows}</span>
              </div>
              <div className="summary-item error">
                <span className="label">Errors:</span>
                <span className="value">{uploadResults.errorRows}</span>
              </div>
            </div>
          </div>

          {uploadResults.results && uploadResults.results.length > 0 && (
            <div className="results-table">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Department</th>
                    <th>Budget Head</th>
                    <th>Amount</th>
                    <th>Financial Year</th>
                    <th>Status</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadResults.results.map((result, index) => (
                    <tr key={index} className={result.success ? 'success-row' : 'error-row'}>
                      <td>{result.rowNumber}</td>
                      <td>{result.departmentName}</td>
                      <td>{result.budgetHeadName}</td>
                      <td>{result.allocatedAmount ? formatCurrency(result.allocatedAmount) : '-'}</td>
                      <td>{result.financialYear}</td>
                      <td>
                        <span className={`status-badge ${result.success ? 'success' : 'error'}`}>
                          {result.success ? 'Success' : 'Error'}
                        </span>
                      </td>
                      <td>{result.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="results-actions">
            <button
              className="btn btn-secondary"
              onClick={handleDownloadReport}
            >
              <i className="fas fa-download"></i>
              Download Report
            </button>
          </div>
        </div>
      )}

      <div className="help-section">
        <h3>CSV Format Requirements</h3>
        <div className="help-content">
          <div className="help-item">
            <h4>Required Columns:</h4>
            <ul>
              <li><strong>department_name</strong> - Name of the department</li>
              <li><strong>budget_head_name</strong> - Name of the budget head</li>
              <li><strong>allocated_amount</strong> - Amount to allocate (numbers only)</li>
              <li><strong>financial_year</strong> - Financial year in YYYY-YY format</li>
            </ul>
          </div>
          <div className="help-item">
            <h4>Optional Columns:</h4>
            <ul>
              <li><strong>remarks</strong> - Additional notes or comments</li>
            </ul>
          </div>
          <div className="help-item">
            <h4>Important Notes:</h4>
            <ul>
              <li>Department and budget head names must match existing records</li>
              <li>Financial year must be in YYYY-YY format (e.g., 2024-25)</li>
              <li>Allocated amounts must be positive numbers</li>
              <li>Duplicate allocations for the same department and budget head will be skipped</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkUpload;
