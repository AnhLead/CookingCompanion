import { Platform, StyleSheet } from 'react-native';

export const colors = {
  bg: '#faf7f2',
  card: '#ffffff',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#c2410c',
  accentMuted: '#ea580c',
  border: '#e7e5e4',
  errorBg: '#fef2f2',
  errorText: '#b91c1c',
};

export const layout = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
  },
  pad: { paddingHorizontal: 20, paddingVertical: 16 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  btnSecondaryText: { color: colors.accent, fontWeight: '600', fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
    minHeight: 48,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 },
});
