const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native': require.resolve('react-native'),
};

config.transformer.unstable_allowRequireContext = true;

config.watchFolders = [__dirname];

config.resolver.blockList = [
  /\.local\/.*/,
];

module.exports = withNativeWind(config, { input: './global.css' });
