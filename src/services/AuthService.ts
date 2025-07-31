import type { UserProfile } from '../types';

export class AuthService {
  private onAuthError?: () => void;
  private onTokenRefresh?: (newProfile: any) => void;

  constructor() {
    console.log('🔐 AuthService initialized');
  }

  // Set callback for auth errors (to trigger logout)
  setAuthErrorCallback(callback: () => void) {
    this.onAuthError = callback;
  }

  // Set callback for token refresh (to be used by context)
  setTokenRefreshCallback(callback: (newProfile: any) => void) {
    this.onTokenRefresh = callback;
  }

  // Handle 401 unauthorized errors
  async handleAuthError(context: string): Promise<boolean> {
    console.error(`🔐 Authentication failed in ${context} - token likely expired`);
    
    // Check if we have a refresh token before trying to refresh
    const userProfile = JSON.parse(localStorage.getItem('google-auth-state') || '{}');
    if (!userProfile.refresh_token) {
      console.log('🔐AUTH No refresh token available, triggering immediate logout');
      
      // Clear auth state and trigger logout immediately
      localStorage.removeItem('google-auth-state');
      
      if (this.onAuthError) {
        this.onAuthError();
      } else {
        console.warn('⚠️ No auth error callback set - forcing page reload');
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
      
      return false; // No retry
    }
    
    console.log('🔄 Attempting automatic token refresh...');
    
    // Try to refresh the token before logging out
    const refreshResult = await this.attemptTokenRefresh();
    
    if (refreshResult.success) {
      console.log('✅ Token refresh successful, retrying original request');
      return true; // Indicate that the request should be retried
    }
    
    console.log('🚪 Token refresh failed, triggering logout');
    
    // Show user-friendly notification
    if (typeof window !== 'undefined') {
      // Create a temporary notification element
      const notification = document.createElement('div');
      notification.innerHTML = '🔐 Session expired - please sign in again';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fee2e2;
        color: #dc2626;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid #fecaca;
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      `;
      
      document.body.appendChild(notification);
      
      // Remove notification after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 5000);
    }
    
    if (this.onAuthError) {
      this.onAuthError();
    } else {
      console.warn('⚠️ No auth error callback set - cannot trigger automatic logout');
    }

    return false; // No retry
  }

  // Attempt to refresh the access token
  async attemptTokenRefresh(): Promise<{ success: boolean; newToken?: string }> {
    try {
      // Get current user profile from local storage (using correct key)
      const userProfile = JSON.parse(localStorage.getItem('google-auth-state') || '{}');
      
      console.log('🔐AUTH Token refresh debug:', {
        hasRefreshToken: !!userProfile.refresh_token,
        hasAccessToken: !!userProfile.access_token,
        userEmail: userProfile.email,
        refreshTokenLength: userProfile.refresh_token?.length || 0
      });
      
      if (!userProfile.refresh_token) {
        console.error('🔐AUTH No refresh token available in localStorage');
        console.error('🔐AUTH Available keys in userProfile:', Object.keys(userProfile));
        
        // Immediately trigger logout without showing alert (to prevent loops)
        if (typeof window !== 'undefined') {
          localStorage.removeItem('google-auth-state');
          // Trigger immediate logout without alert to prevent loops
          if (this.onAuthError) {
            this.onAuthError();
          } else {
            // Force reload as last resort
            window.location.reload();
          }
        }
        
        return { success: false };
      }

      console.log('🔐AUTH Calling token refresh API with refresh token length:', userProfile.refresh_token.length);
      console.log('🔐AUTH Refresh token preview:', userProfile.refresh_token.substring(0, 15) + '...');
      console.log('🔐AUTH Sending POST to /api/auth/manage?action=refresh');
      
      const response = await fetch('/api/auth/manage?action=refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: userProfile.refresh_token
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔐AUTH Token refresh API failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return { success: false };
      }

      const result = await response.json();
      console.log('🔐AUTH Token refresh API response:', {
        success: result.success,
        hasAccessToken: !!result.tokens?.access_token,
        hasRefreshToken: !!result.tokens?.refresh_token,
        error: result.error
      });
      
      if (result.success && result.tokens?.access_token) {
        console.log('🔐AUTH New access token received, updating localStorage and context');
        
        // Update the stored user profile with new tokens
        const updatedProfile = {
          ...userProfile,
          access_token: result.tokens.access_token,
          expires_in: result.tokens.expires_in || 3600,
          token_type: result.tokens.token_type,
          tokenIssuedAt: Date.now(), // Track when new token was issued
          // Keep existing refresh token or use new one if provided
          refresh_token: result.tokens.refresh_token || userProfile.refresh_token
        };
        
        localStorage.setItem('google-auth-state', JSON.stringify(updatedProfile));
        console.log('💾 Updated localStorage with new tokens');
        
        // Trigger context update if available
        if (this.onTokenRefresh) {
          console.log('🔄 Triggering context update with new profile');
          this.onTokenRefresh(updatedProfile);
        } else {
          console.warn('⚠️ No token refresh callback available');
        }
        
        return { success: true, newToken: result.tokens.access_token };
      } else {
        console.error('❌ Token refresh response invalid:', result);
        return { success: false };
      }
      
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return { success: false };
    }
  }

  // Check if access token is expired (client-side check)
  isTokenExpired(token: string): boolean {
    try {
      // For JWT tokens, decode and check expiry
      if (token.startsWith('eyJ')) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const now = Math.floor(Date.now() / 1000);
          const isExpired = payload.exp && payload.exp < now;
          console.log('🔍 JWT token check:', {
            exp: payload.exp,
            now,
            isExpired,
            expiresInMinutes: payload.exp ? Math.round((payload.exp - now) / 60) : 'unknown'
          });
          return isExpired;
        }
      }
      
      // For access tokens, check if they're old based on issuedAt
      const userProfile = JSON.parse(localStorage.getItem('google-auth-state') || '{}');
      if (userProfile.tokenIssuedAt && userProfile.expires_in) {
        const issuedAt = userProfile.tokenIssuedAt;
        const expiresIn = userProfile.expires_in * 1000; // Convert to milliseconds
        const now = Date.now();
        const isExpired = (now - issuedAt) >= expiresIn;
        
        console.log('🔍 Access token check:', {
          issuedAt: new Date(issuedAt).toISOString(),
          expiresIn: expiresIn / 1000 / 60 + ' minutes',
          now: new Date(now).toISOString(),
          ageMinutes: Math.round((now - issuedAt) / 1000 / 60),
          isExpired
        });
        
        return isExpired;
      }
      
      return false; // Assume token is valid if we can't check
    } catch (error) {
      console.warn('🔍 Error checking token expiry:', error);
      return false; // Assume token is valid if we can't check
    }
  }

  // Get current user profile from localStorage
  getCurrentUserProfile(): UserProfile | null {
    try {
      const authState = localStorage.getItem('google-auth-state');
      return authState ? JSON.parse(authState) : null;
    } catch (error) {
      console.error('Failed to get user profile from localStorage:', error);
      return null;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const profile = this.getCurrentUserProfile();
    return !!(profile && (profile.access_token || profile.id_token));
  }

  // Get current access token
  getAccessToken(): string | null {
    const profile = this.getCurrentUserProfile();
    return profile?.access_token || profile?.id_token || null;
  }

  // Clear authentication state (logout)
  clearAuthState(): void {
    console.log('🚪 Clearing authentication state');
    localStorage.removeItem('google-auth-state');
  }
}

// Export singleton instance
export const authService = new AuthService();