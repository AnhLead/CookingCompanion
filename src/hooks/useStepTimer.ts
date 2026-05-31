import { useCallback, useEffect, useRef, useState } from 'react';

export type StepTimerStatus = 'idle' | 'running' | 'paused' | 'expired';

export interface UseStepTimerResult {
  remainingSec: number;
  status: StepTimerStatus;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  cancel: () => void;
}

export function useStepTimer(
  durationSec: number,
  stepKey: string,
  onExpire?: () => void
): UseStepTimerResult {
  const [remainingSec, setRemainingSec] = useState(durationSec);
  const [status, setStatus] = useState<StepTimerStatus>('idle');
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const cancel = useCallback(() => {
    setRemainingSec(durationSec);
    setStatus('idle');
  }, [durationSec]);

  const reset = useCallback(() => {
    setRemainingSec(durationSec);
    setStatus('idle');
  }, [durationSec]);

  const start = useCallback(() => {
    setStatus((s) => {
      if (s === 'expired') return s;
      return 'running';
    });
  }, []);

  const pause = useCallback(() => {
    setStatus((s) => (s === 'running' ? 'paused' : s));
  }, []);

  useEffect(() => {
    setRemainingSec(durationSec);
    setStatus('idle');
  }, [stepKey, durationSec]);

  useEffect(() => {
    if (status !== 'running') return;

    const id = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setStatus('expired');
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [status]);

  return {
    remainingSec,
    status,
    isRunning: status === 'running',
    start,
    pause,
    reset,
    cancel,
  };
}
