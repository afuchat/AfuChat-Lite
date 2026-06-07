const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const blockList = config.resolver.blockList
  ? Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]
  : [];

config.resolver.blockList = [
  ...blockList,
  /node_modules\/.+_tmp_\d+.*/,
  /node_modules\/.pnpm\/graphql.+\/graphql_tmp_.*/,
];

module.exports = config;
