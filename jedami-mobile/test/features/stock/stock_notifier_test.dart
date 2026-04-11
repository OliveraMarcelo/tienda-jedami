import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jedami_mobile/features/stock/models/stock_item.dart';
import 'package:jedami_mobile/features/stock/providers/stock_provider.dart';

// ─── Mock Dio helpers ─────────────────────────────────────────────────────────

Dio _mockDio(dynamic responseData, {int statusCode = 200}) {
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

Dio _errorDio({int statusCode = 500, dynamic data}) {
  final dio = Dio(BaseOptions(baseUrl: 'http://test'));
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        handler.reject(DioException(
          requestOptions: options,
          response: Response(
            requestOptions: options,
            statusCode: statusCode,
            data: data,
          ),
          type: DioExceptionType.badResponse,
        ));
      },
    ),
  );
  return dio;
}

// ─── Datos de prueba ──────────────────────────────────────────────────────────

final _variant1 = <String, dynamic>{
  'id': 1,
  'size': 'M',
  'color': 'Rojo',
  'stock': <String, dynamic>{'quantity': 10},
};

final _variant2 = <String, dynamic>{
  'id': 2,
  'size': 'L',
  'color': 'Azul',
  'stock': <String, dynamic>{'quantity': 5},
};

final _product1 = <String, dynamic>{
  'id': 101,
  'name': 'Remera Test',
  'categoryName': 'Remeras',
  'imageUrl': null,
  'variants': [_variant1, _variant2],
};

final _fetchResponse = <String, dynamic>{
  'data': [_product1],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

void main() {
  group('StockNotifier', () {
    test('fetch carga productos correctamente', () async {
      final notifier = StockNotifier(_mockDio(_fetchResponse));
      await pumpEventQueue(); // deja que el constructor corra fetch()

      expect(notifier.state, isA<AsyncData<List<StockProduct>>>());
      final products = notifier.state.value!;
      expect(products.length, 1);
      expect(products[0].id, 101);
      expect(products[0].name, 'Remera Test');
      expect(products[0].variants.length, 2);
      expect(products[0].variants[0].stock, 10);
    });

    test('fetch con lista vacía resulta en lista vacía', () async {
      final notifier = StockNotifier(_mockDio(<String, dynamic>{'data': []}));
      await pumpEventQueue();

      final products = notifier.state.value!;
      expect(products, isEmpty);
    });

    test('fetch con error de red pone estado en AsyncError', () async {
      final notifier = StockNotifier(_errorDio());
      await pumpEventQueue();

      expect(notifier.state, isA<AsyncError>());
    });

    test('fetch con detail en response usa el mensaje del servidor', () async {
      final notifier = StockNotifier(
        _errorDio(statusCode: 401, data: <String, dynamic>{'detail': 'No autorizado'}),
      );
      await pumpEventQueue();

      expect(notifier.state, isA<AsyncError>());
      expect((notifier.state as AsyncError).error, 'No autorizado');
    });

    test('updateStock actualiza el stock local sin refetch', () async {
      final patchDio = Dio(BaseOptions(baseUrl: 'http://test'));
      int callCount = 0;
      patchDio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            callCount++;
            handler.resolve(Response(
              requestOptions: options,
              data: callCount == 1
                  ? _fetchResponse // primera llamada → fetch
                  : <String, dynamic>{'data': <String, dynamic>{'variantId': 1, 'newQuantity': 20}},
              statusCode: 200,
            ));
          },
        ),
      );

      final notifier = StockNotifier(patchDio);
      await pumpEventQueue();

      await notifier.updateStock(101, 1, 20);

      final updated = notifier.state.value!;
      final variant = updated[0].variants.firstWhere((v) => v.id == 1);
      expect(variant.stock, 20);
      // La otra variante no cambia
      final other = updated[0].variants.firstWhere((v) => v.id == 2);
      expect(other.stock, 5);
    });

    test('updateStock lanza excepción si el servidor falla', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test'));
      int callCount = 0;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            callCount++;
            if (callCount == 1) {
              handler.resolve(Response(
                requestOptions: options,
                data: _fetchResponse,
                statusCode: 200,
              ));
            } else {
              handler.reject(DioException(
                requestOptions: options,
                response: Response(
                  requestOptions: options,
                  statusCode: 422,
                  data: <String, dynamic>{'detail': 'Stock insuficiente'},
                ),
                type: DioExceptionType.badResponse,
              ));
            }
          },
        ),
      );

      final notifier = StockNotifier(dio);
      await pumpEventQueue();

      await expectLater(notifier.updateStock(101, 1, -5), throwsA(isA<DioException>()));
    });

    test('StockVariant.fromJson parsea correctamente', () {
      final v = StockVariant.fromJson(_variant1);
      expect(v.id, 1);
      expect(v.size, 'M');
      expect(v.color, 'Rojo');
      expect(v.stock, 10);
    });

    test('StockVariant.copyWith actualiza solo el stock', () {
      final v = StockVariant.fromJson(_variant1);
      final updated = v.copyWith(stock: 99);
      expect(updated.stock, 99);
      expect(updated.id, v.id);
      expect(updated.color, v.color);
    });

    test('StockProduct.fromJson parsea correctamente con variantes', () {
      final p = StockProduct.fromJson(_product1);
      expect(p.id, 101);
      expect(p.variants.length, 2);
    });
  });
}
