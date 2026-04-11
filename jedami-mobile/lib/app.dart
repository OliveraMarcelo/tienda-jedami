import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/platform.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/products/screens/products_screen.dart';
import 'features/stock/screens/stock_management_screen.dart';

// Listenable que GoRouter usa para re-evaluar el redirect cuando cambia auth
class _AuthRouterNotifier extends ChangeNotifier {
  bool _isAuthenticated = false;
  bool get isAuthenticated => _isAuthenticated;

  void update(bool isAuthenticated) {
    if (_isAuthenticated == isAuthenticated) return;
    _isAuthenticated = isAuthenticated;
    notifyListeners();
  }
}

class JedamiApp extends ConsumerStatefulWidget {
  const JedamiApp({super.key});

  @override
  ConsumerState<JedamiApp> createState() => _JedamiAppState();
}

class _JedamiAppState extends ConsumerState<JedamiApp> {
  late final _AuthRouterNotifier _routerNotifier;
  late final GoRouter _router;
  ProviderSubscription<AuthState>? _authSub;

  @override
  void initState() {
    super.initState();
    _routerNotifier = _AuthRouterNotifier()
      ..update(ref.read(authProvider).isAuthenticated);

    // listenManual es válido fuera de build()
    _authSub = ref.listenManual<AuthState>(authProvider, (_, next) {
      _routerNotifier.update(next.isAuthenticated);
    });

    _router = GoRouter(
      initialLocation: '/login',
      refreshListenable: _routerNotifier,
      redirect: (context, state) {
        final isAuth = _routerNotifier.isAuthenticated;
        final isLogin = state.matchedLocation == '/login';

        if (!isAuth && !isLogin) return '/login';
        if (isAuth && isLogin) return isDesktop ? '/desktop/stock' : '/admin/productos';
        return null;
      },
      routes: [
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: '/admin/productos',
          builder: (context, state) => const ProductsScreen(),
        ),
        GoRoute(
          path: '/desktop/stock',
          builder: (context, state) => const StockManagementScreen(),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _authSub?.close();
    _routerNotifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Jedami Admin',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFE91E8C),
          primary: const Color(0xFFE91E8C),
          secondary: const Color(0xFF00BCD4),
          error: const Color(0xFFF44336),
        ),
        useMaterial3: true,
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
          filled: true,
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFE91E8C),
            minimumSize: const Size(double.infinity, 48),
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.all(Radius.circular(12)),
            ),
          ),
        ),
      ),
      routerConfig: _router,
    );
  }
}
