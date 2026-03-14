import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../models/product.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../core/api/client.dart';

class ProductsState {
  final List<Product> products;
  final bool loading;
  final String? error;

  const ProductsState({
    this.products = const [],
    this.loading = false,
    this.error,
  });

  ProductsState copyWith({
    List<Product>? products,
    bool? loading,
    String? error,
  }) {
    return ProductsState(
      products: products ?? this.products,
      loading: loading ?? this.loading,
      error: error,
    );
  }
}

class ProductsNotifier extends StateNotifier<ProductsState> {
  final Dio _dio;

  ProductsNotifier(this._dio) : super(const ProductsState());

  Future<void> fetchProducts() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final res = await _dio.get('/products', queryParameters: {'page': 1, 'pageSize': 100});
      final list = (res.data['data'] as List<dynamic>)
          .map((e) => Product.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(products: list, loading: false);
    } on DioException catch (e) {
      final msg = e.response?.data?['detail'] as String? ?? 'Error al cargar productos';
      state = state.copyWith(loading: false, error: msg);
    }
  }

  Future<Product> createProduct(String name, {String? description}) async {
    final res = await _dio.post('/products', data: {
      'name': name,
      if (description != null && description.isNotEmpty) 'description': description,
    });
    final product = Product.fromJson({
      ...res.data['data'] as Map<String, dynamic>,
      'variants': <dynamic>[],
    });
    state = state.copyWith(products: [...state.products, product]);
    return product;
  }

  Future<void> createVariant(
    int productId, {
    required String size,
    required String color,
    required double retailPrice,
    required int initialStock,
  }) async {
    final res = await _dio.post('/products/$productId/variants', data: {
      'size': size,
      'color': color,
      'retailPrice': retailPrice,
      'initialStock': initialStock,
    });
    final data = res.data['data'] as Map<String, dynamic>;
    final variant = Variant(
      id: data['id'] as int,
      size: data['size'] as String,
      color: data['color'] as String,
      retailPrice: (data['retailPrice'] as num).toDouble(),
      stockQuantity: (data['stock'] as Map<String, dynamic>)['quantity'] as int,
    );
    final updated = state.products.map((p) {
      if (p.id != productId) return p;
      return p.copyWith(variants: [...p.variants, variant]);
    }).toList();
    state = state.copyWith(products: updated);
  }
}

final productsProvider = StateNotifierProvider<ProductsNotifier, ProductsState>((ref) {
  final dio = ref.watch(_dioProvider);
  return ProductsNotifier(dio);
});

// Dio con AuthInterceptor ya configurado desde main.dart; aquí usamos uno fresco
// que se complementa con el interceptor del ref
final _dioProvider = Provider<Dio>((ref) {
  final dio = createDioClient();
  dio.interceptors.add(AuthInterceptor(ref));
  return dio;
});
