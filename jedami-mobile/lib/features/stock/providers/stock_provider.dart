import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/client.dart';
import '../models/stock_item.dart';

class StockNotifier extends StateNotifier<AsyncValue<List<StockProduct>>> {
  final Dio _dio;

  StockNotifier(this._dio) : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final res = await _dio.get('/products', queryParameters: {'page': 1, 'pageSize': 200});
      final list = (res.data['data'] as List<dynamic>)
          .map((e) => StockProduct.fromJson(e as Map<String, dynamic>))
          .toList();
      state = AsyncValue.data(list);
    } on DioException catch (e) {
      final msg = e.response?.data?['detail'] as String? ?? 'Error al cargar productos';
      state = AsyncValue.error(msg, StackTrace.current);
    } catch (e) {
      state = AsyncValue.error('Error inesperado', StackTrace.current);
    }
  }

  /// Actualiza el stock de una variante. Lanza excepción si falla (para que la UI revierta).
  Future<void> updateStock(int productId, int variantId, int quantity) async {
    await _dio.patch(
      '/admin/products/$productId/variants/$variantId/stock',
      data: {'quantity': quantity},
    );

    // Actualizar estado local sin refetch
    state = state.whenData((products) => products.map((p) {
          if (p.id != productId) return p;
          return p.copyWith(
            variants: p.variants.map((v) {
              if (v.id != variantId) return v;
              return v.copyWith(stock: quantity);
            }).toList(),
          );
        }).toList());
  }
}

final _stockDioProvider = Provider<Dio>((ref) {
  final dio = createDioClient();
  dio.interceptors.add(AuthInterceptor(ref));
  return dio;
});

final stockProductsProvider =
    StateNotifierProvider<StockNotifier, AsyncValue<List<StockProduct>>>((ref) {
  final dio = ref.watch(_stockDioProvider);
  return StockNotifier(dio);
});
