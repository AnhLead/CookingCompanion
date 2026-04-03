import { Stack } from 'expo-router';
import { HouseholdScopeProvider } from '../src/context/HouseholdScopeContext';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <HouseholdScopeProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Library' }} />
        <Stack.Screen name="household" options={{ title: 'Household' }} />
        <Stack.Screen name="dish/[dishId]" options={{ title: 'Dish' }} />
        <Stack.Screen name="variant/[variantId]" options={{ title: 'Variant' }} />
        <Stack.Screen name="cook/[variantId]" options={{ title: 'Cook' }} />
        <Stack.Screen name="import/index" options={{ title: 'Import' }} />
      </Stack>
    </HouseholdScopeProvider>
  );
}
