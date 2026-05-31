import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ApiError,
  appendSupportRef,
  createHousehold,
  joinHouseholdErrorMessage,
  joinHouseholdWithCode,
  isRetriableClientFailure,
} from '../src/api/client';
import { useHouseholdScope } from '../src/context/HouseholdScopeContext';
import { colors, layout } from '../src/theme';

export default function HouseholdScreen() {
  const {
    households,
    activeHouseholdId,
    activeLabel,
    householdsLoading,
    householdsError,
    householdsEndpointAvailable,
    setActiveHouseholdId,
    refreshHouseholds,
  } = useHouseholdScope();

  const [householdName, setHouseholdName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);

  const onCreate = async () => {
    setCreateBusy(true);
    try {
      const created = await createHousehold(householdName);
      await setActiveHouseholdId(created.id);
      setHouseholdName('');
      await refreshHouseholds();
      Alert.alert('Created', `You are now using “${created.name}”.`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Create failed';
      const hint = isRetriableClientFailure(e) ? ' Check your connection and try again.' : '';
      const isMissing = e instanceof ApiError && (e.status === 404 || e.status === 501);
      Alert.alert(
        isMissing ? 'Not available yet' : 'Could not create household',
        appendSupportRef(
          isMissing
            ? 'The server does not expose household creation yet. Try again after the backend household API is deployed.'
            : `${msg}${hint}`,
          e
        ),
        isRetriableClientFailure(e)
          ? [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: () => void onCreate() },
            ]
          : [{ text: 'OK', style: 'cancel' }]
      );
    } finally {
      setCreateBusy(false);
    }
  };

  const onCopyInviteCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', 'Invite code copied to clipboard.');
  };

  const onJoin = async () => {
    setJoinBusy(true);
    try {
      const joined = await joinHouseholdWithCode(inviteCode);
      await setActiveHouseholdId(joined.id);
      setInviteCode('');
      await refreshHouseholds();
      Alert.alert('Joined', `You are now using “${joined.name}”.`);
    } catch (e) {
      const msg = joinHouseholdErrorMessage(e);
      const hint = isRetriableClientFailure(e) ? ' Check your connection and try again.' : '';
      const isMissing = e instanceof ApiError && e.status === 501;
      Alert.alert(
        isMissing ? 'Not available yet' : 'Could not join',
        appendSupportRef(
          isMissing
            ? 'The server does not expose household invites yet. Try again after the backend household API is deployed.'
            : `${msg}${hint}`,
          e
        ),
        isRetriableClientFailure(e)
          ? [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: () => void onJoin() },
            ]
          : [{ text: 'OK', style: 'cancel' }]
      );
    } finally {
      setJoinBusy(false);
    }
  };

  return (
    <ScrollView
      style={layout.screen}
      contentContainerStyle={[layout.pad, { paddingBottom: 32 }]}
      refreshControl={
        <RefreshControl refreshing={householdsLoading} onRefresh={() => void refreshHouseholds()} />
      }
    >
      <Text style={layout.title}>Household</Text>
      <Text style={layout.subtitle}>
        Choose whether recipes load from your personal library or a shared household. Imports and fetches use the
        same scope.
      </Text>

      {householdsError ? (
        <View style={[layout.card, { backgroundColor: colors.errorBg, borderColor: colors.errorText }]}>
          <Text style={{ color: colors.errorText, fontWeight: '600' }}>{householdsError}</Text>
          <Pressable onPress={() => void refreshHouseholds()} style={{ marginTop: 10 }}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!householdsEndpointAvailable && !householdsLoading && !householdsError ? (
        <View style={[layout.card, { borderColor: colors.accentMuted }]}>
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 6 }}>Household API</Text>
          <Text style={{ color: colors.muted, lineHeight: 22 }}>
            This build is ready for multi-user libraries (`GET /api/v1/households`, `X-Household-Id` on recipe
            calls). Your server does not expose those routes yet — only Personal scope is active until the backend
            ships.
          </Text>
        </View>
      ) : null}

      <Text style={[layout.label, { marginTop: 8 }]}>Active scope</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.accent, marginBottom: 12 }}>
        {activeLabel}
      </Text>

      <Pressable
        onPress={() => void setActiveHouseholdId(null)}
        style={[
          layout.card,
          {
            borderColor: activeHouseholdId == null ? colors.accent : colors.border,
            borderWidth: activeHouseholdId == null ? 2 : 1,
          },
        ]}
      >
        <Text style={{ fontWeight: '700', color: colors.text }}>Personal</Text>
        <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>
          Only your account's recipes (default).
        </Text>
      </Pressable>

      {households.map((h) => {
        const selected = activeHouseholdId === h.id;
        return (
          <Pressable
            key={h.id}
            onPress={() => void setActiveHouseholdId(h.id)}
            style={[
              layout.card,
              {
                borderColor: selected ? colors.accent : colors.border,
                borderWidth: selected ? 2 : 1,
              },
            ]}
          >
            <Text style={{ fontWeight: '700', color: colors.text }}>{h.name}</Text>
            {h.membershipRole ? (
              <Text style={{ color: colors.muted, marginTop: 6 }}>Role: {h.membershipRole}</Text>
            ) : (
              <Text style={{ color: colors.muted, marginTop: 6 }}>Shared household library</Text>
            )}
            {h.membershipRole === 'owner' && h.inviteCode ? (
              <View style={[layout.rowBetween, { marginTop: 10 }]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={layout.label}>Invite code</Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: colors.text,
                      letterSpacing: 1,
                    }}
                    selectable
                  >
                    {h.inviteCode}
                  </Text>
                </View>
                <Pressable
                  onPress={(ev) => {
                    ev.stopPropagation?.();
                    void onCopyInviteCode(h.inviteCode!);
                  }}
                  style={[layout.btnSecondary, { paddingVertical: 10, paddingHorizontal: 14 }]}
                  accessibilityLabel={`Copy invite code ${h.inviteCode}`}
                >
                  <Text style={[layout.btnSecondaryText, { fontSize: 14 }]}>Copy</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        );
      })}

      {householdsEndpointAvailable && households.length === 0 && !householdsLoading ? (
        <View style={layout.card}>
          <Text style={{ color: colors.muted, lineHeight: 22 }}>
            You are not in any households yet. Create one below or ask an owner for an invite code.
          </Text>
        </View>
      ) : null}

      {householdsEndpointAvailable ? (
        <>
          <Text style={[layout.title, { fontSize: 20, marginTop: 20 }]}>Create household</Text>
          <Text style={[layout.subtitle, { marginBottom: 12 }]}>
            Start a shared library. You become the owner and can invite others with a code.
          </Text>
          <Text style={layout.label}>Household name</Text>
          <TextInput
            style={[layout.input, { marginBottom: 12 }]}
            placeholder="e.g. Test Kitchen"
            placeholderTextColor={colors.muted}
            value={householdName}
            onChangeText={setHouseholdName}
            autoCorrect={false}
            editable={!createBusy}
          />
          <Pressable
            style={[layout.btn, { opacity: createBusy ? 0.6 : 1, marginBottom: 8 }]}
            disabled={createBusy || !householdName.trim()}
            onPress={() => void onCreate()}
          >
            {createBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={layout.btnText}>Create household</Text>
            )}
          </Pressable>
        </>
      ) : null}

      <Text style={[layout.title, { fontSize: 20, marginTop: 20 }]}>Redeem invite</Text>
      <Text style={[layout.subtitle, { marginBottom: 12 }]}>
        {householdsEndpointAvailable
          ? 'Paste a code from your household owner.'
          : 'When the API supports it, paste a code from your household owner.'}
      </Text>
      <Text style={layout.label}>Invite code</Text>
      <TextInput
        style={[layout.input, { marginBottom: 12 }]}
        placeholder="e.g. ABC-123-XYZ"
        placeholderTextColor={colors.muted}
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!joinBusy}
      />
      <Pressable
        style={[layout.btn, { opacity: joinBusy ? 0.6 : 1 }]}
        disabled={joinBusy || !inviteCode.trim()}
        onPress={() => void onJoin()}
      >
        {joinBusy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={layout.btnText}>Join household</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
