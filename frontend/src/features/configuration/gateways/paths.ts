const ROOT = "/configuration/gateways";

export const gatewaysPaths = {
  root: ROOT,
  apiConfiguration: `${ROOT}/api-configuration`,
  attendanceDevices: `${ROOT}/attendance-devices`,
} as const;
