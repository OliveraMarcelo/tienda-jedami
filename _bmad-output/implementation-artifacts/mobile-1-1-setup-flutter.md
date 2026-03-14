# Story M1.1: Setup de jedami-mobile — App Admin Flutter

Status: review

## Story

Como desarrollador,
quiero configurar jedami-mobile como app de administración con el tema JEDAMI y la conexión al BFF,
para que el administrador pueda gestionar el catálogo desde su dispositivo móvil.

**Depende de:** BFF Story 1.2 done (`POST /api/v1/auth/login` operativo)

## Acceptance Criteria

1. **Given** la app está configurada
   **When** se ejecuta `flutter run -d chrome` (o `-d linux`)
   **Then** muestra la pantalla de login con el tema JEDAMI (color primario magenta `#E91E8C`, fuente redondeada)

2. **Given** el admin hace login con credenciales correctas
   **When** la API retorna el JWT
   **Then** el token se almacena en `SharedPreferences`, el `AuthNotifier` actualiza su estado y el router redirige a `/admin/productos`

3. **Given** credenciales incorrectas
   **When** la API retorna 401
   **Then** se muestra el mensaje de error `detail` del RFC 7807 bajo el formulario (no un dialog de error)

4. **Given** el token está almacenado y la app se reinicia
   **When** `main.dart` inicializa
   **Then** el usuario no debe volver a hacer login (redirige directamente a `/admin/productos`)

## Tasks / Subtasks

