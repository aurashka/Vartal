import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from './services/firebase';
import { ref, onValue, off, update, onDisconnect, serverTimestamp } from 'firebase/database';
import Auth from './components/Auth';
import ChatLayout from './components/ChatLayout';
import Onboarding from './components/Onboarding';
import EmailVerification from './components/EmailVerification';
import ProfileCompletion from './components/ProfileCompletion';
import { AppUser, AppData } from './types';
import { ThemeProvider } from './components/ThemeContext';
import { ChatLayoutSkeleton } from './components/common/Shimmer';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
  following: { [uid: string]: true } | null;
}

const AuthContext = createContext<AuthContextType>({ currentUser: null, appUser: null, loading: true, following: null });
export const useAuth = () => useContext(AuthContext);

// App-wide data context
interface AppContextType {
  appData: AppData | null;
  loadingAppData: boolean;
}
const AppContext = createContext<AppContextType>({ appData: null, loadingAppData: true });
export const useAppData = () => useContext(AppContext);


type UserState = 'loading' | 'onboarding' | 'auth' | 'verifyEmail' | 'completeProfile' | 'chat';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [following, setFollowing] = useState<{ [uid: string]: true } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [userState, setUserState] = useState<UserState>('loading');
  const [appData, setAppData] = useState<AppData | null>(null);
  const [loadingAppData, setLoadingAppData] = useState(true);
  
  useEffect(() => {
    // Check for onboarding completion first
    const onboardingCompleted = localStorage.getItem('onboardingCompleted') === 'true';
    if (!onboardingCompleted) {
      setUserState('onboarding');
      setInitialLoading(false);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await user.reload(); // Get latest user status
        setCurrentUser(user);
        if (!user.emailVerified) {
          setUserState('verifyEmail');
          setInitialLoading(false);
        } else {
           // User is authenticated and email is verified, now check for profile data
           // The appUser listener below will handle moving to 'completeProfile' or 'chat'
        }
      } else {
        setCurrentUser(null);
        setAppUser(null);
        setFollowing(null);
        if (onboardingCompleted) {
          setUserState('auth');
        }
        setInitialLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Listener for app-wide data (name, logo, etc.)
  useEffect(() => {
    const appDataRef = ref(db, 'appData');
    const listener = onValue(appDataRef, (snapshot) => {
      if (snapshot.exists()) {
        setAppData(snapshot.val());
      } else {
        // Set default data if it doesn't exist in Firebase yet
        setAppData({ name: "Chat App", logoUrl: "/vite.svg" });
      }
      setLoadingAppData(false);
    });

    return () => off(appDataRef, 'value', listener);
  }, []);

  // Presence system
  useEffect(() => {
    if (currentUser) {
      const userStatusRef = ref(db, `users/${currentUser.uid}`);

      onValue(ref(db, '.info/connected'), (snapshot) => {
        if (snapshot.val() === true) {
          onDisconnect(userStatusRef).update({ status: 'offline', lastSeen: serverTimestamp() });
          update(userStatusRef, { status: 'online' });
        }
      });
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && currentUser.emailVerified) {
      const userRef = ref(db, `users/${currentUser.uid}`);
      const followingRef = ref(db, `following/${currentUser.uid}`);

      const userListener = onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.val();
          setAppUser(userData);
          if (userData.handle) {
            setUserState('chat');
          } else {
            setUserState('completeProfile');
          }
        } else {
           // This case might happen if DB entry creation fails after signup
           setUserState('completeProfile');
        }
        setInitialLoading(false);
      });

      const followingListener = onValue(followingRef, (snapshot) => {
        setFollowing(snapshot.val());
      });

      return () => {
        off(userRef, 'value', userListener);
        off(followingRef, 'value', followingListener);
      };
    }
  }, [currentUser, currentUser?.emailVerified]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    setUserState('auth');
  };

  const renderContent = () => {
     if (initialLoading) {
        return <ChatLayoutSkeleton />;
    }

    switch (userState) {
        case 'onboarding':
            return <Onboarding onFinish={handleOnboardingComplete} />;
        case 'auth':
            return <Auth />;
        case 'verifyEmail':
            return <EmailVerification />;
        case 'completeProfile':
            return <ProfileCompletion />;
        case 'chat':
            return <ChatLayout />;
        default:
            return <Auth />;
    }
  }

  return (
    <ThemeProvider>
      <AuthContext.Provider value={{ currentUser, appUser, loading: initialLoading, following }}>
        <AppContext.Provider value={{ appData, loadingAppData }}>
          <div className="h-screen w-screen font-sans">
            {renderContent()}
          </div>
        </AppContext.Provider>
      </AuthContext.Provider>
    </ThemeProvider>
  );
};

export default App;