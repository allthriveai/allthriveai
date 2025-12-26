"""
JavaScript/TypeScript-specific validation patterns for code exercises.
"""

JAVASCRIPT_PATTERNS = {
    # Function definitions
    'function_declaration': r'function\s+\w+\s*\(',
    'arrow_function': r'=>\s*[{(]?',
    'const_function': r'const\s+\w+\s*=\s*\(',
    'async_function': r'async\s+(function|\w+\s*=)',
    # Variable declarations
    'const_declaration': r'const\s+\w+\s*=',
    'let_declaration': r'let\s+\w+\s*=',
    'var_declaration': r'var\s+\w+\s*=',
    # Console
    'console_log': r'console\.log\s*\(',
    'console_error': r'console\.error\s*\(',
    # Control flow
    'if_statement': r'if\s*\(',
    'else_if': r'else\s+if\s*\(',
    'else_statement': r'else\s*\{',
    'for_loop': r'for\s*\(',
    'for_of': r'for\s*\(\s*(const|let|var)\s+\w+\s+of\s+',
    'for_each': r'\.forEach\s*\(',
    'while_loop': r'while\s*\(',
    'switch_statement': r'switch\s*\(',
    'try_catch': r'try\s*\{',
    # Classes
    'class_declaration': r'class\s+\w+',
    'constructor_method': r'constructor\s*\(',
    'extends_class': r'class\s+\w+\s+extends\s+\w+',
    # Imports/Exports
    'import_statement': r'import\s+.*\s+from\s+',
    'require_statement': r"require\s*\(['\"]",
    'export_default': r'export\s+default',
    'export_named': r'export\s+\{',
    # Array methods
    'map_method': r'\.map\s*\(',
    'filter_method': r'\.filter\s*\(',
    'reduce_method': r'\.reduce\s*\(',
    'find_method': r'\.find\s*\(',
    # Object operations
    'object_literal': r'\{[^}]*:[^}]*\}',
    'object_destructuring': r'const\s*\{[^}]+\}\s*=',
    'array_destructuring': r'const\s*\[[^\]]+\]\s*=',
    'spread_operator': r'\.\.\.\w+',
    # Promises/Async
    'promise_new': r'new\s+Promise\s*\(',
    'then_method': r'\.then\s*\(',
    'catch_method': r'\.catch\s*\(',
    'await_keyword': r'await\s+',
    # DOM
    'query_selector': r'querySelector\s*\(',
    'get_element_by_id': r'getElementById\s*\(',
    'add_event_listener': r'addEventListener\s*\(',
    # Return
    'return_statement': r'return\s+',
}
