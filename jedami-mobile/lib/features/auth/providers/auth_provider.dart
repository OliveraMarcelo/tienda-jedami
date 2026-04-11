import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import '../../../core/constants.dart';

const _kRefreshTokenKey = 'refresh_token';

class AuthState {
  final String? token;
  final bool isAuthenticated;

  const AuthState({this.token, this.isAuthenticated = false});

  // Sentinel para permitir limpiar token a null explícitamente con copyWith
  static const _undefined = Object();

  AuthState copyWith({Object? token = _undefined, bool? isAuthenticated}) {
    return AuthState(
      token: identical(token, _undefined) ? this.token : token as String?,
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
    if (token == null) return;

    // Validar expiración Y rol admin del JWT antes de restaurar la sesión
    try {
      final parts = token.split('.');
      if (parts.length != 3) {
        _prefs.remove(kAuthTokenKey);
        _prefs.remove(_kRefreshTokenKey);
        return;
      }
      final normalized = base64Url.normalize(parts[1]);
      final payload = jsonDecode(utf8.decode(base64Url.decode(normalized))) as Map<String, dynamic>;
      final exp = payload['exp'] as int?;
      if (exp == null ||
          DateTime.fromMillisecondsSinceEpoch(exp * 1000).isBefore(DateTime.now())) {
        _prefs.remove(kAuthTokenKey);
        _prefs.remove(_kRefreshTokenKey);
        return;
      }
      final roles = (payload['roles'] as List<dynamic>?)?.cast<String>() ?? [];
      if (!roles.contains('admin')) {
        _prefs.remove(kAuthTokenKey);
        _prefs.remove(_kRefreshTokenKey);
        return;
      }
    } catch (_) {
      _prefs.remove(kAuthTokenKey);
      return;
    }

    state = AuthState(token: token, isAuthenticated: true);
  }

  Future<void> login(String email, String password) async {
    final response = await _dio.post(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    final data = response.data?['data'] as Map<String, dynamic>?;
    final token = data?['token'] as String?;
    if (token == null) throw Exception('Respuesta del servidor inválida');
    final refreshToken = data?['refreshToken'] as String?;

    await _prefs.setString(kAuthTokenKey, token);
    if (refreshToken != null) await _prefs.setString(_kRefreshTokenKey, refreshToken);

    // Validar que el usuario tenga rol admin antes de confirmar la sesión
    try {
      final parts = token.split('.');
      if (parts.length == 3) {
        final normalized = base64Url.normalize(parts[1]);
        final payload = jsonDecode(
          utf8.decode(base64Url.decode(normalized)),
        ) as Map<String, dynamic>;
        final roles = (payload['roles'] as List<dynamic>?)?.cast<String>() ?? [];
        if (!roles.contains('admin')) {
          await _prefs.remove(kAuthTokenKey);
          if (refreshToken != null) await _prefs.remove(_kRefreshTokenKey);
          throw Exception('Acceso restringido a administradores');
        }
      }
    } on Exception {
      rethrow;
    } catch (_) {
      // Error parseando JWT — el servidor ya validó, continuar
    }

    state = AuthState(token: token, isAuthenticated: true);
  }

  Future<void> logout() async {
    await _prefs.remove(kAuthTokenKey);
    await _prefs.remove(_kRefreshTokenKey);
    state = const AuthState();
  }
}

// Provider override en main.dart — placeholder para facilitar el override
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  throw UnimplementedError('authProvider must be overridden in main.dart');
});
