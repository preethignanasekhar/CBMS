import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, GraduationCap } from 'lucide-react';
import './ForgotPassword.scss';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // TODO: Implement forgot password API call
            // const response = await authAPI.forgotPassword({ email });

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send reset link. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="forgot-password-container">
                <div className="forgot-password-card">
                    <div className="success-icon">
                        <CheckCircle2 size={64} />
                    </div>
                    <h1>Check Your Email</h1>
                    <p className="success-message">
                        We've sent a password reset link to <strong>{email}</strong>
                    </p>
                    <p className="info-text">
                        Please check your email and click on the link to reset your password.
                        The link will expire in 1 hour.
                    </p>
                    <div className="action-links">
                        <Link to="/login" className="btn btn-primary">
                            <ArrowLeft size={18} />
                            Back to Login
                        </Link>
                    </div>
                    <p className="resend-text">
                        Didn't receive the email?{' '}
                        <button
                            onClick={() => {
                                setSuccess(false);
                                setEmail('');
                            }}
                            className="link-button"
                        >
                            Try again
                        </button>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="forgot-password-container">
            <div className="forgot-password-card">
                <div className="logo">
                    <GraduationCap size={48} />
                    <h2>CBMS</h2>
                </div>

                <h1>Forgot Password?</h1>
                <p className="subtitle">
                    No worries! Enter your email address and we'll send you a link to reset your password.
                </p>

                {error && (
                    <div className="alert alert-error">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="forgot-password-form">
                    <div className="form-group">
                        <label htmlFor="email">
                            <Mail size={18} />
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={loading}
                    >
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>

                <div className="back-to-login">
                    <Link to="/login">
                        <ArrowLeft size={16} />
                        Back to Login
                    </Link>
                </div>
            </div>

            <div className="forgot-password-footer">
                <p>Need help? Contact your system administrator</p>
            </div>
        </div>
    );
};

export default ForgotPassword;
