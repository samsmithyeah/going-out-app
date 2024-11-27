const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(process.cwd());

module.exports = config;
