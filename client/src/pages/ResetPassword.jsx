import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, GraduationCap } from 'lucide-react';
import './ResetPassword.scss';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        newPassword: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState({
        new: false,
        confirm: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const togglePasswordVisibility = (field) => {
        setShowPassword(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    const getPasswordStrength = (password) => {
        if (password.length === 0) return { strength: 0, label: '', color: '' };
        if (password.length < 6) return { strength: 25, label: 'Weak', color: '#dc3545' };
        if (password.length < 8) return { strength: 50, label: 'Fair', color: '#ffc107' };
        if (password.length < 12 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            return { strength: 75, label: 'Good', color: '#17a2b8' };
        }
        return { strength: 100, label: 'Strong', color: '#28a745' };
    };

    const passwordStrength = getPasswordStrength(formData.newPassword);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate passwords
        if (formData.newPassword !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.newPassword.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        setLoading(true);

        try {
            // TODO: Implement reset password API call
            // const response = await authAPI.resetPassword(token, formData.newPassword);

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            setSuccess(true);

            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reset password. The link may have expired.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="reset-password-container">
                <div className="reset-password-card">
                    <div className="success-icon">
                        <CheckCircle2 size={64} />
                    </div>
                    <h1>Password Reset Successful!</h1>
                    <p className="success-message">
                        Your password has been successfully reset. You can now log in with your new password.
                    </p>
                    <p className="redirect-text">
                        Redirecting to login page...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="reset-password-container">
            <div className="reset-password-card">
                <div className="logo">
                    <GraduationCap size={48} />
                    <h2>CBMS</h2>
                </div>

                <h1>Reset Password</h1>
                <p className="subtitle">
                    Please enter your new password below.
                </p>

                {error && (
                    <div className="alert alert-error">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="reset-password-form">
                    <div className="form-group">
                        <label htmlFor="newPassword">
                            <Lock size={18} />
                            New Password
                        </label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword.new ? 'text' : 'password'}
                                id="newPassword"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleChange}
                                placeholder="Enter new password"
                                required
                                minLength={6}
                                autoFocus
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => togglePasswordVisibility('new')}
                            >
                                {showPassword.new ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        {formData.newPassword && (
                            <div className="password-strength">
                                <div className="strength-bar">
                                    <div
                                        className="strength-fill"
                                        style={{
                                            width: `${passwordStrength.strength}%`,
                                            backgroundColor: passwordStrength.color
                                        }}
                                    ></div>
                                </div>
                                <span className="strength-label" style={{ color: passwordStrength.color }}>
                                    {passwordStrength.label}
                                </span>
                            </div>
                        )}
                        <small>Minimum 6 characters. Use uppercase, numbers for stronger password.</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">
                            <Lock size={18} />
                            Confirm New Password
                        </label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword.confirm ? 'text' : 'password'}
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Confirm new password"
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => togglePasswordVisibility('confirm')}
                            >
                                {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={loading}
                    >
                        {loading ? 'Resetting Password...' : 'Reset Password'}
                    </button>
                </form>

                <div className="back-to-login">
                    <Link to="/login">
                        Back to Login
                    </Link>
                </div>
            </div>

            <div className="reset-password-footer">
                <p>Having trouble? Contact your system administrator</p>
            </div>
        </div>
    );
};

export default ResetPassword;
