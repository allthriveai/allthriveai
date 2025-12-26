"""
Python-specific validation patterns for code exercises.
"""

PYTHON_PATTERNS = {
    # Function definitions
    'function_def': r'def\s+\w+\s*\(',
    'function_with_params': r'def\s+\w+\s*\([^)]+\)',
    'function_with_return_type': r'def\s+\w+\s*\([^)]*\)\s*->\s*\w+',
    # Print statements
    'print_call': r'print\s*\(',
    'print_with_fstring': r"print\s*\(\s*f['\"]",
    # Control flow
    'if_statement': r'if\s+.+:',
    'elif_statement': r'elif\s+.+:',
    'else_statement': r'else\s*:',
    'for_loop': r'for\s+\w+\s+in\s+',
    'while_loop': r'while\s+.+:',
    'try_block': r'try\s*:',
    'except_block': r'except(\s+\w+)?:',
    # Classes
    'class_def': r'class\s+\w+',
    'class_with_inheritance': r'class\s+\w+\s*\([^)]+\)',
    'init_method': r'def\s+__init__\s*\(',
    'self_reference': r'\bself\.',
    # Imports
    'import_statement': r'^import\s+\w+',
    'from_import': r'^from\s+\w+\s+import',
    # Variables
    'variable_assignment': r'\w+\s*=\s*[^=]',
    'list_literal': r'\[.+\]',
    'dict_literal': r'\{.+:.+\}',
    'tuple_literal': r'\(.+,.+\)',
    # List comprehension
    'list_comprehension': r'\[\s*.+\s+for\s+\w+\s+in\s+',
    # Common functions
    'len_call': r'len\s*\(',
    'range_call': r'range\s*\(',
    'input_call': r'input\s*\(',
    'open_call': r'open\s*\(',
    # String operations
    'string_format': r'\.format\s*\(',
    'string_split': r'\.split\s*\(',
    'string_join': r'\.join\s*\(',
    # Return statement
    'return_statement': r'return\s+',
    # Docstrings
    'docstring': r'""".*?"""',
}
