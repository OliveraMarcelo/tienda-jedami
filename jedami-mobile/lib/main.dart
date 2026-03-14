import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app.dart';
import 'core/api/client.dart';
import 'features/auth/providers/auth_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final prefs = await SharedPreferences.getInstance();
  final dio = createDioClient();

  runApp(
    ProviderScope(
      overrides: [
        authProvider.overrideWith(
          (ref) {
            final notifier = AuthNotifier(dio, prefs);
            dio.interceptors.add(AuthInterceptor(ref));
            return notifier;
          },
        ),
      ],
      child: const JedamiApp(),
    ),
  );
}
