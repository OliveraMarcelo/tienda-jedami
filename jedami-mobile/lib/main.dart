import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:window_manager/window_manager.dart';
import 'app.dart';
import 'core/api/client.dart';
import 'core/platform.dart';
import 'features/auth/providers/auth_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (isDesktop) {
    await windowManager.ensureInitialized();
    await windowManager.setMinimumSize(const Size(900, 600));
  }

  final prefs = await SharedPreferences.getInstance();
  final dio = createDioClient();

  runApp(
    ProviderScope(
      overrides: [
        authProvider.overrideWith(
          (ref) {
            final notifier = AuthNotifier(dio, prefs);
            // Guardia: evita agregar el interceptor más de una vez
            // si el provider fuera recreado (ej. invalidate en tests)
            if (!dio.interceptors.any((i) => i is AuthInterceptor)) {
              dio.interceptors.add(AuthInterceptor(ref));
            }
            return notifier;
          },
        ),
      ],
      child: const JedamiApp(),
    ),
  );
}
