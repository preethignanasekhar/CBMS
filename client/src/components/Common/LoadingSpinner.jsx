import React from 'react';

/**
 * Reusable Loading Spinner Component
 * 
 * @param {string} size - sm | md | lg
 * @param {string} variant - primary | secondary | white
 * @param {string} message - Loading message to display
 * @param {boolean} fullPage - Show as full-page overlay
 */
const LoadingSpinner = ({
    size = 'md',
    variant = 'primary',
    message,
    fullPage = false,
    className = ''
}) => {
    const spinnerClass = `spinner spinner-${size} spinner-${variant} ${className}`.trim();

    const content = (
        <div className="spinner-container">
            <div className={spinnerClass}></div>
            {message && <p className="spinner-message">{message}</p>}
        </div>
    );

    if (fullPage) {
        return (
            <div className="spinner-overlay">
                {content}
            </div>
        );
    }

    return content;
};

export default LoadingSpinner;
