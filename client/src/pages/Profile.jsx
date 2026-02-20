import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { User, Mail, Briefcase, Building2, Calendar, Lock, Save, AlertCircle, CheckCircle2, Eye, EyeOff, Camera, Loader2 } from 'lucide-react';
import './Profile.scss';

const Profile = () => {
    const { user, updateProfile: updateAuthProfile, uploadProfilePicture } = useAuth();
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const fileInputRef = useRef(null);

    const [profileData, setProfileData] = useState({
        name: '',
        email: '',
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });

    useEffect(() => {
        if (user) {
            setProfileData({
                name: user.name || '',
                email: user.email || '',
            });
        }
    }, [user]);

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const togglePasswordVisibility = (field) => {
        setShowPasswords(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    const handleImageClick = () => {
        fileInputRef.current.click();
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
            setError('Please upload a valid image file (JPG, PNG)');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('File size too large. Max 5MB allowed.');
            return;
        }

        const formData = new FormData();
        formData.append('profilePicture', file);

        console.log('[Profile] Uploading image:', file.name, 'size:', file.size);

        setImageLoading(true);
        setError(null);

        try {
            console.log('[Profile] Calling uploadProfilePicture...');
            const result = await uploadProfilePicture(formData);
            console.log('[Profile] Upload result:', result);
            if (result.success) {
                setSuccess('Profile picture updated!');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Failed to upload image');
        } finally {
            setImageLoading(false);
        }
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await authAPI.updateProfile(profileData);

            if (response.data.success) {
                // Update context with new user data
                await updateAuthProfile(response.data.data.user);

                // Update localStorage
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({
                    ...storedUser,
                    ...response.data.data.user
                }));

                setSuccess('Profile updated successfully!');
                setIsEditing(false);

                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile');
            setTimeout(() => setError(null), 5000);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        // Validate passwords
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setError('New password must be at least 6 characters long');
            return;
        }

        setLoading(true);

        try {
            const response = await authAPI.changePassword({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
            });

            if (response.data.success) {
                setSuccess('Password changed successfully!');
                setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                });
                setShowPasswordForm(false);
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to change password');
            setTimeout(() => setError(null), 5000);
        } finally {
            setLoading(false);
        }
    };

    const getRoleLabel = (role) => {
        const roleLabels = {
            admin: 'Administrator',
            office: 'Office Staff',
            department: 'Department User',
            hod: 'Head of Department',
            vice_principal: 'Vice Principal',
            principal: 'Principal',
            auditor: 'Auditor'
        };
        return roleLabels[role] || role;
    };

    const getFullImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;

        // If it's a relative path starting with /uploads, and we're in dev,
        // we can let the Vite proxy handle it.
        if (import.meta.env.DEV && path.startsWith('/uploads')) {
            return path;
        }

        const apiBase = import.meta.env.REACT_APP_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        return `${apiBase}${path}`;
    };

    return (
        <div className="profile-container">
            <div className="profile-hero">
                <div className="banner-area"></div>
                <div className="hero-content">
                    <div className="profile-avatar-wrapper">
                        <div className="profile-avatar-container" onClick={handleImageClick}>
                            {imageLoading ? (
                                <div className="avatar-loading">
                                    <Loader2 className="spinner" />
                                </div>
                            ) : (
                                <div className="avatar-preview">
                                    {user?.profilePicture ? (
                                        <img src={getFullImageUrl(user.profilePicture)} alt="Profile" />
                                    ) : (
                                        <div className="avatar-initials">
                                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                    )}
                                    <div className="avatar-overlay">
                                        <Camera size={24} />
                                        <span>Change Photo</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            accept="image/*"
                            className="hidden-input"
                        />
                    </div>
                    <div className="hero-text">
                        <h1>{user?.name || 'User Profile'}</h1>
                        <p className="hero-role">{getRoleLabel(user?.role)}</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="alert alert-error">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="alert alert-success">
                    <CheckCircle2 size={20} />
                    <span>{success}</span>
                </div>
            )}

            <div className="profile-grid">
                {/* Profile Information Card */}
                <div className="profile-card info-card">
                    <div className="card-header">
                        <h2>Personal Information</h2>
                        {!isEditing ? (
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setIsEditing(true)}
                            >
                                Edit Information
                            </button>
                        ) : (
                            <span className="editing-badge">Editing...</span>
                        )}
                    </div>

                    <div className="card-body">
                        <form onSubmit={handleProfileSubmit} className="profile-form">
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label htmlFor="name">Full Name</label>
                                    <div className="input-with-icon">
                                        <User size={18} className="icon" />
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={profileData.name}
                                            onChange={handleProfileChange}
                                            disabled={!isEditing}
                                            required
                                            placeholder="Enter your full name"
                                            className="form-input has-icon"
                                        />
                                    </div>
                                </div>

                                <div className="form-group full-width">
                                    <label htmlFor="email">Email Address</label>
                                    <div className="input-with-icon">
                                        <Mail size={18} className="icon" />
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={profileData.email}
                                            onChange={handleProfileChange}
                                            disabled={!isEditing}
                                            required
                                            placeholder="Enter your email"
                                            className="form-input has-icon"
                                        />
                                    </div>
                                </div>

                                <div className="form-group half-width">
                                    <label>Role</label>
                                    <div className="input-with-icon readonly">
                                        <Briefcase size={18} className="icon" />
                                        <input
                                            type="text"
                                            value={getRoleLabel(user?.role)}
                                            readOnly
                                            className="form-input has-icon"
                                        />
                                    </div>
                                </div>

                                {user?.department && (
                                    <div className="form-group half-width">
                                        <label>Department</label>
                                        <div className="input-with-icon readonly">
                                            <Building2 size={18} className="icon" />
                                            <input
                                                type="text"
                                                value={user.department.name || user.department}
                                                readOnly
                                                className="form-input has-icon"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="form-group full-width">
                                    <label>Account Created / Last Login</label>
                                    <div className="input-with-icon readonly">
                                        <Calendar size={18} className="icon" />
                                        <input
                                            type="text"
                                            value={user?.lastLogin ? new Date(user.lastLogin).toLocaleString('en-IN', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : 'Recently joined'}
                                            readOnly
                                            className="form-input has-icon"
                                        />
                                    </div>
                                </div>
                            </div>

                            {isEditing && (
                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setProfileData({
                                                name: user.name || '',
                                                email: user.email || '',
                                            });
                                        }}
                                        disabled={loading}
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={loading}
                                    >
                                        {loading ? 'Saving Changes...' : 'Save Profile'}
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>

                {/* Password Change Card */}
                <div className="profile-card security-card">
                    <div className="card-header">
                        <h2>Account Security</h2>
                    </div>

                    <div className="card-body">
                        {!showPasswordForm ? (
                            <div className="security-intro">
                                <div className="security-icon-circle">
                                    <Lock size={32} />
                                </div>
                                <h3>Password Settings</h3>
                                <p>Manage your account password and security status.</p>
                                <button
                                    className="btn btn-outline-primary"
                                    onClick={() => setShowPasswordForm(true)}
                                >
                                    Update Password
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handlePasswordSubmit} className="password-form-upgraded">
                                <div className="form-group">
                                    <label htmlFor="currentPassword">Current Password</label>
                                    <div className="password-field">
                                        <input
                                            type={showPasswords.current ? 'text' : 'password'}
                                            id="currentPassword"
                                            name="currentPassword"
                                            value={passwordData.currentPassword}
                                            onChange={handlePasswordChange}
                                            required
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePasswordVisibility('current')}
                                            className="toggle-btn"
                                        >
                                            {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="newPassword">New Password</label>
                                    <div className="password-field">
                                        <input
                                            type={showPasswords.new ? 'text' : 'password'}
                                            id="newPassword"
                                            name="newPassword"
                                            value={passwordData.newPassword}
                                            onChange={handlePasswordChange}
                                            required
                                            minLength={6}
                                            placeholder="Min. 6 characters"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePasswordVisibility('new')}
                                            className="toggle-btn"
                                        >
                                            {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="confirmPassword">Confirm Password</label>
                                    <div className="password-field">
                                        <input
                                            type={showPasswords.confirm ? 'text' : 'password'}
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            value={passwordData.confirmPassword}
                                            onChange={handlePasswordChange}
                                            required
                                            placeholder="Confirm new password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePasswordVisibility('confirm')}
                                            className="toggle-btn"
                                        >
                                            {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="form-actions-security">
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => {
                                            setShowPasswordForm(false);
                                            setPasswordData({
                                                currentPassword: '',
                                                newPassword: '',
                                                confirmPassword: '',
                                            });
                                        }}
                                        disabled={loading}
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-sm"
                                        disabled={loading}
                                    >
                                        {loading ? 'Changing...' : 'Update Password'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
