import React, { useState, useEffect, useRef } from 'react';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendEmailVerification,
    GoogleAuthProvider,
    signInWithPopup,
    getAdditionalUserInfo,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { ref, set } from 'firebase/database';
import EmailVerification from './EmailVerification';
import { useTheme } from './ThemeContext';
import { useAppData } from '../App';
import Avatar from './common/Avatar';
import { XIcon } from './common/Icons';

// Icons for this component to keep changes minimal
const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.222 0-9.618-3.229-11.303-7.563l-6.623 5.305C9.042 39.558 15.999 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.574l6.19 5.238C42.021 35.596 44 30.134 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

const getFriendlyAuthError = (err: any): string => {
    const message = err.message || 'An unknown error occurred.';
    const code = err.code;

    switch (code) {
        case 'auth/invalid-email':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        default:
            return message.replace('Firebase: ', '').replace(/ \(.+\)\.$/, '.');
    }
};

// Input Field Component
interface InputFieldProps {
    label: string;
    type: string;
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isValid?: boolean;
}
const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(({ label, type, placeholder, value, onChange, isValid }, ref) => (
  <div className="w-full">
    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{label}</label>
    <div className="relative">
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required
        autoComplete={type === 'password' ? 'current-password' : type}
        className={`w-full bg-gray-100 dark:bg-[#1C1C1E] border-2 ${isValid ? 'border-primary' : 'border-gray-300 dark:border-gray-700/50'} rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-primary transition-colors`}
      />
      {isValid && value.length > 0 && <CheckIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />}
    </div>
  </div>
));

