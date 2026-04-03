/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiBase: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  },
});
