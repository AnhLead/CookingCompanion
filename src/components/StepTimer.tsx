import { useCallback, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import * as KeepAwake from 'expo-keep-awake';
import { Alert, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useStepTimer } from '../hooks/useStepTimer';
import { formatDuration } from '../lib/formatDuration';
import { colors, layout } from '../theme';

const KEEP_AWAKE_TIMER_TAG = 'cook-step-timer';
const TIMER_CONTROL_MIN_HEIGHT = 44;

type Props = {
  durationSec: number;
  stepKey: string;
};

export function StepTimer({ durationSec, stepKey }: Props) {
  const onExpire = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert('Timer finished', 'This step timer is done. Continue when ready.');
  }, []);

  const { remainingSec, status, isRunning, start, pause, reset, cancel } = useStepTimer(
    durationSec,
    stepKey,
    onExpire
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        cancel();
        void KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TIMER_TAG);
      };
    }, [cancel])
  );

  useEffect(() => {
    if (isRunning) {
      void KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TIMER_TAG);
    } else {
      void KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TIMER_TAG);
    }
    return () => {
      void KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TIMER_TAG);
    };
  }, [isRunning]);

  const canStart = status === 'idle' || status === 'paused';
  const canPause = status === 'running';
  const isExpired = status === 'expired';

  const statusLabel =
    status === 'running'
      ? 'Timer running'
      : status === 'paused'
        ? 'Timer paused'
        : status === 'expired'
          ? 'Timer finished'
          : 'Timer ready';

  return (
    <View
      style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}
      accessible
      accessibilityLabel={`Step timer, ${formatDuration(remainingSec)} remaining. ${statusLabel}.`}
    >
      <Text
        style={{ fontSize: 32, fontWeight: '700', color: colors.accent, fontVariant: ['tabular-nums'] }}
        accessible={false}
      >
        {formatDuration(remainingSec)}
      </Text>
      {isExpired ? (
        <Text style={{ color: colors.accent, marginTop: 8, fontWeight: '600' }} accessible={false}>
          Time&apos;s up!
        </Text>
      ) : (
        <Text style={{ color: colors.muted, marginTop: 4, fontSize: 14 }} accessible={false}>
          {Math.round(durationSec / 60)} min step timer
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {canStart ? (
          <Pressable
            style={({ pressed }) => [
              layout.btn,
              { flex: 1, minHeight: TIMER_CONTROL_MIN_HEIGHT, justifyContent: 'center', opacity: pressed ? 0.92 : 1 },
            ]}
            onPress={start}
            accessibilityRole="button"
            accessibilityLabel={status === 'paused' ? 'Resume step timer' : 'Start step timer'}
          >
            <Text style={layout.btnText}>{status === 'paused' ? 'Resume' : 'Start'}</Text>
          </Pressable>
        ) : null}
        {canPause ? (
          <Pressable
            style={({ pressed }) => [
              layout.btn,
              layout.btnSecondary,
              { flex: 1, minHeight: TIMER_CONTROL_MIN_HEIGHT, justifyContent: 'center', opacity: pressed ? 0.92 : 1 },
            ]}
            onPress={pause}
            accessibilityRole="button"
            accessibilityLabel="Pause step timer"
          >
            <Text style={layout.btnSecondaryText}>Pause</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            layout.btn,
            layout.btnSecondary,
            {
              flex: 1,
              minHeight: TIMER_CONTROL_MIN_HEIGHT,
              justifyContent: 'center',
              opacity: pressed ? 0.92 : 1,
            },
          ]}
          onPress={reset}
          accessibilityRole="button"
          accessibilityLabel="Reset step timer"
        >
          <Text style={layout.btnSecondaryText}>Reset</Text>
        </Pressable>
      </View>
    </View>
  );
}
