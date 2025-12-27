"""
HTML and CSS-specific validation patterns for code exercises.
"""

HTML_PATTERNS = {
    # Document structure
    'doctype': r'<!DOCTYPE\s+html>',
    'html_tag': r'<html[^>]*>',
    'head_tag': r'<head[^>]*>',
    'body_tag': r'<body[^>]*>',
    'title_tag': r'<title[^>]*>',
    # Meta tags
    'meta_charset': r'<meta\s+charset=["\']',
    'meta_viewport': r'<meta\s+name=["\']viewport["\']',
    # Common tags
    'paragraph': r'<p[^>]*>',
    'heading_any': r'<h[1-6][^>]*>',
    'heading_1': r'<h1[^>]*>',
    'div_tag': r'<div[^>]*>',
    'span_tag': r'<span[^>]*>',
    'link_tag': r'<a\s+href=',
    'image_tag': r'<img\s+src=',
    'list_unordered': r'<ul[^>]*>',
    'list_ordered': r'<ol[^>]*>',
    'list_item': r'<li[^>]*>',
    'table_tag': r'<table[^>]*>',
    'form_tag': r'<form[^>]*>',
    'input_tag': r'<input[^>]*>',
    'button_tag': r'<button[^>]*>',
    # Semantic HTML
    'header_tag': r'<header[^>]*>',
    'footer_tag': r'<footer[^>]*>',
    'nav_tag': r'<nav[^>]*>',
    'main_tag': r'<main[^>]*>',
    'section_tag': r'<section[^>]*>',
    'article_tag': r'<article[^>]*>',
    # Attributes
    'class_attribute': r'class=["\'][^"\']+["\']',
    'id_attribute': r'id=["\'][^"\']+["\']',
    'href_attribute': r'href=["\'][^"\']+["\']',
    'src_attribute': r'src=["\'][^"\']+["\']',
    'alt_attribute': r'alt=["\'][^"\']*["\']',
    # Scripts and styles
    'script_tag': r'<script[^>]*>',
    'style_tag': r'<style[^>]*>',
    'link_stylesheet': r'<link[^>]+rel=["\']stylesheet["\']',
}

CSS_PATTERNS = {
    # Selectors
    'class_selector': r'\.\w+\s*\{',
    'id_selector': r'#\w+\s*\{',
    'element_selector': r'^\w+\s*\{',
    'descendant_selector': r'\w+\s+\w+\s*\{',
    'child_selector': r'\w+\s*>\s*\w+\s*\{',
    'pseudo_class': r':\w+\s*\{',
    'pseudo_element': r'::\w+\s*\{',
    'attribute_selector': r'\[[\w-]+[=~|^$*]?',
    # Common properties
    'color_property': r'color\s*:',
    'background_color': r'background-color\s*:',
    'background_property': r'background\s*:',
    'font_size': r'font-size\s*:',
    'font_family': r'font-family\s*:',
    'margin_property': r'margin\s*:',
    'padding_property': r'padding\s*:',
    'border_property': r'border\s*:',
    'width_property': r'width\s*:',
    'height_property': r'height\s*:',
    # Layout
    'display_property': r'display\s*:',
    'display_flex': r'display\s*:\s*flex',
    'display_grid': r'display\s*:\s*grid',
    'position_property': r'position\s*:',
    'flexbox_property': r'(flex-direction|justify-content|align-items)\s*:',
    'grid_property': r'(grid-template|grid-gap|grid-area)\s*:',
    # Responsive
    'media_query': r'@media\s*\(',
    # Units
    'px_unit': r'\d+px',
    'rem_unit': r'\d+rem',
    'em_unit': r'\d+em',
    'percent_unit': r'\d+%',
    'vh_vw_unit': r'\d+(vh|vw)',
    # Colors
    'hex_color': r'#[0-9a-fA-F]{3,6}',
    'rgb_color': r'rgb\s*\(',
    'rgba_color': r'rgba\s*\(',
    # At-rules
    'import_rule': r'@import\s+',
    'font_face': r'@font-face\s*\{',
    'keyframes': r'@keyframes\s+\w+',
}
