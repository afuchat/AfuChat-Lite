const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

const blockList = config.resolver.blockList
  ? Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]
  : [];

config.resolver.blockList = [
  ...blockList,
  /node_modules\/.+_tmp_\d+.*/,
  /node_modules\/.pnpm\/graphql.+\/graphql_tmp_.*/,
  /node_modules\/.pnpm\/.+\/node_modules\/.+\/test\/.*/,
  /node_modules\/.pnpm\/.+\/node_modules\/.+\/tests\/.*/,
];

config.watchFolders = [workspaceRoot];

config.watcher = {
  additionalExts: ["mjs", "cjs"],
  watchman: {
    deferStates: ["hg.update"],
  },
  healthCheck: {
    enabled: false,
  },
};

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
