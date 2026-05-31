import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ApiError } from '../src/api/client';
import { useAuthSession } from '../src/context/AuthSessionContext';
import { getApiBaseUrl } from '../src/lib/config';
import { colors, layout } from '../src/theme';

export default function LoginScreen() {
  const { signInWithCredentials } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apiConfigured = Boolean(getApiBaseUrl());

  const onSignIn = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password;
    if (!trimmedEmail || !trimmedPassword) {
      setError('Email and password are required.');
      return;
    }
    if (!apiConfigured) {
      setError('API base URL is not configured. Set EXPO_PUBLIC_API_BASE_URL to sign in.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithCredentials(trimmedEmail, trimmedPassword);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          setError('Invalid email or password.');
        } else if (e.status === 0) {
          setError(e.message);
        } else {
          setError(e.message || 'Sign in failed. Try again.');
        }
      } else {
        setError('Could not sign in. Check your connection and try again.');
      }
      setBusy(false);
    }
  };

  return (
    <View style={[layout.screen, layout.pad, { justifyContent: 'center' }]}>
      <Text style={layout.title}>Sign in</Text>
      <Text style={layout.subtitle}>
        Sign in with your Cooking Companion account. Dev seed: dev@example.com / password
      </Text>

      <Text style={layout.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
        placeholder="you@example.com"
        placeholderTextColor={colors.muted}
        editable={!busy}
        style={[layout.input, { marginBottom: 12 }]}
        accessibilityLabel="Email"
      />

      <Text style={layout.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="password"
        placeholder="Password"
        placeholderTextColor={colors.muted}
        editable={!busy}
        style={[layout.input, { marginBottom: 16 }]}
        accessibilityLabel="Password"
        onSubmitEditing={() => void onSignIn()}
      />

      {error ? (
        <Text style={{ color: colors.errorText, marginBottom: 12, fontWeight: '600' }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={() => void onSignIn()}
        disabled={busy}
        style={[layout.btn, { opacity: busy ? 0.7 : 1 }]}
        accessibilityLabel="Sign in"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={layout.btnText}>Sign in</Text>
        )}
      </Pressable>
    </View>
  );
}
