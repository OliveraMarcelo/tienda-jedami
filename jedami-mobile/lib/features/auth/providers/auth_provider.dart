import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import '../../../core/constants.dart';

class AuthState {
  final String? token;
  final bool isAuthenticated;

  const AuthState({this.token, this.isAuthenticated = false});

  AuthState copyWith({String? token, bool? isAuthenticated}) {
    return AuthState(
      token: token ?? this.token,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final Dio _dio;
  final SharedPreferences _prefs;

  AuthNotifier(this._dio, this._prefs) : super(const AuthState()) {
    _restoreToken();
  }

  void _restoreToken() {
    final token = _prefs.getString(kAuthTokenKey);
    if (token != null) {
      state = AuthState(token: token, isAuthenticated: true);
    }
  }

  Future<void> login(String email, String password) async {
    final response = await _dio.post(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    final token = response.data['data']['token'] as String;
    await _prefs.setString(kAuthTokenKey, token);
    state = AuthState(token: token, isAuthenticated: true);
  }

  Future<void> logout() async {
    await _prefs.remove(kAuthTokenKey);
    state = const AuthState();
  }
}

// Provider override en main.dart — placeholder para facilitar el override
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  throw UnimplementedError('authProvider must be overridden in main.dart');
});
