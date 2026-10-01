'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthMode = 'sign-in' | 'sign-up';

export default function ProfileAccount() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthday, setBirthday] = useState('');
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setBirthday(typeof user?.user_metadata.birthday === 'string' ? user.user_metadata.birthday : '');
  }, [user]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setIsBusy(true);
    setMessage('');

    const result = mode === 'sign-up'
      ? await supabase.auth.signUp({ email, password, options: { data: { birthday: birthday || null } } })
      : await supabase.auth.signInWithPassword({ email, password });

    setIsBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === 'sign-up' && !result.data.session) {
      setMessage('Check your email to confirm your account, then sign in.');
    } else {
      setMessage('You’re signed in. Your profile photo will be saved to your account.');
      setPassword('');
    }
  }

  async function saveBirthday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    setIsBusy(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ data: { birthday: birthday || null } });
    setIsBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    setMessage('Birthday saved to your account.');
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !supabase || !user) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Choose an image smaller than 5 MB.');
      return;
    }

    setIsBusy(true);
    setMessage('');
    const path = `${user.id}/avatar`;
    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });

    if (uploadError) {
      setIsBusy(false);
      setMessage(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
    const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
    setIsBusy(false);
    setMessage(updateError ? updateError.message : 'Profile photo saved to your account.');
    if (!updateError) {
      const { data: refreshed } = await supabase.auth.getUser();
      setUser(refreshed.user);
    }
  }

  async function removePhoto() {
    if (!supabase || !user) return;
    setIsBusy(true);
    setMessage('');
    const { error: removeError } = await supabase.storage.from('profile-photos').remove([`${user.id}/avatar`]);
    if (removeError) {
      setIsBusy(false);
      setMessage(removeError.message);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: null } });
    setIsBusy(false);
    setMessage(updateError ? updateError.message : 'Profile photo removed.');
    if (!updateError) {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    setMessage(error ? error.message : 'You’ve been signed out.');
  }

  const avatarUrl = typeof user?.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : null;

  return <>
    <button className="profile-trigger" type="button" onClick={() => { setIsOpen(true); setMessage(''); }} aria-label={user ? 'Open your account profile' : 'Sign in or create an account'} title="Account profile">
      <img className="brand-logo" src={avatarUrl ?? '/StyleUpLogo.png'} alt={avatarUrl ? 'Your profile photo' : 'StyleUp account'} />
      <span className="profile-trigger-indicator" aria-hidden="true">⌄</span>
    </button>

    {isOpen && <div className="account-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}>
      <section className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className="account-close" type="button" onClick={() => setIsOpen(false)} aria-label="Close account panel">×</button>
        <div className="account-avatar-wrap">
          <img className="account-avatar" src={avatarUrl ?? '/StyleUpLogo.png'} alt={avatarUrl ? 'Your profile photo' : 'StyleUp'} />
        </div>
        <h2 id="account-title">{user ? 'Your account' : 'Your StyleUp account'}</h2>
        {user ? <>
          <p className="account-email">{user.email}</p>
          <form className="account-form account-birthday-form" onSubmit={saveBirthday}>
            <label>Birthday<input type="date" autoComplete="bday" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setBirthday(event.target.value)} /></label>
            <button className="account-action" type="submit" disabled={isBusy}>{isBusy ? 'SAVING…' : 'SAVE BIRTHDAY'}</button>
          </form>
          <input ref={photoInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} />
          <button className="account-action" type="button" onClick={() => photoInput.current?.click()} disabled={isBusy}>{isBusy ? 'SAVING…' : avatarUrl ? 'CHANGE PROFILE PHOTO' : 'ADD PROFILE PHOTO'}</button>
          {avatarUrl && <button className="account-text-action" type="button" onClick={removePhoto} disabled={isBusy}>Remove photo</button>}
          <button className="account-text-action" type="button" onClick={signOut} disabled={isBusy}>Sign out</button>
        </> : supabase ? <>
          <p className="account-description">Sign in to save a profile photo to your account and use it on other devices.</p>
          <form className="account-form" onSubmit={submitAuth}>
            <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {mode === 'sign-up' && <label>Birthday (optional)<input type="date" autoComplete="bday" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setBirthday(event.target.value)} /></label>}
            <button className="account-action" type="submit" disabled={isBusy}>{isBusy ? 'PLEASE WAIT…' : mode === 'sign-in' ? 'SIGN IN' : 'CREATE ACCOUNT'}</button>
          </form>
          <button className="account-text-action" type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage(''); }}>{mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>
        </> : <p className="account-description">Account photos need Supabase configuration. Add the project URL and public anon key to your local environment, then restart the app.</p>}
        {message && <p className="account-message" role="status">{message}</p>}
      </section>
    </div>}
  </>;
}