- [x] Task 1 — Actualizar tema Material 3 con colores JEDAMI (AC: #1)
  - [x] seedColor + primary: #E91E8C, secondary: #00BCD4, error: #F44336
  - [x] FilledButton con borderRadius 12 y ancho full

- [x] Task 2 — Crear `lib/core/api/client.dart` con Dio + interceptor JWT (AC: #2)
  - [x] baseUrl desde String.fromEnvironment('BFF_URL', defaultValue: 'http://localhost:3000')
  - [x] AuthInterceptor: agrega Bearer token; en 401 llama logout()

- [x] Task 3 — Crear `AuthNotifier` con Riverpod (AC: #2, #4)
  - [x] StateNotifier<AuthState>; _restoreToken() en constructor lee SharedPreferences
  - [x] login(): POST /auth/login → setString; logout(): remove

- [x] Task 4 — Crear `LoginScreen` en features/auth/screens/ (AC: #2, #3)
  - [x] Usa ref.read(authProvider.notifier).login() — atrapa DioException → muestra detail
  - [x] GoRouter redirect se encarga de navegar; toggle visibilidad password

- [x] Task 5 — Actualizar `app.dart` con GoRouter + redirect (AC: #2, #4)
  - [x] _AuthRouterNotifier extiende ChangeNotifier; refreshListenable para re-evaluar redirect
  - [x] redirect: !isAuth → /login; isAuth en /login → /admin/productos

## Dev Notes

### Estado actual del código (NO recrear)

| Archivo | Estado | Acción |
|---|---|---|
| `lib/app.dart` | ⚠️ Tema azul `#1A237E`, rutas /login + /home | Modificar tema + rutas |
| `lib/main.dart` | ✅ MaterialApp.router con ProviderScope | Agregar init de token |
| `lib/screens/login_screen.dart` | ⚠️ Form completo pero TODO en login | Reemplazar TODO con API real |
| `lib/screens/home_screen.dart` | ❌ Placeholder | Reemplazar con admin navigation |
| `pubspec.yaml` | ✅ go_router + Riverpod + Dio + SharedPreferences instalados | Solo agregar Google Fonts si se usa |

### Endpoint del BFF a consumir

```
POST /api/v1/auth/login
  Body: { "email": "...", "password": "..." }
  Response 200: { "data": { "token": "eyJ..." } }
  Error 401 RFC 7807: { "type": "...", "title": "...", "status": 401, "detail": "Email o contraseña incorrectos" }
```

### Estructura AuthState con Riverpod

```dart
// lib/features/auth/providers/auth_provider.dart

class AuthState {
  final String? token;
  final bool isAuthenticated;
  AuthState({ this.token, this.isAuthenticated = false });
}

class AuthNotifier extends StateNotifier<AuthState> {
  final Dio _dio;
  final SharedPreferences _prefs;

  AuthNotifier(this._dio, this._prefs) : super(AuthState()) {
    _restoreToken();
  }

  void _restoreToken() {
    final token = _prefs.getString('auth_token');
    if (token != null) {
      state = AuthState(token: token, isAuthenticated: true);
    }
  }

  Future<void> login(String email, String password) async {
    final response = await _dio.post('/auth/login',
      data: {'email': email, 'password': password});
    final token = response.data['data']['token'] as String;
    await _prefs.setString('auth_token', token);
    state = AuthState(token: token, isAuthenticated: true);
  }

  Future<void> logout() async {
    await _prefs.remove('auth_token');
    state = AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  // Inicializado en main.dart con Dio y SharedPreferences ya construidos
  throw UnimplementedError();
});
```

### URL del BFF en Flutter

Para emulador Android: `http://10.0.2.2:3000` (apunta al localhost del host)
Para Chrome/Linux en dev: `http://localhost:3000`
Usar `const String.fromEnvironment('BFF_URL', defaultValue: 'http://localhost:3000')` en release.

### Estructura de directorios

```
jedami-mobile/lib/
├── app.dart                                 (MODIFICAR: tema + rutas)
├── main.dart                                (MODIFICAR: init token)
├── core/
│   ├── api/
│   │   └── client.dart                     (NUEVO: Dio + interceptor)
│   └── constants.dart                      (NUEVO: URLs, strings)
├── features/
│   └── auth/
│       ├── screens/
│       │   └── login_screen.dart           (MODIFICAR: API real)
│       └── providers/
│           └── auth_provider.dart          (NUEVO: AuthNotifier)
└── screens/
    └── home_screen.dart                    (MODIFICAR: placeholder admin)
```

### References

- BFF story 1.2 (login endpoint): [Source: _bmad-output/implementation-artifacts/1-2-registro-y-autenticacion-de-administrador.md]
- Architecture — jedami-mobile stack (Flutter + go_router + Riverpod + Dio): [Source: _bmad-output/planning-artifacts/architecture.md#Starters Utilizados]
- UX Design Spec — Admin platform strategy (web + mobile): [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Platform Strategy]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: Tema Material 3 con seedColor #E91E8C. FilledButton con ancho double.infinity, height 48, borderRadius 12.
- Task 2: client.dart con createDioClient() + AuthInterceptor (Ref para leer authProvider). baseUrl desde String.fromEnvironment con fallback localhost:3000.
- Task 3: auth_provider.dart con AuthState inmutable + AuthNotifier. _restoreToken() en constructor. Provider override en main.dart con prefs e interceptor agregado post-construcción.
- Task 4: LoginScreen en features/auth/screens/. ConsumerStatefulWidget. DioException → _serverError muestra detail. GoRouter redirect maneja navegación post-login automáticamente.
- Task 5: app.dart refactorizado a ConsumerStatefulWidget con _AuthRouterNotifier (ChangeNotifier + Ref.listen) como refreshListenable del GoRouter. Evita recrear el router en cada rebuild.

### File List

- `jedami-mobile/lib/main.dart` (MODIFICADO — async main, SharedPreferences, override authProvider)
- `jedami-mobile/lib/app.dart` (MODIFICADO — tema JEDAMI, GoRouter con redirect, _AuthRouterNotifier)
- `jedami-mobile/lib/core/constants.dart` (NUEVO — kApiBaseUrl, kAuthTokenKey)
- `jedami-mobile/lib/core/api/client.dart` (NUEVO — createDioClient, AuthInterceptor)
- `jedami-mobile/lib/features/auth/providers/auth_provider.dart` (NUEVO — AuthState, AuthNotifier, authProvider)
- `jedami-mobile/lib/features/auth/screens/login_screen.dart` (NUEVO — LoginScreen con API real)
- `jedami-mobile/lib/features/admin/screens/admin_products_screen.dart` (NUEVO — placeholder para M1.2)
