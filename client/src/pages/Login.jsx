import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Tooltip from '../components/Tooltip/Tooltip';
import { GraduationCap, AlertCircle, Eye, EyeOff } from 'lucide-react';
import './Login.scss';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, isAuthenticated, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await login(formData);
    if (result.success) {
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  return (
    <div className="login-wrapper">
      {/* LEFT SECTION */}
      <div className="login-left">
        <div className="illustration-container">
          <div className="illustration-mockup">
            <div className="building-icon-large">
              <GraduationCap size={120} color="#1a237e" />
            </div>
            <div className="floating-coin">$</div>
          </div>
        </div>

        <div className="brand-section">
          <div className="brand-logo">
            <GraduationCap size={40} color="#1a237e" />
            <h1>CBMS</h1>
          </div>
          <h2>Welcome back.</h2>
          <p>Secure financial management for institutions.</p>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="login-right">
        <div className="login-box">
          <div className="login-header">
            <h2>Sign In</h2>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-alert">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* 🔥 FLOATING EMAIL */}
            <div className="form-group floating">
              <input
                type="email"
                name="email"
                placeholder=" "
                value={formData.email}
                onChange={handleChange}
                required
              />
              <label>Institutional Email</label>
            </div>

            {/* 🔥 FLOATING PASSWORD */}
            <div className="form-group floating">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder=" "
                value={formData.password}
                onChange={handleChange}
                required
              />
              <label>Password</label>

              <Tooltip
                text={showPassword ? 'Hide Password' : 'Show Password'}
                position="top"
                className="password-toggle-tooltip"
              >
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </Tooltip>
            </div>

            <button type="submit" className="signin-btn" disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="support-link">
            <a href="#">Contact Admin for support</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
