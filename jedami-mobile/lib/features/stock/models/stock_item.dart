class StockVariant {
  final int id;
  final String size;
  final String color;
  final int stock;

  const StockVariant({
    required this.id,
    required this.size,
    required this.color,
    required this.stock,
  });

  factory StockVariant.fromJson(Map<String, dynamic> json) => StockVariant(
        id: json['id'] as int,
        size: (json['size'] as String?) ?? '',
        color: (json['color'] as String?) ?? '',
        stock: (json['stock'] as Map<String, dynamic>)['quantity'] as int,
      );

  StockVariant copyWith({int? stock}) => StockVariant(
        id: id,
        size: size,
        color: color,
        stock: stock ?? this.stock,
      );
}

class StockProduct {
  final int id;
  final String name;
  final String? categoryName;
  final String? imageUrl;
  final List<StockVariant> variants;

  const StockProduct({
    required this.id,
    required this.name,
    this.categoryName,
    this.imageUrl,
    required this.variants,
  });

  factory StockProduct.fromJson(Map<String, dynamic> json) => StockProduct(
        id: json['id'] as int,
        name: json['name'] as String,
        categoryName: json['categoryName'] as String?,
        imageUrl: json['imageUrl'] as String?,
        variants: (json['variants'] as List<dynamic>)
            .map((v) => StockVariant.fromJson(v as Map<String, dynamic>))
            .toList(),
      );

  StockProduct copyWith({List<StockVariant>? variants}) => StockProduct(
        id: id,
        name: name,
        categoryName: categoryName,
        imageUrl: imageUrl,
        variants: variants ?? this.variants,
      );
}
