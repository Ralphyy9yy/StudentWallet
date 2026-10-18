# Dependency versions

Resolved direct versions from package-lock.json. Use `npm ci` to reproduce the dependency tree. Native packages were selected for Expo SDK 58; the lockfile fixes transitive versions as well.

| Package                                | Exact installed version | Group           |
| -------------------------------------- | ----------------------- | --------------- |
| @expo/vector-icons                     | 15.1.1                  | dependencies    |
| @react-native-community/datetimepicker | 9.2.1                   | dependencies    |
| expo                                   | 58.0.12                 | dependencies    |
| expo-constants                         | 58.0.12                 | dependencies    |
| expo-crypto                            | 58.0.6                  | dependencies    |
| expo-document-picker                   | 58.0.4                  | dependencies    |
| expo-file-system                       | 58.0.9                  | dependencies    |
| expo-font                              | 58.0.8                  | dependencies    |
| expo-linking                           | 58.0.13                 | dependencies    |
| expo-router                            | 58.0.21                 | dependencies    |
| expo-sharing                           | 58.0.18                 | dependencies    |
| expo-splash-screen                     | 58.0.9                  | dependencies    |
| expo-sqlite                            | 58.0.13                 | dependencies    |
| expo-status-bar                        | 58.0.3                  | dependencies    |
| expo-system-ui                         | 58.0.6                  | dependencies    |
| react                                  | 19.3.0                  | dependencies    |
| react-dom                              | 19.3.0                  | dependencies    |
| react-native                           | 0.88.0                  | dependencies    |
| react-native-gesture-handler           | 3.3.0                   | dependencies    |
| react-native-safe-area-context         | 5.10.1                  | dependencies    |
| react-native-screens                   | 4.30.0                  | dependencies    |
| react-native-web                       | 0.21.4                  | dependencies    |
| zod                                    | 4.6.7                   | dependencies    |
| @testing-library/react-native          | 14.1.0                  | devDependencies |
| @types/jest                            | 29.5.14                 | devDependencies |
| @types/react                           | 19.3.0                  | devDependencies |
| eslint                                 | 9.39.5                  | devDependencies |
| eslint-config-expo                     | 58.0.4                  | devDependencies |
| jest                                   | 29.7.0                  | devDependencies |
| jest-expo                              | 58.0.11                 | devDependencies |
| prettier                               | 3.9.10                  | devDependencies |
| react-test-renderer                    | 19.3.0                  | devDependencies |
| sharp                                  | 0.35.5                  | devDependencies |
| typescript                             | 6.0.3                   | devDependencies |

Jest 29 matches Expo's compatibility check. The SDK 58 jest-expo watch plugin currently advertises a Jest 30 peer; CI uses `--runInBand`, and the installed preset passes the tests.
