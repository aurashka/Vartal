import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';

const EmailVerification: React.FC = () => {
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    // Periodically check if the user's email has been verified
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          clearInterval(interval);
          // The onAuthStateChanged listener in App.tsx will handle the redirect
        }
      } else {
        clearInterval(interval);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const handleResendEmail = async () => {
    if (!auth.currentUser) {
      setError('No user is signed in.');
      return;
    }
    setResendStatus('sending');
    setError('');
    try {
      await sendEmailVerification(auth.currentUser);
      setResendStatus('sent');
      setTimeout(() => setResendStatus('idle'), 5000); // Reset button after 5s
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', ''));
      setResendStatus('error');
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  }

  return (
    <div className="bg-black text-white h-full w-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-8 space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Verify Your Email</h1>
        <p className="text-gray-400">
          A verification link has been sent to <span className="font-semibold text-[#D900F5]">{auth.currentUser?.email}</span>. Please check your inbox (and spam folder) to continue.
        </p>
        <p className="text-sm text-gray-500">
            This page will automatically update once you've verified your email.
        </p>
        
        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="pt-4">
            <button
              onClick={handleResendEmail}
              disabled={resendStatus === 'sending' || resendStatus === 'sent'}
              className="w-full py-3 text-lg font-semibold text-white bg-gradient-to-r from-[#D900F5] to-[#7100F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-[#D900F5] disabled:opacity-50 transition-all"
            >
              {resendStatus === 'sending' && 'Sending...'}
              {resendStatus === 'sent' && 'Sent! Check your inbox.'}
              {(resendStatus === 'idle' || resendStatus === 'error') && 'Resend Verification Email'}
            </button>
        </div>

        <button 
            onClick={handleSignOut} 
            className="font-semibold text-white text-sm"
        >
          Use a different account
        </button>
      </div>
    </div>
  );
};

export default EmailVerification;
