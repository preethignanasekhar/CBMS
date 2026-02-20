import React from 'react';
import '../../styles/common-components.scss';

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    onClick,
    type = 'button',
    fullWidth = false,
    icon: Icon,
    className = '',
    ...props
}) => {
    return (
        <button
            type={type}
            className={`btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full' : ''} ${loading ? 'btn-loading' : ''} ${className}`}
            disabled={disabled || loading}
            onClick={onClick}
            {...props}
        >
            {loading ? (
                <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
            ) : (
                <>
                    {Icon && <Icon size={size === 'sm' ? 14 : 18} />}
                    {children}
                </>
            )}
        </button>
    );
};

export default Button;
