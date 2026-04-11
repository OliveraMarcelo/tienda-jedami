import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/stock_item.dart';
import '../providers/stock_provider.dart';

class StockManagementScreen extends ConsumerWidget {
  const StockManagementScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(stockProductsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Gestión de Stock'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.read(stockProductsProvider.notifier).fetch(),
          ),
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Error: $e', style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => ref.read(stockProductsProvider.notifier).fetch(),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
        data: (products) => products.isEmpty
            ? const Center(child: Text('No hay productos.'))
            : ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                itemCount: products.length,
                itemBuilder: (_, i) => _ProductTile(product: products[i]),
              ),
      ),
    );
  }
}

class _ProductTile extends StatelessWidget {
  final StockProduct product;
  const _ProductTile({required this.product});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ExpansionTile(
        leading: product.imageUrl != null
            ? ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.network(
                  product.imageUrl!,
                  width: 44,
                  height: 44,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const _ImagePlaceholder(),
                ),
              )
            : const _ImagePlaceholder(),
        title: Text(product.name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: product.categoryName != null
            ? Text(product.categoryName!, style: const TextStyle(fontSize: 12))
            : null,
        children: [
          if (product.variants.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Sin variantes', style: TextStyle(color: Colors.grey)),
            )
          else
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Table(
                columnWidths: const {
                  0: FlexColumnWidth(2),
                  1: FlexColumnWidth(2),
                  2: FlexColumnWidth(2),
                  3: FlexColumnWidth(1),
                },
                children: [
                  TableRow(
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
                    ),
                    children: const [
                      _HeaderCell('Talle'),
                      _HeaderCell('Color'),
                      _HeaderCell('Stock'),
                      _HeaderCell(''),
                    ],
                  ),
                  ...product.variants.map(
                    (v) => TableRow(children: [
                      _Cell(v.size),
                      _Cell(v.color),
                      _StockCell(product: product, variant: v),
                      const SizedBox.shrink(),
                    ]),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _StockCell extends ConsumerStatefulWidget {
  final StockProduct product;
  final StockVariant variant;
  const _StockCell({required this.product, required this.variant});

  @override
  ConsumerState<_StockCell> createState() => _StockCellState();
}

class _StockCellState extends ConsumerState<_StockCell> {
  late TextEditingController _ctrl;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.variant.stock.toString());
  }

  @override
  void didUpdateWidget(_StockCell old) {
    super.didUpdateWidget(old);
    // Actualizar campo si el stock cambió externamente (ej. refresh)
    if (old.variant.stock != widget.variant.stock && !_saving) {
      _ctrl.text = widget.variant.stock.toString();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final qty = int.tryParse(_ctrl.text);
    if (qty == null || qty < 0) {
      setState(() => _error = 'Valor inválido');
      return;
    }
    if (qty == widget.variant.stock) return;

    setState(() { _saving = true; _error = null; });
    try {
      await ref.read(stockProductsProvider.notifier).updateStock(
            widget.product.id,
            widget.variant.id,
            qty,
          );
    } catch (_) {
      // Revertir al valor original
      _ctrl.text = widget.variant.stock.toString();
      setState(() => _error = 'Error al guardar');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 72,
                height: 32,
                child: TextField(
                  controller: _ctrl,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: const TextStyle(fontSize: 13),
                  decoration: const InputDecoration(
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  ),
                  onSubmitted: (_) => _save(),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 32,
                child: _saving
                    ? const SizedBox(
                        width: 24,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : TextButton(
                        onPressed: _save,
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text('Guardar', style: TextStyle(fontSize: 12)),
                      ),
              ),
            ],
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(_error!, style: const TextStyle(fontSize: 11, color: Colors.red)),
            ),
        ],
      ),
    );
  }
}

class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder();
  @override
  Widget build(BuildContext context) => Container(
        width: 44, height: 44,
        decoration: BoxDecoration(
          color: Colors.grey.shade200,
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Icon(Icons.inventory_2_outlined, size: 20, color: Colors.grey),
      );
}

class _HeaderCell extends StatelessWidget {
  final String text;
  const _HeaderCell(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
      );
}

class _Cell extends StatelessWidget {
  final String text;
  const _Cell(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(text, style: const TextStyle(fontSize: 13)),
      );
}
