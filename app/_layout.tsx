import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AuthSessionProvider, useAuthSession } from '../src/context/AuthSessionContext';
import { HouseholdScopeProvider } from '../src/context/HouseholdScopeContext';
import { assertReleaseApiConfig } from '../src/lib/config';
import { colors } from '../src/theme';

function ReleaseConfigGuard() {
  useEffect(() => {
    assertReleaseApiConfig();
  }, []);
  return null;
}

function SignOutHeaderButton() {
  const { signOut } = useAuthSession();
  return (
    <Pressable onPress={() => void signOut()} hitSlop={8} accessibilityLabel="Sign out">
      <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 15 }}>Sign out</Text>
    </Pressable>
  );
}

function AuthNavigationGuard() {
  const { isAuthenticated, loading } = useAuthSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onLoginRoute = segments[0] === 'login';
    if (!isAuthenticated && !onLoginRoute) {
      router.replace('/login');
    } else if (isAuthenticated && onLoginRoute) {
      router.replace('/');
    }
  }, [isAuthenticated, loading, segments, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Library',
          headerRight: () => <SignOutHeaderButton />,
        }}
      />
      <Stack.Screen name="household" options={{ title: 'Household' }} />
      <Stack.Screen name="dish/[dishId]" options={{ title: 'Dish' }} />
      <Stack.Screen name="variant/[variantId]" options={{ title: 'Variant' }} />
      <Stack.Screen name="cook/[variantId]" options={{ title: 'Cook' }} />
      <Stack.Screen name="import/index" options={{ title: 'Import' }} />
      <Stack.Screen name="login" options={{ title: 'Sign in', headerShown: true }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthSessionProvider>
      <HouseholdScopeProvider>
        <ReleaseConfigGuard />
        <AuthNavigationGuard />
      </HouseholdScopeProvider>
    </AuthSessionProvider>
  );
}
