const String kBffUrl = String.fromEnvironment(
  'BFF_URL',
  defaultValue: 'http://localhost:3000',
);

const String kApiBaseUrl = '$kBffUrl/api/v1';
const String kAuthTokenKey = 'auth_token';
