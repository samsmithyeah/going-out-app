// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  rules: {
    'react-hooks/exhaustive-deps': 'off',
    'react-native/no-unused-styles': 'error',
  },
  plugins: ['react-native'],
};
