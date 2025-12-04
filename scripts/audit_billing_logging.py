#!/usr/bin/env python
"""
Billing Logging Audit Script

Audits all billing code for:
1. Proper use of StructuredLogger
2. Silent failures (try-except without logging)
3. Missing error handling
4. Security issues in logging
"""

import re
from pathlib import Path

BILLING_DIR = Path(__file__).parent.parent / 'core' / 'billing'


class LoggingAuditor:
    def __init__(self):
        self.issues = []
        self.recommendations = []

    def add_issue(self, file, line_no, severity, message):
        self.issues.append({'file': file, 'line': line_no, 'severity': severity, 'message': message})

    def add_recommendation(self, file, line_no, message):
        self.recommendations.append({'file': file, 'line': line_no, 'message': message})

    def audit_file(self, file_path):
        """Audit a single Python file for logging issues."""
        with open(file_path) as f:
            lines = f.readlines()

        file_name = file_path.name

        # Check if file uses StructuredLogger
        uses_structured_logger = any('StructuredLogger' in line for line in lines)

        # Check if file uses basic logging
        uses_basic_logging = any(re.match(r'^import logging|^from.*logging', line) for line in lines)

        for i, line in enumerate(lines, 1):
            stripped = line.strip()

            # Check except blocks for logging
            if stripped.startswith('except'):
                # Look ahead to see if there's logging in this except block
                has_logging = False
                has_pass = False

                # Check next 10 lines for logging or pass
                for j in range(i, min(i + 10, len(lines))):
                    next_line = lines[j].strip()

                    if 'logger.' in next_line or 'StructuredLogger' in next_line:
                        has_logging = True
                        break

                    if next_line == 'pass':
                        has_pass = True

                    # Stop if we hit another except or try
                    if next_line.startswith(('except', 'try:', 'else:', 'finally:')):
                        if j > i:  # Not the same line
                            break

                if not has_logging:
                    if has_pass:
                        self.add_issue(file_name, i, 'HIGH', 'Silent failure: except block with pass, no logging')
                    else:
                        self.add_issue(file_name, i, 'MEDIUM', 'Except block may be missing error logging')

            # Check for basic logging usage instead of StructuredLogger
            if uses_basic_logging and not uses_structured_logger:
                if 'logger.error' in stripped or 'logger.warning' in stripped:
                    self.add_recommendation(
                        file_name, i, 'Consider using StructuredLogger.log_error() instead of basic logger'
                    )

            # Check for logging sensitive data
            if 'logger.' in stripped or 'print(' in stripped:
                sensitive_patterns = [
                    r'password',
                    r'secret',
                    r'token',
                    r'api_key',
                    r'stripe_',
                ]
                for pattern in sensitive_patterns:
                    if re.search(pattern, stripped, re.IGNORECASE):
                        self.add_issue(file_name, i, 'CRITICAL', f'Possible sensitive data in log: {pattern}')

            # Check for TODO or FIXME related to logging
            if 'TODO' in stripped or 'FIXME' in stripped:
                if 'log' in stripped.lower():
                    self.add_issue(file_name, i, 'LOW', f'TODO/FIXME related to logging: {stripped}')

    def print_report(self):
        """Print audit report."""
        print('\n' + '=' * 70)
        print('BILLING LOGGING AUDIT REPORT')
        print('=' * 70)

        if not self.issues and not self.recommendations:
            print('\n✅ No issues found! Logging looks good.')
            return

        # Print issues by severity
        if self.issues:
            print('\n🔴 ISSUES FOUND\n')

            for severity in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
                severity_issues = [i for i in self.issues if i['severity'] == severity]
                if severity_issues:
                    print(f'\n{severity} ({len(severity_issues)}):')
                    for issue in severity_issues:
                        print(f'  📄 {issue["file"]}:{issue["line"]}')
                        print(f'     {issue["message"]}')

        # Print recommendations
        if self.recommendations:
            print('\n💡 RECOMMENDATIONS\n')
            for rec in self.recommendations:
                print(f'  📄 {rec["file"]}:{rec["line"]}')
                print(f'     {rec["message"]}')

        # Summary
        print('\n' + '=' * 70)
        print(f'Summary: {len(self.issues)} issues, {len(self.recommendations)} recommendations')
        print('=' * 70 + '\n')


def main():
    """Run the audit."""
    auditor = LoggingAuditor()

    print('🔍 Auditing billing code for logging issues...')
    print(f'Directory: {BILLING_DIR}\n')

    # Audit all Python files in billing directory
    for file_path in BILLING_DIR.glob('*.py'):
        if file_path.name == '__init__.py':
            continue

        print(f'  Checking {file_path.name}...')
        auditor.audit_file(file_path)

    # Print report
    auditor.print_report()


if __name__ == '__main__':
    main()
