# Story 8.1: Flutter Desktop — Setup y Login

Status: ready-for-dev

## Story

Como operador,
quiero iniciar sesión en la app desktop con mis credenciales de administrador,
para gestionar el stock de manera segura.

## Acceptance Criteria

1. **Given** la app se ejecuta con `flutter run -d linux`
   **When** inicia
   **Then** muestra la pantalla de login con el branding Jedami (Material 3, color `#E91E8C`)
   **And** la ventana tiene dimensiones mínimas adecuadas para uso desktop (mín 900×600)

2. **Given** el admin hace login exitoso
   **When** la API retorna el JWT con rol admin
   **Then** el token se almacena y el admin es redirigido a la pantalla principal de gestión de stock (`/desktop/stock`)

3. **Given** el admin NO tiene rol admin
   **When** hace login
   **Then** el login es rechazado con mensaje "Acceso restringido a administradores"

4. **Given** la app corre en plataforma Desktop (Linux/macOS)
   **When** el usuario está autenticado
   **Then** muestra el layout de gestión de stock (no el panel mobile de productos)

5. **Given** el admin cierra la app y la vuelve a abrir
   **When** el token guardado en SharedPreferences sigue siendo válido
   **Then** va directo a `/desktop/stock` sin pasar por login

## Tasks / Subtasks

- [ ] Verificar y configurar soporte Desktop en `jedami-mobile` (AC: 1)
  - [ ] Confirmar que `linux/` folder existe (YA EXISTE — verificado)
  - [ ] Agregar `window_size` o `window_manager` package para dimensiones mínimas de ventana
  - [ ] Configurar `CMakeLists.txt` si es necesario para el package elegido
- [ ] Detectar plataforma en `app.dart` para enrutar a layout correcto (AC: 4)
  - [ ] Importar `import 'package:flutter/foundation.dart'` y usar `defaultTargetPlatform`
  - [ ] O usar `kIsWeb` + `Platform.isLinux` / `Platform.isMacOS`
  - [ ] Constante `bool get isDesktop => !kIsWeb && (Platform.isLinux || Platform.isMacOS || Platform.isWindows)`
- [ ] Agregar validación de rol admin en `AuthNotifier.login()` (AC: 3)
  - [ ] Parsear payload JWT para verificar roles
  - [ ] Si el token no tiene rol `admin`, hacer logout inmediato y lanzar excepción con mensaje descriptivo
- [ ] Agregar route `/desktop/stock` en `app.dart` que redirige al `StockManagementScreen` (AC: 2, 4)
  - [ ] En redirect de GoRouter: si `isDesktop && isAuth` → `/desktop/stock`; si `!isDesktop && isAuth` → `/admin/productos`
- [ ] Crear `lib/features/stock/screens/stock_management_screen.dart` como placeholder (AC: 2, 4)
  - [ ] Solo scaffold con AppBar "Gestión de Stock" y mensaje "Próximamente" (la implementación real es Story 8.2)
- [ ] Actualizar `LoginScreen` para manejar el nuevo error de "no es admin" (AC: 3)

## Dev Notes

### Flutter Desktop — ya configurado
El folder `jedami-mobile/linux/` ya existe (creado por `flutter create`), por lo que el soporte desktop está habilitado.
**Para correr:** `cd jedami-mobile && flutter run -d linux`
**En dev sin Android SDK:** siempre usar `-d linux` o `-d chrome`

### Detección de plataforma
```dart
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

bool get isDesktop =>
  !kIsWeb && (Platform.isLinux || Platform.isMacOS || Platform.isWindows);
```
No importar `dart:io` en web builds — envolver en conditional import si el proyecto compila para web también.

### window_manager (dimensiones mínimas)
Package: `window_manager: ^0.4.0` en pubspec.yaml (verificar última versión estable).
```dart
// main.dart — solo para Desktop
if (isDesktop) {
  await windowManager.ensureInitialized();
  await windowManager.setMinimumSize(const Size(900, 600));
}
```

### GoRouter redirect para Desktop vs Mobile
```dart
redirect: (context, state) {
  final isAuth = _routerNotifier.isAuthenticated;
  final isLogin = state.matchedLocation == '/login';
  if (!isAuth && !isLogin) return '/login';
  if (isAuth && isLogin) {
    return isDesktop ? '/desktop/stock' : '/admin/productos';
  }
  return null;
}
```

### Validación de rol admin en login
```dart
// En AuthNotifier.login():
final parts = token!.split('.');
final payload = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
final roles = (payload['roles'] as List<dynamic>?)?.cast<String>() ?? [];
if (!roles.contains('admin')) {
  await _prefs.remove(kAuthTokenKey);
  throw Exception('Acceso restringido a administradores');
}
```
Verificar el shape del JWT payload — en el BFF el payload incluye `{ userId, email, roles: ['admin'] }`.

### Estructura de archivos recomendada
```
jedami-mobile/lib/features/stock/
  screens/
    stock_management_screen.dart   ← placeholder en Story 8.1, implementado en 8.2
  providers/
    stock_provider.dart            ← implementado en 8.2
  models/
    stock_item.dart                ← implementado en 8.2
```

### AuthProvider existente
`lib/features/auth/providers/auth_provider.dart` ya tiene:
- `AuthNotifier extends StateNotifier<AuthState>`
- `login()`, `logout()`, `_restoreToken()` con validación de expiración JWT
- El `authProvider` se override en `main.dart` con `AuthNotifier(dio, prefs)`

### Project Structure Notes
- `jedami-mobile/lib/app.dart` — GoRouter + JedamiApp: MODIFICAR (rutas + redirect desktop)
- `jedami-mobile/lib/main.dart` — setup providers: MODIFICAR (window_manager init)
- `jedami-mobile/lib/features/auth/providers/auth_provider.dart` — MODIFICAR (validación rol)
- `jedami-mobile/pubspec.yaml` — MODIFICAR (agregar window_manager si se usa)

### Referencias
- [Source: jedami-mobile/lib/app.dart] — GoRouter y rutas
- [Source: jedami-mobile/lib/main.dart] — entry point y setup
- [Source: jedami-mobile/lib/features/auth/providers/auth_provider.dart] — auth notifier
- [Source: jedami-mobile/lib/core/constants.dart] — constantes (kAuthTokenKey, API_BASE_URL)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