const RememberedAccounts: React.FC<{
    accounts: any[];
    onSelect: (email: string) => void;
    onRemove: (uid: string) => void;
    accountToSwitchTo?: string | null;
}> = ({ accounts, onSelect, onRemove, accountToSwitchTo }) => {
    if (accounts.length === 0) return null;

    useEffect(() => {
        if (accountToSwitchTo) {
            onSelect(accountToSwitchTo);
        }
    }, [accountToSwitchTo, onSelect]);

    return (
        <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Continue as...</h2>
            <ul className="space-y-3">
                {accounts.map(acc => {
                    const isSwitchTarget = acc.email === accountToSwitchTo;
                    return (
                        <li key={acc.uid} className={`flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all group ${isSwitchTarget ? 'bg-primary/10 ring-2 ring-primary' : ''}`}>
                            <button onClick={() => onSelect(acc.email)} className="flex items-center gap-3 text-left w-full">
                                <Avatar photoURL={acc.photoURL} displayName={acc.displayName} className="w-10 h-10" />
                                <div>
                                    <p className="font-semibold">{acc.displayName}</p>
                                    <p className="text-xs text-gray-500">{acc.email}</p>
                                </div>
                            </button>
                            <button onClick={() => onRemove(acc.uid)} className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <XIcon className="w-4 h-4 text-gray-500"/>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-black text-gray-500">OR</span>
              </div>
            </div>
        </div>
    );
};


const Auth: React.FC = () => {
  const [view, setView] = useState<'login' | 'signup' | 'forgotPassword'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [rememberedAccounts, setRememberedAccounts] = useState<any[]>([]);
  const [showRememberedList, setShowRememberedList] = useState(true);
  const [accountToSwitchTo, setAccountToSwitchTo] = useState<string | null>(null);
  const { color, colors } = useTheme();
  const { appData } = useAppData();
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const skip = sessionStorage.getItem('skipRememberedAccounts') === 'true';
    const switchTo = sessionStorage.getItem('switch_to_account');

    if (switchTo) {
        setAccountToSwitchTo(switchTo);
        sessionStorage.removeItem('switch_to_account');
    } else if (skip) {
        setShowRememberedList(false);
        sessionStorage.removeItem('skipRememberedAccounts');
    } else {
        setShowRememberedList(true);
    }
    
    const rememberedAccountsStr = localStorage.getItem('remembered_accounts');
    if (rememberedAccountsStr) {
        setRememberedAccounts(JSON.parse(rememberedAccountsStr));
    }
  }, []);

  const isLogin = view === 'login';
  
  const { hue, saturation, lightness } = colors[color];
  const buttonGradientStyle = {
      backgroundImage: `linear-gradient(to right, hsl(${hue}, ${saturation}%, ${lightness}%), hsl(${hue}, ${saturation}%, ${lightness - 15}%))`,
  };

  const handleEmailPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isLogin) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        setError(getFriendlyAuthError(err));
      }
    } else {
      if (!displayName.trim()) {
        setError("Name is required.");
        setLoading(false);
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await sendEmailVerification(user);

        await set(ref(db, 'users/' + user.uid), {
          uid: user.uid,
          displayName,
          email: user.email,
          photoURL: '',
          role: 'user',
        });

        setVerificationSent(true);
      } catch (err: any) {
        setError(getFriendlyAuthError(err));
      }
    }
    setLoading(false);
  };
  
  const handleSocialSignIn = async (provider: GoogleAuthProvider) => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, provider);
      const additionalUserInfo = getAdditionalUserInfo(result);

      if (additionalUserInfo?.isNewUser) {
        const user = result.user;
        await set(ref(db, 'users/' + user.uid), {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL || '',
          role: 'user',
        });
      }
    } catch (err: any) {
      setError(getFriendlyAuthError(err));
    }
    setLoading(false);
  };
  
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetStatus('idle');
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetStatus('sent');
    } catch (err: any) {
      setError(getFriendlyAuthError(err));
      setResetStatus('error');
    }
    setLoading(false);
  };

  const handleSelectRememberedAccount = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setView('login');
    setTimeout(() => {
        passwordInputRef.current?.focus();
    }, 100);
  };

  const handleRemoveRememberedAccount = (uidToRemove: string) => {
    const updatedAccounts = rememberedAccounts.filter(acc => acc.uid !== uidToRemove);
    setRememberedAccounts(updatedAccounts);
    localStorage.setItem('remembered_accounts', JSON.stringify(updatedAccounts));
  };
  
  if (verificationSent) {
    return <EmailVerification />;
  }
  
  const isNameValid = displayName.length > 1;
  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const isPasswordValid = password.length >= 6;
  const isResetEmailValid = /\S+@\S+\.\S+/.test(resetEmail);

  if (view === 'forgotPassword') {
    return (
        <div className="bg-white dark:bg-black text-gray-900 dark:text-white h-full w-full flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                 <div className="text-left mb-8">
                    <h1 className="text-3xl font-bold">Reset Password</h1>
                </div>
                 {resetStatus === 'sent' ? (
                    <div className="text-center">
                        <p className="text-gray-600 dark:text-gray-300">A password reset link has been sent to <span className="font-semibold text-primary">{resetEmail}</span>. Please check your inbox.</p>
                        <button onClick={() => { setView('login'); setResetStatus('idle'); setResetEmail(''); }} className="font-semibold text-primary mt-6">
                            ‹ Back to Log In
                        </button>
                    </div>
                ) : (
                    <>
                        <form className="space-y-4" onSubmit={handlePasswordReset}>
                            <InputField 
                                label="Email"
                                type="email"
                                placeholder="you@example.com"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                isValid={isResetEmailValid}
                            />
                            {error && <p className="text-sm text-center text-red-500 pt-2">{error}</p>}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading || !isResetEmailValid}
                                    style={buttonGradientStyle}
                                    className="w-full py-3 text-lg font-semibold text-white rounded-lg disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black focus:ring-primary"
                                >
                                    {loading ? '...' : 'Send Reset Link'}
                                </button>
                            </div>
                        </form>
                        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
                            <button onClick={() => setView('login')} className="font-semibold text-primary">
                                Back to Log In
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
  }

  return (
    <div className="bg-white dark:bg-black text-gray-900 dark:text-white h-full w-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        
        {showRememberedList && rememberedAccounts.length > 0 && view !== 'forgotPassword' && (
            <RememberedAccounts 
                accounts={rememberedAccounts}
                onSelect={handleSelectRememberedAccount}
                onRemove={handleRemoveRememberedAccount}
                accountToSwitchTo={accountToSwitchTo}
            />
        )}

        <div className="flex items-center mb-8">
            <h1 className="text-3xl font-bold">{isLogin ? 'Log In' : 'Sign Up'}</h1>
        </div>

        { appData?.features?.googleLogin?.enabled !== false && (
            <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{isLogin ? 'Log In With One Of The Following' : 'Sign Up With Any Of The Following'}</p>
                <div className="flex items-center mb-8">
                    <button 
                        onClick={() => handleSocialSignIn(new GoogleAuthProvider())} 
                        className="w-full flex items-center justify-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <GoogleIcon className="w-6 h-6" />
                        <span className="font-semibold text-gray-700 dark:text-gray-200">Continue with Google</span>
                    </button>
                </div>
            </>
        )}

        <form className="space-y-4" onSubmit={handleEmailPassSubmit}>
            {!isLogin && (
                <InputField 
                    label="Name"
                    type="text"
                    placeholder="Your Full Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    isValid={isNameValid}
                />
            )}
            <InputField 
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                isValid={isEmailValid}
            />
            <InputField 
                ref={passwordInputRef}
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                isValid={isPasswordValid}
            />

            {error && <p className="text-sm text-center text-red-500 pt-2">{error}</p>}

            <div className="pt-4">
                 <button
                    type="submit"
                    disabled={loading}
                    style={buttonGradientStyle}
                    className="w-full py-3 text-lg font-semibold text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black focus:ring-primary disabled:opacity-50 transition-all"
                >
                    {loading ? '...' : (isLogin ? 'Log In' : 'Create Account')}
                </button>
            </div>
        </form>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6 space-y-2">
            <p>
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <button
                    onClick={() => { setView(isLogin ? 'signup' : 'login'); setError(''); }}
                    className="font-semibold text-primary ml-2"
                >
                    {isLogin ? 'Create Account' : 'Log In'}
                </button>
            </p>
            {isLogin && (
                 <p>
                    <button onClick={() => setView('forgotPassword')} className="font-semibold text-primary">Forgot Password?</button>
                </p>
            )}
        </div>

      </div>
    </div>
  );
};

export default Auth;