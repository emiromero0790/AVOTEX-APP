/**
 * Quita el entitlement de push (aps-environment) en iOS.
 * expo-notifications lo agrega automáticamente, pero el provisioning profile
 * actual no tiene la capacidad Push Notifications. Eliminar este plugin de
 * app.json cuando se active Push en Apple y se regenere el profile.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutIosPush(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
