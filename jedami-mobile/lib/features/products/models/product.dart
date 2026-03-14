class Variant {
  final int id;
  final String size;
  final String color;
  final double retailPrice;
  final int stockQuantity;

  const Variant({
    required this.id,
    required this.size,
    required this.color,
    required this.retailPrice,
    required this.stockQuantity,
  });

  factory Variant.fromJson(Map<String, dynamic> json) => Variant(
        id: json['id'] as int,
        size: json['size'] as String,
        color: json['color'] as String,
        retailPrice: (json['retailPrice'] as num).toDouble(),
        stockQuantity: (json['stock'] as Map<String, dynamic>)['quantity'] as int,
      );
}

class Product {
  final int id;
  final String name;
  final String? description;
  final List<Variant> variants;

  const Product({
    required this.id,
    required this.name,
    this.description,
    required this.variants,
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as int,
        name: json['name'] as String,
        description: json['description'] as String?,
        variants: (json['variants'] as List<dynamic>)
            .map((v) => Variant.fromJson(v as Map<String, dynamic>))
            .toList(),
      );

  static const _undefined = Object();

  Product copyWith({String? name, Object? description = _undefined, List<Variant>? variants}) {
    return Product(
      id: id,
      name: name ?? this.name,
      description: identical(description, _undefined) ? this.description : description as String?,
      variants: variants ?? this.variants,
    );
  }
}
