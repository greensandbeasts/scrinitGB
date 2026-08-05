import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useTheme } from './theme';
import type { Profile, UserRole, SelectableRole, ThemePreference, UserRoleEntry } from './types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  userRoles: SelectableRole[];
  activeRole: SelectableRole | 'admin';
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, metadata: { display_name: string; role: SelectableRole; company?: string; bio?: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: (role: SelectableRole) => Promise<void>;
  enableRole: (role: SelectableRole) => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { syncFromProfile } = useTheme();
  const [state, setState] = useState<AuthState>({
    session: null,
    profile: null,
    userRoles: [],
    activeRole: 'writer',
    loading: true,
  });

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error loading profile:', error);
      return null;
    }
    return data as Profile | null;
  }, []);

  const loadUserRoles = useCallback(async (userId: string): Promise<UserRoleEntry[]> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId);
    if (error) {
      console.error('Error loading user roles:', error);
      return [];
    }
    return (data ?? []) as UserRoleEntry[];
  }, []);

  const initializeFromSession = useCallback(async (session: Session | null) => {
    if (session) {
      const [profile, roleEntries] = await Promise.all([
        loadProfile(session.user.id),
        loadUserRoles(session.user.id),
      ]);
      const roles = (roleEntries ?? []).map(r => r.role);
      const profileRole = profile?.role;
      const lastActive = profile?.last_active_role as SelectableRole | null;
      const activeRole: SelectableRole | 'admin' =
        profileRole === 'admin' ? 'admin' :
        lastActive && roles.includes(lastActive) ? lastActive :
        roles[0] ?? 'writer';

      if (profile?.preferred_theme) {
        syncFromProfile(profile.preferred_theme as ThemePreference);
      }

      setState({ session, profile, userRoles: roles, activeRole, loading: false });
    } else {
      setState({ session: null, profile: null, userRoles: [], activeRole: 'writer', loading: false });
    }
  }, [loadProfile, loadUserRoles, syncFromProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      (async () => {
        await initializeFromSession(session);
      })();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        await initializeFromSession(session);
      })();
    });

    return () => {
      mounted = false;
    };
  }, [initializeFromSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    metadata: { display_name: string; role: SelectableRole; company?: string; bio?: string },
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Sign up failed. Please try again.' };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ session: null, profile: null, userRoles: [], activeRole: 'writer', loading: false });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (state.session) {
      const [profile, roleEntries] = await Promise.all([
        loadProfile(state.session.user.id),
        loadUserRoles(state.session.user.id),
      ]);
      const roles = (roleEntries ?? []).map(r => r.role);
      setState((prev) => ({
        ...prev,
        profile,
        userRoles: roles,
        activeRole: prev.activeRole === 'admin' ? 'admin' : roles.includes(prev.activeRole as SelectableRole) ? prev.activeRole : roles[0] ?? 'writer',
      }));
    }
  }, [state.session, loadProfile, loadUserRoles]);

  const switchRole = useCallback(async (role: SelectableRole) => {
    if (!state.profile) return;
    setState((prev) => ({ ...prev, activeRole: role }));
    await supabase
      .from('profiles')
      .update({ last_active_role: role })
      .eq('id', state.profile.id);
  }, [state.profile]);

  const enableRole = useCallback(async (role: SelectableRole) => {
    if (!state.profile) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: state.profile.id, role });
    if (error) {
      if (error.code === '23505') return { error: null };
      return { error: error.message };
    }

    if (role === 'writer') {
      await supabase.from('writer_profiles').upsert({ user_id: state.profile.id });
    } else if (role === 'reader') {
      await supabase.from('reader_profiles').upsert({ user_id: state.profile.id });
    } else if (role === 'industry') {
      await supabase.from('industry_profiles').upsert({ user_id: state.profile.id, verification_status: 'unverified' });
    }

    await refreshProfile();
    return { error: null };
  }, [state.profile, refreshProfile]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!state.profile) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', state.profile.id);
    if (error) return { error: error.message };
    await refreshProfile();
    return { error: null };
  }, [state.profile, refreshProfile]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, refreshProfile, switchRole, enableRole, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
