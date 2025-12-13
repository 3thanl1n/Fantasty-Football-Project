import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './AuthCallback.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function AuthCallback({ onLogin }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const processCallback = async () => {
      const token = searchParams.get('token');
      const refresh = searchParams.get('refresh');
      const provider = searchParams.get('provider');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(`Authentication failed: ${errorParam}`);
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (token && refresh) {
        setStatus('Logging you in...');
        
        // Store tokens
        localStorage.setItem('accessToken', token);
        localStorage.setItem('refreshToken', refresh);
        
        try {
          // Fetch user info
          const res = await fetch(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await res.json();
          
          if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            setStatus(`Welcome, ${data.user.name}!`);
            onLogin(data.user);
            
            setTimeout(() => {
              navigate('/');
            }, 1500);
          } else {
            throw new Error(data.error || 'Failed to get user info');
          }
        } catch (err) {
          console.error('Auth callback error:', err);
          setError(err.message);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setTimeout(() => navigate('/'), 3000);
        }
      } else {
        setError('No authentication tokens received');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    processCallback();
  }, [searchParams, navigate, onLogin]);

  return (
    <div className="auth-callback">
      <div className="callback-card">
        {error ? (
          <>
            <div className="callback-icon error">✕</div>
            <h2>Authentication Failed</h2>
            <p>{error}</p>
            <p className="redirect-text">Redirecting to home...</p>
          </>
        ) : (
          <>
            <div className="callback-spinner"></div>
            <h2>{status}</h2>
            <p>Please wait while we complete the sign-in process.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthCallback;
