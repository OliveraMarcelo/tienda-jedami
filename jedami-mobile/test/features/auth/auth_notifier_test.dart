import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:jedami_mobile/features/auth/providers/auth_provider.dart';
import 'package:jedami_mobile/core/constants.dart';

// Genera un JWT de prueba con el payload dado (sin firma real — solo para tests)
String _makeJwt(Map<String, dynamic> payload) {
  final header = base64Url.encode(utf8.encode('{"alg":"HS256","typ":"JWT"}'));
  final body = base64Url.encode(utf8.encode(jsonEncode(payload)));
  return '$header.$body.fake_signature';
}

// Crea un Dio que intercepta todas las requests y devuelve [responseData]
Dio _mockDio(Map<String, dynamic> responseData, {int statusCode = 200}) {
  final dio = Dio(BaseOptions(baseUrl: 'http://test'));
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        handler.resolve(Response(
          requestOptions: options,
          data: responseData,
          statusCode: statusCode,
        ));
      },
    ),
  );
  return dio;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('AuthNotifier.login() — validación de rol admin', () {
    test('login con rol admin guarda token y autentica', () async {
      final token = _makeJwt({
        'userId': 1,
        'email': 'admin@test.com',
        'roles': ['admin'],
        'exp': DateTime.now().add(const Duration(hours: 24)).millisecondsSinceEpoch ~/ 1000,
      });
      final dio = _mockDio({'data': {'token': token, 'refreshToken': 'refresh_abc'}});
      final prefs = await SharedPreferences.getInstance();
      final notifier = AuthNotifier(dio, prefs);

      await notifier.login('admin@test.com', 'password');

      expect(notifier.state.isAuthenticated, isTrue);
      expect(notifier.state.token, equals(token));
      expect(prefs.getString(kAuthTokenKey), equals(token));
    });

    test('login con rol customer lanza excepción y limpia token', () async {
      final token = _makeJwt({
        'userId': 2,
        'email': 'customer@test.com',
        'roles': ['customer'],
        'exp': DateTime.now().add(const Duration(hours: 24)).millisecondsSinceEpoch ~/ 1000,
      });
      final dio = _mockDio({'data': {'token': token}});
      final prefs = await SharedPreferences.getInstance();
      final notifier = AuthNotifier(dio, prefs);

      await expectLater(
        notifier.login('customer@test.com', 'password'),
        throwsA(
          isA<Exception>().having(
            (e) => e.toString(),
            'message',
            contains('Acceso restringido a administradores'),
          ),
        ),
      );

      // Token no debe quedar guardado en prefs
      expect(prefs.getString(kAuthTokenKey), isNull);
    });

    test('login con roles vacíos lanza excepción', () async {
      final token = _makeJwt({
        'userId': 3,
        'email': 'user@test.com',
        'roles': <String>[],
        'exp': DateTime.now().add(const Duration(hours: 24)).millisecondsSinceEpoch ~/ 1000,
      });
      final dio = _mockDio({'data': {'token': token}});
      final prefs = await SharedPreferences.getInstance();
      final notifier = AuthNotifier(dio, prefs);

      await expectLater(
        notifier.login('user@test.com', 'password'),
        throwsA(isA<Exception>()),
      );
    });

    test('login sin token en respuesta lanza excepción', () async {
      final dio = _mockDio({'data': <String, dynamic>{}});
      final prefs = await SharedPreferences.getInstance();
      final notifier = AuthNotifier(dio, prefs);

      await expectLater(
        notifier.login('admin@test.com', 'password'),
        throwsA(isA<Exception>()),
      );
      expect(notifier.state.isAuthenticated, isFalse);
    });
  });

  group('AuthNotifier._restoreToken() — persistencia de sesión', () {
    test('restaura sesión si token válido con rol admin existe en prefs', () async {
      final token = _makeJwt({
        'userId': 1,
        'email': 'admin@test.com',
        'roles': ['admin'],
        'exp': DateTime.now().add(const Duration(hours: 24)).millisecondsSinceEpoch ~/ 1000,
      });
      SharedPreferences.setMockInitialValues({kAuthTokenKey: token});
      final prefs = await SharedPreferences.getInstance();
      final dio = Dio(BaseOptions(baseUrl: 'http://test'));
      final notifier = AuthNotifier(dio, prefs);

      expect(notifier.state.isAuthenticated, isTrue);
      expect(notifier.state.token, equals(token));
    });

    test('no restaura sesión si token está expirado', () async {
      final expiredToken = _makeJwt({
        'userId': 1,
        'email': 'admin@test.com',
        'roles': ['admin'],
        'exp': DateTime.now().subtract(const Duration(hours: 1)).millisecondsSinceEpoch ~/ 1000,
      });
      SharedPreferences.setMockInitialValues({kAuthTokenKey: expiredToken});
      final prefs = await SharedPreferences.getInstance();
      final dio = Dio(BaseOptions(baseUrl: 'http://test'));
      final notifier = AuthNotifier(dio, prefs);

      expect(notifier.state.isAuthenticated, isFalse);
    });

    test('no restaura sesión si token válido pero sin rol admin', () async {
      final customerToken = _makeJwt({
        'userId': 5,
        'email': 'customer@test.com',
        'roles': ['retail'],
        'exp': DateTime.now().add(const Duration(hours: 24)).millisecondsSinceEpoch ~/ 1000,
      });
      SharedPreferences.setMockInitialValues({kAuthTokenKey: customerToken});
      final prefs = await SharedPreferences.getInstance();
      final dio = Dio(BaseOptions(baseUrl: 'http://test'));
      final notifier = AuthNotifier(dio, prefs);

      expect(notifier.state.isAuthenticated, isFalse);
      // Token debe haber sido limpiado de prefs
      expect(prefs.getString(kAuthTokenKey), isNull);
    });
  });
}
