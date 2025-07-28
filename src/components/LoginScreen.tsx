import { GoogleLogin } from '@react-oauth/google';
import { useApp } from '../context/AppContext';
import { jwtDecode } from 'jwt-decode';

interface GoogleJWTPayload {
  sub: string;
  name: string;
  email: string;
  picture: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

const LoginScreen = () => {
  const { dispatch } = useApp();

  const handleSuccess = (credentialResponse: any) => {
    const id_token = credentialResponse.credential;
    if (!id_token) {
      console.error('No credential received from Google');
      return;
    }

    try {
      const decoded: GoogleJWTPayload = jwtDecode(id_token);

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          id: decoded.sub,
          name: decoded.name,
          email: decoded.email,
          picture: decoded.picture,
          id_token: id_token,
        },
      });

      console.log('Login successful for:', decoded.email);
    } catch (error) {
      console.error('Failed to decode JWT token:', error);
    }
  };

  const handleError = () => {
    console.error('Google Login Failed');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center">
          {/* App Logo/Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-100 mb-6">
            <svg className="h-8 w-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>

          {/* App Name */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Now and Later
          </h1>
          
          <p className="text-gray-600 mb-8">
            Your intelligent productivity companion
          </p>

          {/* Features List */}
          <div className="text-left mb-8 space-y-3">
            <div className="flex items-center text-sm text-gray-700">
              <svg className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Organize projects by Areas of Responsibility
            </div>
            <div className="flex items-center text-sm text-gray-700">
              <svg className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Automatic Google Drive integration
            </div>
            <div className="flex items-center text-sm text-gray-700">
              <svg className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Smart task management with contexts
            </div>
          </div>

          {/* Login Button */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={handleError}
              size="large"
              text="signin_with"
              shape="rectangular"
              theme="outline"
              width="280"
            />
          </div>

          <p className="text-xs text-gray-500 mt-6">
            Sign in with your Google account to get started.<br />
            Your data stays private and secure.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;