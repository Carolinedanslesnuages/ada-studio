#!/usr/bin/env python
"""Commandes Django : `python manage.py runserver`, `migrate`, `test`…"""

import os
import sys


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "projet.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
