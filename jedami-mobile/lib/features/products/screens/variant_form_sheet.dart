import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../providers/products_provider.dart';

class VariantFormSheet extends ConsumerStatefulWidget {
  final int productId;
  final String productName;

  const VariantFormSheet({
    super.key,
    required this.productId,
    required this.productName,
  });

  @override
  ConsumerState<VariantFormSheet> createState() => _VariantFormSheetState();
}

class _VariantFormSheetState extends ConsumerState<VariantFormSheet> {
  final _formKey = GlobalKey<FormState>();
  final _sizeCtrl = TextEditingController();
  final _colorCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _stockCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _sizeCtrl.dispose();
    _colorCtrl.dispose();
    _priceCtrl.dispose();
    _stockCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(productsProvider.notifier).createVariant(
            widget.productId,
            size: _sizeCtrl.text.trim(),
            color: _colorCtrl.text.trim(),
            retailPrice: double.parse(_priceCtrl.text),
            initialStock: int.parse(_stockCtrl.text),
          );
      if (mounted) Navigator.of(context).pop(true);
    } on DioException catch (e) {
      setState(() {
        _error = e.response?.data?['detail'] as String? ?? 'Error al guardar';
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Error inesperado';
        _loading = false;
      });
    }
  }

  String? _validatePrice(String? v) {
    if (v == null || v.trim().isEmpty) return 'Campo requerido';
    final n = num.tryParse(v);
    if (n == null) return 'Debe ser un número';
    if (n <= 0) return 'Debe ser mayor a 0';
    return null;
  }

  String? _validateStock(String? v) {
    if (v == null || v.trim().isEmpty) return 'Campo requerido';
    final n = num.tryParse(v);
    if (n == null) return 'Debe ser un número';
    if (n < 0) return 'Debe ser ≥ 0';
    if (n != n.toInt()) return 'Debe ser un entero';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + bottom),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'Variante: ${widget.productName}',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _sizeCtrl,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(labelText: 'Talle *'),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Requerido' : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _colorCtrl,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(labelText: 'Color *'),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Requerido' : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _priceCtrl,
                    textInputAction: TextInputAction.next,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Precio (ARS) *',
                      prefixText: '\$ ',
                    ),
                    validator: _validatePrice,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _stockCtrl,
                    textInputAction: TextInputAction.done,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Stock inicial *'),
                    onFieldSubmitted: (_) => _save(),
                    validator: _validateStock,
                  ),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontSize: 13,
                ),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _loading ? null : _save,
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Agregar variante', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
