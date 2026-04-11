import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

bool get isDesktop =>
    !kIsWeb && (Platform.isLinux || Platform.isMacOS || Platform.isWindows);
